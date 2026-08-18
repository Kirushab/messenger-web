import { create } from 'zustand';
import { diag } from '@/lib/diag';
import { setSentryUser } from '@/lib/sentry';
import { clearCache } from '@/lib/offlineCache';
import { supabase } from '@/lib/supabase';
import { getDeviceIdentity } from '@/lib/deviceIdentity';
import { detachPushNotifications } from '@/lib/pushNotifications';
import type { User } from '@/types';
import type { Session } from '@supabase/supabase-js';

type ApprovalStatus = NonNullable<User['approval_status']>;
type AccessStatus = 'guest' | 'checking' | 'approved' | ApprovalStatus;

let authSubscriptionStarted = false;
let authOperation: 'signin' | 'signout' | null = null;

function approvalMessage(status: ApprovalStatus): string {
  if (status === 'pending') return 'Заявка на регистрацию ожидает подтверждения администратора.';
  if (status === 'rejected') return 'Заявка на регистрацию отклонена администратором.';
  if (status === 'blocked') return 'Аккаунт заблокирован администратором.';
  if (status === 'deleted') return 'Аккаунт удалён администратором.';
  return '';
}

async function readFunctionError(error: any): Promise<string> {
  try {
    const response = error?.context as Response | undefined;
    if (response?.clone) {
      const payload = await response.clone().json().catch(() => null);
      if (payload?.error) return String(payload.error);
    }
  } catch {}
  return error?.message || 'Не удалось отправить заявку';
}

async function registerSession(userId: string) {
  try {
    const device = getDeviceIdentity();
    const previousSessionId = localStorage.getItem('sessionId');
    const now = new Date().toISOString();

    // v336 schema: one row per installation/browser profile. This avoids a new
    // "device" appearing after every sign-in on the same phone.
    const { data, error } = await supabase
      .from('user_sessions')
      .upsert({
        user_id: userId,
        device_id: device.id,
        device_info: `${device.name} · ${device.browser}`,
        device_name: device.name,
        platform: device.platform,
        browser: device.browser,
        os_version: device.osVersion,
        is_pwa: device.isPwa,
        last_active: now,
      }, { onConflict: 'user_id,device_id' })
      .select('id')
      .single();

    if (!error && data?.id) {
      localStorage.setItem('sessionId', data.id);
      // Remove the pre-v336 row created by the same installation. Other legacy
      // rows stay visible and can be closed from Settings.
      if (previousSessionId && previousSessionId !== data.id) {
        await supabase.from('user_sessions').delete().eq('id', previousSessionId).eq('user_id', userId);
      }
      return;
    }

    // Compatibility fallback while migration 169 has not been applied yet.
    // The app keeps working with the old user_sessions shape instead of
    // breaking authentication because PostgREST does not know the new columns.
    if (previousSessionId) {
      const { data: row } = await supabase.from('user_sessions').select('id').eq('id', previousSessionId).maybeSingle();
      if (row) {
        await supabase
          .from('user_sessions')
          .update({ last_active: now, device_info: `${device.name} · ${device.browser}` })
          .eq('id', previousSessionId);
        return;
      }
      localStorage.removeItem('sessionId');
    }

    const { data: legacy } = await supabase
      .from('user_sessions')
      .insert({ user_id: userId, device_info: `${device.name} · ${device.browser}`, last_active: now })
      .select('id')
      .single();
    if (legacy?.id) localStorage.setItem('sessionId', legacy.id);
  } catch (e) {
    console.error('session reg:', e);
  }
}

