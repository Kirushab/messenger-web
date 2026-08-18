import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OWNER_EMAILS = new Set(['lirikbog@gmail.com', 'lirikb2002@gmail.com']);
const BAN_100_YEARS = '876000h';

type Action = 'list' | 'approve' | 'reject' | 'block' | 'unblock' | 'soft_delete' | 'restore' | 'hard_delete';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const admin = createAdmin();
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'auth required' }, 401);

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'invalid jwt' }, 401);

    const actor = authData.user;
    const { data: roleRow } = await admin.from('admin_roles').select('role').eq('user_id', actor.id).maybeSingle();
    const actorEmail = (actor.email || '').toLowerCase();
    const role = roleRow?.role || (OWNER_EMAILS.has(actorEmail) ? 'owner' : null);
    if (!role) return json({ error: 'admin access required' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'list') as Action;
    const targetUserId = typeof body?.userId === 'string' ? body.userId : null;
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : null;

    if (action === 'list') return json(await listUsers(admin));
    if (!['owner', 'admin'].includes(role)) return json({ error: 'Недостаточно прав для управления пользователями' }, 403);
    if (!targetUserId) return json({ error: 'userId is required' }, 400);
    if (targetUserId === actor.id) return json({ error: 'Нельзя применить это действие к своему аккаунту' }, 400);
    if (action === 'hard_delete' && role !== 'owner') return json({ error: 'Удалять навсегда может только владелец' }, 403);

    const [{ data: targetRole }, { data: targetAuthData }] = await Promise.all([
      admin.from('admin_roles').select('role').eq('user_id', targetUserId).maybeSingle(),
      admin.auth.admin.getUserById(targetUserId),
    ]);
    if (targetRole?.role === 'owner') return json({ error: 'Аккаунт владельца нельзя заблокировать или удалить' }, 400);

    const targetEmail = targetAuthData?.user?.email || null;
    const now = new Date().toISOString();

    if (action === 'approve') {
      await ensureProfile(admin, targetUserId, targetAuthData?.user, 'approved');
      await must(admin.from('users').update({ approval_status: 'approved', blocked_at: null, blocked_reason: null, deleted_at: null, deleted_by: null }).eq('id', targetUserId));
      await admin.from('registration_requests').update({ status: 'approved', reviewed_at: now, reviewed_by: actor.id, note: reason }).eq('user_id', targetUserId);
      await mustAuth(admin.auth.admin.updateUserById(targetUserId, { ban_duration: 'none' }));
    } else if (action === 'reject') {
      await ensureProfile(admin, targetUserId, targetAuthData?.user, 'rejected');
      await must(admin.from('users').update({ approval_status: 'rejected', blocked_at: now, blocked_reason: reason || 'Заявка отклонена', status: 'offline' }).eq('id', targetUserId));
      await admin.from('registration_requests').update({ status: 'rejected', reviewed_at: now, reviewed_by: actor.id, note: reason }).eq('user_id', targetUserId);
      await mustAuth(admin.auth.admin.updateUserById(targetUserId, { ban_duration: BAN_100_YEARS }));
      await admin.from('user_sessions').delete().eq('user_id', targetUserId);
    } else if (action === 'block') {
      await ensureProfile(admin, targetUserId, targetAuthData?.user, 'blocked');
      await must(admin.from('users').update({ approval_status: 'blocked', blocked_at: now, blocked_reason: reason || 'Заблокирован администратором', status: 'offline' }).eq('id', targetUserId));
      await mustAuth(admin.auth.admin.updateUserById(targetUserId, { ban_duration: BAN_100_YEARS }));
      await admin.from('user_sessions').delete().eq('user_id', targetUserId);
    } else if (action === 'unblock') {
      await ensureProfile(admin, targetUserId, targetAuthData?.user, 'approved');
      await must(admin.from('users').update({ approval_status: 'approved', blocked_at: null, blocked_reason: null, deleted_at: null, deleted_by: null }).eq('id', targetUserId));
      await mustAuth(admin.auth.admin.updateUserById(targetUserId, { ban_duration: 'none' }));
    } else if (action === 'soft_delete') {
      await ensureProfile(admin, targetUserId, targetAuthData?.user, 'deleted');
      await must(admin.from('users').update({
        approval_status: 'deleted',
        deleted_at: now,
        deleted_by: actor.id,
        blocked_at: now,
        blocked_reason: reason || 'Удалён администратором',
        status: 'offline',
      }).eq('id', targetUserId));
      await mustAuth(admin.auth.admin.updateUserById(targetUserId, { ban_duration: BAN_100_YEARS }));
      await admin.from('user_sessions').delete().eq('user_id', targetUserId);
    } else if (action === 'restore') {
      await ensureProfile(admin, targetUserId, targetAuthData?.user, 'approved');
      await must(admin.from('users').update({ approval_status: 'approved', deleted_at: null, deleted_by: null, blocked_at: null, blocked_reason: null }).eq('id', targetUserId));
      await mustAuth(admin.auth.admin.updateUserById(targetUserId, { ban_duration: 'none' }));
    } else if (action === 'hard_delete') {
      await admin.from('admin_audit_logs').insert({
        actor_id: actor.id,
        action,
        target_user_id: targetUserId,
        details: { reason, actor_email: actor.email || null, target_email: targetEmail },
      });
      const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId, false);
      if (deleteError) {
        throw new Error(`Не удалось удалить навсегда: ${deleteError.message}. Сначала удалите связанный контент или оставьте мягкое удаление.`);
      }
      return json({ ok: true, action, userId: targetUserId });
    } else {
      return json({ error: 'unknown action' }, 400);
    }

    await admin.from('admin_audit_logs').insert({
      actor_id: actor.id,
      action,
      target_user_id: targetUserId,
      details: { reason, actor_email: actor.email || null, target_email: targetEmail },
    });

    return json({ ok: true, action, userId: targetUserId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
});

