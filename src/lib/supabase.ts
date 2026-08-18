import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DIRECT_URL = (import.meta as any).env.VITE_SUPABASE_URL as string | undefined;
const PROXY_URL = (import.meta as any).env.VITE_SUPABASE_PROXY_URL as string | undefined;
const KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string | undefined;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

const CLEAN_DIRECT_URL = DIRECT_URL ? trimTrailingSlash(DIRECT_URL.trim()) : '';
const CLEAN_PROXY_URL = PROXY_URL ? trimTrailingSlash(PROXY_URL.trim()) : '';
const CLEAN_KEY = KEY ? KEY.trim() : '';
const CLIENT_URL = CLEAN_PROXY_URL || CLEAN_DIRECT_URL;

function resolveConfigError(): string | null {
  if (!CLEAN_DIRECT_URL && !CLEAN_PROXY_URL) {
    return 'Не задан VITE_SUPABASE_URL или VITE_SUPABASE_PROXY_URL.';
  }
  if (!CLIENT_URL || !isValidHttpUrl(CLIENT_URL)) {
    return `Некорректный Supabase URL: ${CLIENT_URL || 'пусто'}.`;
  }
  if (!CLEAN_KEY) {
    return 'Не задан VITE_SUPABASE_ANON_KEY.';
  }
  return null;
}

export const SUPABASE_CONFIG_ERROR = resolveConfigError();
export const SUPABASE_DIRECT_URL = CLEAN_DIRECT_URL;
export const SUPABASE_PROXY_URL = CLEAN_PROXY_URL;
export const SUPABASE_URL = CLIENT_URL;
export const IS_SUPABASE_PROXY_ENABLED = Boolean(SUPABASE_PROXY_URL);
export const IS_SUPABASE_CONFIGURED = !SUPABASE_CONFIG_ERROR;

if (SUPABASE_CONFIG_ERROR) {
  // eslint-disable-next-line no-console
  console.error('[supabase] configuration error:', SUPABASE_CONFIG_ERROR, {
    hasDirectUrl: Boolean(CLEAN_DIRECT_URL),
    hasProxyUrl: Boolean(CLEAN_PROXY_URL),
    hasAnonKey: Boolean(CLEAN_KEY),
  });
}

if (CLEAN_PROXY_URL && /\/supabase\/?$/i.test(CLEAN_PROXY_URL)) {
  // eslint-disable-next-line no-console
  console.warn('[supabase] Path-based proxy URLs are not recommended. Use a dedicated origin like https://supabase-proxy.example.com.');
}

function createSupabaseStub(): SupabaseClient {
  const error = new Error(SUPABASE_CONFIG_ERROR || 'Supabase is not configured');
  const response = { data: null, error };
  const authResponse = { data: { session: null, user: null }, error };

  const makeThenableBuilder = (): any => {
    const promise = Promise.resolve(response);
    const builder: any = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'then') return promise.then.bind(promise);
        if (prop === 'catch') return promise.catch.bind(promise);
        if (prop === 'finally') return promise.finally.bind(promise);
        return () => builder;
      },
    });
    return builder;
  };

  return {
    auth: {
      getSession: async () => authResponse,
      getUser: async () => authResponse,
      refreshSession: async () => authResponse,
      signInWithPassword: async () => authResponse,
      signUp: async () => authResponse,
      signOut: async () => ({ error }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    from: () => makeThenableBuilder(),
    rpc: async () => response,
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }),
      unsubscribe: () => {},
    }),
    removeChannel: async () => 'ok',
    storage: {
      from: () => ({
        upload: async () => response,
        remove: async () => response,
        download: async () => response,
        list: async () => response,
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
    functions: {
      invoke: async () => response,
    },
  } as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = SUPABASE_CONFIG_ERROR
  ? createSupabaseStub()
  : createClient(SUPABASE_URL, CLEAN_KEY, {
      auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      global: {
        headers: IS_SUPABASE_PROXY_ENABLED ? { 'x-sigmas-supabase-proxy': '1' } : undefined,
      },
    });