function startSessionHeartbeat(get: () => AuthState, set: (partial: Partial<AuthState>) => void) {
  if ((window as any).__sessionHeartbeat) return;
  (window as any).__sessionHeartbeat = setInterval(async () => {
    const uid = get().session?.user?.id;
    const sid = localStorage.getItem('sessionId');
    if (!uid || !sid || get().accessStatus !== 'approved') return;
    try {
      const { data } = await supabase.from('user_sessions').select('id').eq('id', sid).maybeSingle();
      if (!data) {
        clearInterval((window as any).__sessionHeartbeat);
        (window as any).__sessionHeartbeat = null;
        localStorage.removeItem('sessionId');
        sessionStorage.setItem('auth_notice', 'Эта сессия была завершена с другого устройства.');
        await supabase.auth.signOut();
        set({ session: null, user: null, accessStatus: 'guest' });
        return;
      }
      await supabase.from('user_sessions').update({ last_active: new Date().toISOString() }).eq('id', sid);
    } catch {}
  }, 120000);
}

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  initialized: boolean;
  accessStatus: AccessStatus;
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; pending?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (u: Partial<User>) => Promise<{ error: string | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const denySession = async (notice: string, reason: string, uid?: string) => {
    diag('auth.access.denied', { reason, uid });
    sessionStorage.setItem('auth_notice', notice);
    try { await supabase.auth.signOut(); } catch {}
    set({ session: null, user: null, accessStatus: 'guest' });
    setSentryUser(null);
  };

  const applySession = async (session: Session | null) => {
    if (!session?.user) {
      set({ session: null, user: null, accessStatus: 'guest' });
      setSentryUser(null);
      return;
    }

    set({ session, user: null, accessStatus: 'checking' });
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', session.user.id).maybeSingle();
      if (error) {
        await denySession('Не удалось проверить доступ к аккаунту. Проверь соединение и войди снова.', error.message, session.user.id);
        return;
      }
      if (!data) {
        await denySession('Профиль аккаунта не найден. Обратись к администратору.', 'profile_missing', session.user.id);
        return;
      }

      const profile = data as User;
      const status: ApprovalStatus = profile.approval_status || 'approved';
      if (status !== 'approved') {
        const notice = approvalMessage(status);
        sessionStorage.setItem('auth_notice', notice);
        await supabase.auth.signOut();
        set({ session: null, user: null, accessStatus: 'guest' });
        setSentryUser(null);
        return;
      }

      set({ user: profile, accessStatus: 'approved' });
      setSentryUser(profile as any);
      registerSession(session.user.id);
      startSessionHeartbeat(get, set);
    } catch (error: any) {
      await denySession('Не удалось проверить доступ к аккаунту. Проверь соединение и войди снова.', error?.message || 'profile_exception', session.user.id);
    }
  };

  return {
    session: null,
    user: null,
    loading: false,
    initialized: false,
    accessStatus: 'guest',

    initialize: async () => {
      diag('auth.init.start', { alreadyInit: get().initialized });
      if (get().initialized) return;

      if (!authSubscriptionStarted) {
        authSubscriptionStarted = true;
        supabase.auth.onAuthStateChange((event, session) => {
          diag('auth.event', { event, hasSession: !!session, uid: session?.user?.id });
          if (authOperation === 'signin') return;
          // Move async profile work outside the auth callback's current stack.
          setTimeout(() => { void applySession(session); }, 0);
        });
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        set({ initialized: true });
        await applySession(session || null);
      } catch (error: any) {
        diag('auth.init.err', { error: error?.message });
        set({ initialized: true, session: null, user: null, accessStatus: 'guest' });
      }
    },

    signUp: async (email, password, name) => {
      set({ loading: true });
      try {
        const { data, error } = await supabase.functions.invoke('registration-request', {
          body: { email: email.trim().toLowerCase(), password, displayName: name.trim() },
        });
        if (error) return { error: await readFunctionError(error) };
        if (data?.error) return { error: String(data.error) };
        return { error: null, pending: true };
      } catch (error: any) {
        return { error: error?.message || 'Не удалось отправить заявку' };
      } finally {
        set({ loading: false });
      }
    },

    signIn: async (email, password) => {
      set({ loading: true, accessStatus: 'checking' });
      authOperation = 'signin';
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.session || !data.user) {
          const message = error?.message || 'Не удалось войти';
          set({ accessStatus: 'guest' });
          if (/bann/i.test(message)) {
            return { error: 'Аккаунт ожидает одобрения или ограничен администратором.' };
          }
          return { error: message };
        }

        const { data: profile, error: profileError } = await supabase.from('users').select('*').eq('id', data.user.id).maybeSingle();
        if (profileError || !profile) {
          await supabase.auth.signOut();
          set({ session: null, user: null, accessStatus: 'guest' });
          return { error: 'Профиль аккаунта не найден. Обратитесь к администратору.' };
        }

        const status: ApprovalStatus = (profile as User).approval_status || 'approved';
        if (status !== 'approved') {
          await supabase.auth.signOut();
          set({ session: null, user: null, accessStatus: 'guest' });
          return { error: approvalMessage(status) };
        }

        set({ session: data.session, user: profile as User, accessStatus: 'approved' });
        setSentryUser(profile as any);
        await supabase.from('users').update({ status: 'online' }).eq('id', data.user.id);
        await registerSession(data.user.id);
        startSessionHeartbeat(get, set);
        return { error: null };
      } catch (error: any) {
        try { await supabase.auth.signOut(); } catch {}
        set({ session: null, user: null, accessStatus: 'guest' });
        return { error: error?.message || 'Не удалось проверить аккаунт' };
      } finally {
        authOperation = null;
        set({ loading: false });
      }
    },

    signOut: async () => {
      authOperation = 'signout';
      const uid = get().session?.user?.id;
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId) {
        try { await supabase.from('user_sessions').delete().eq('id', sessionId); } catch {}
        localStorage.removeItem('sessionId');
      }
      if (uid) {
        await detachPushNotifications();
        await supabase.from('users').update({ status: 'offline' }).eq('id', uid);
      }
      await supabase.auth.signOut();
      try { await clearCache(); } catch {}
      setSentryUser(null);
      set({ session: null, user: null, accessStatus: 'guest' });
      authOperation = null;
    },

    updateProfile: async (updates) => {
      const uid = get().session?.user?.id;
      if (!uid) return { error: 'Not authenticated' };
      const { error } = await supabase.from('users').update(updates).eq('id', uid);
      if (!error) set({ user: { ...get().user!, ...updates } });
      return { error: error?.message || null };
    },
  };
});