async function ensureProfile(admin: ReturnType<typeof createAdmin>, id: string, authUser: any, status: string) {
  const email = authUser?.email || `${id}@pending.local`;
  const displayName = authUser?.user_metadata?.display_name || authUser?.user_metadata?.name || email.split('@')[0] || 'Пользователь';
  const { error } = await admin.from('users').upsert({
    id,
    email,
    display_name: displayName,
    approval_status: status,
    status: 'offline',
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
}

async function listUsers(admin: ReturnType<typeof createAdmin>) {
  const [{ data: authPage, error: authError }, { data: profiles, error: profilesError }, { data: roles }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from('users').select('id,email,display_name,avatar_url,status,created_at,approval_status,blocked_at,blocked_reason,deleted_at').order('created_at', { ascending: false }),
    admin.from('admin_roles').select('user_id,role'),
  ]);
  if (authError) throw authError;
  if (profilesError) throw profilesError;

  const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
  const roleMap = new Map((roles || []).map((row: any) => [row.user_id, row.role]));
  const ids = new Set<string>([
    ...(authPage?.users || []).map(user => user.id),
    ...(profiles || []).map((profile: any) => profile.id),
  ]);

  const users = [...ids].map(id => {
    const profile: any = profileMap.get(id) || {};
    const authUser = (authPage?.users || []).find(user => user.id === id);
    const email = authUser?.email || profile.email || null;
    const isBanned = !!authUser?.banned_until && new Date(authUser.banned_until).getTime() > Date.now();
    const fallbackStatus = isBanned ? 'blocked' : 'approved';
    return {
      id,
      email: profile.email || email,
      auth_email: email,
      display_name: profile.display_name || authUser?.user_metadata?.display_name || authUser?.user_metadata?.name || email?.split('@')[0] || 'Без имени',
      avatar_url: profile.avatar_url || null,
      status: profile.status || 'offline',
      created_at: profile.created_at || authUser?.created_at || new Date(0).toISOString(),
      approval_status: profile.approval_status || fallbackStatus,
      blocked_at: profile.blocked_at || null,
      blocked_reason: profile.blocked_reason || null,
      deleted_at: profile.deleted_at || null,
      last_sign_in_at: authUser?.last_sign_in_at || null,
      email_confirmed_at: authUser?.email_confirmed_at || null,
      banned_until: authUser?.banned_until || null,
      role: roleMap.get(id) || null,
      profile_missing: !profileMap.has(id),
    };
  });

  users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return { users };
}

async function must(result: PromiseLike<{ error: any }>) {
  const { error } = await result;
  if (error) throw error;
}

async function mustAuth(result: PromiseLike<{ error: any }>) {
  const { error } = await result;
  if (error) throw error;
}

function createAdmin() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('supabase admin env not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
