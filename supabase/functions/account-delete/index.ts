// Supabase Edge Function: account-delete
// Создаёт in-app запрос на удаление аккаунта, чтобы пользователь мог инициировать
// deletion flow прямо из приложения. Финальное удаление/экспорт данных выполняется
// владельцем проекта по очереди requests, чтобы не сломать исторические чаты/UGC.
//
// Required secrets:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Deploy:
//   supabase functions deploy account-delete

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const admin = createAdmin();
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'auth required' }, 401);

    const { data: authData, error: authError } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
    if (authError || !authData.user) return json({ error: 'invalid jwt' }, 401);

    const user = authData.user;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : null;
    const metadata = {
      user_agent: req.headers.get('user-agent') || null,
      client: body?.client || 'web',
      requested_at: new Date().toISOString(),
    };

    const { data: existing } = await admin
      .from('account_deletion_requests')
      .select('id,status,created_at')
      .eq('user_id', user.id)
      .in('status', ['requested', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await admin.from('account_deletion_requests').insert({
        user_id: user.id,
        email: user.email || null,
        reason,
        metadata,
      });
      if (insertError) throw insertError;
    }

    await admin.from('users').update({
      deletion_requested_at: new Date().toISOString(),
      deletion_status: existing?.status || 'requested',
      status: 'offline',
    }).eq('id', user.id);

    await admin.from('user_sessions').delete().eq('user_id', user.id);

    return json({ ok: true, status: existing?.status || 'requested' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: message }, 500);
  }
});

function createAdmin() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('supabase admin env not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
