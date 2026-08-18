import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BAN_100_YEARS = '876000h';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const displayName = String(body?.displayName || '').trim().replace(/\s+/g, ' ').slice(0, 80);

    if (!EMAIL_RE.test(email)) return json({ error: 'Неверный формат email' }, 400);
    if (password.length < 6 || password.length > 128) return json({ error: 'Пароль должен содержать от 6 до 128 символов' }, 400);
    if (displayName.length < 2) return json({ error: 'Укажите имя' }, 400);

    const admin = createAdmin();
    const emailHash = await sha256(email);
    const rawIp = firstHeader(req, ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for']);
    const ipHash = rawIp ? await sha256(rawIp.split(',')[0].trim()) : null;
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [{ count: emailAttempts }, ipResult] = await Promise.all([
      admin.from('registration_attempts').select('id', { count: 'exact', head: true }).eq('email_hash', emailHash).gte('created_at', since),
      ipHash
        ? admin.from('registration_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since)
        : Promise.resolve({ count: 0 }),
    ]);

    if ((emailAttempts || 0) >= 3 || (ipResult.count || 0) >= 12) {
      return json({ error: 'Слишком много заявок. Попробуйте позже.' }, 429);
    }

    await admin.from('registration_attempts').insert({ email_hash: emailHash, ip_hash: ipHash });
    // Opportunistic cleanup; failure is harmless.
    admin.from('registration_attempts').delete().lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).then(() => {});

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, registration_source: 'sigmas-request' },
    });

    if (createError || !created.user) {
      const message = createError?.message || 'Не удалось создать заявку';
      if (/already|registered|exists/i.test(message)) return json({ error: 'Этот email уже зарегистрирован' }, 409);
      throw createError || new Error(message);
    }

    const userId = created.user.id;
    try {
      const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_100_YEARS });
      if (banError) throw banError;

      const { error: profileError } = await admin.from('users').upsert({
        id: userId,
        email,
        display_name: displayName,
        approval_status: 'pending',
        status: 'offline',
      }, { onConflict: 'id' });
      if (profileError) throw profileError;

      const { error: requestError } = await admin.from('registration_requests').upsert({
        user_id: userId,
        email,
        display_name: displayName,
        status: 'pending',
        reviewed_at: null,
        reviewed_by: null,
        note: null,
      }, { onConflict: 'user_id' });
      if (requestError) throw requestError;

      await admin.from('admin_audit_logs').insert({
        actor_id: null,
        action: 'registration_requested',
        target_user_id: userId,
        details: { email, source: 'registration-request' },
      });
    } catch (setupError) {
      // Never leave a partly configured active account behind.
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      throw setupError;
    }

    return json({ ok: true, status: 'pending' }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
});

function createAdmin() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('supabase admin env not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function firstHeader(req: Request, names: string[]) {
  for (const name of names) {
    const value = req.headers.get(name);
    if (value) return value;
  }
  return null;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
