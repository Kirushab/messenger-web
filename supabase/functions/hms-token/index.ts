// Supabase Edge Function: hms-token
// Генерирует 100ms management/app JWT и создаёт комнаты на сервере.
// HMS_SECRET хранится только в Supabase secrets, во фронтенд не попадает.
//
// Required secrets:
//   HMS_ACCESS_KEY
//   HMS_SECRET
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
//
// Deploy:
//   supabase functions deploy hms-token
//   supabase secrets set HMS_ACCESS_KEY=... HMS_SECRET=...

import { SignJWT } from 'https://esm.sh/jose@5.10.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ROLES = new Set(['host', 'guest', 'speaker', 'listener']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');

    if (action === 'create-room') {
      const id = await createHmsRoom(user.id);
      return json({ id, error: null });
    }

    if (action === 'app-token') {
      const roomId = String(body?.roomId || body?.room_id || '').trim();
      const role = ALLOWED_ROLES.has(String(body?.role || 'host')) ? String(body?.role || 'host') : 'host';
      if (!roomId) return json({ error: 'roomId required' }, 400);
      const token = await hmsToken({ type: 'app', room_id: roomId, user_id: user.id, role });
      return json({ token, error: null });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = /auth|required|jwt/i.test(message) ? 401 : 500;
    return json({ error: message }, status);
  }
});

async function requireUser(req: Request): Promise<{ id: string; email?: string }> {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) throw new Error('supabase env not configured');

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) throw new Error('auth required');

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('invalid jwt');
  return { id: data.user.id, email: data.user.email || undefined };
}

function hmsConfig() {
  const accessKey = Deno.env.get('HMS_ACCESS_KEY');
  const secret = Deno.env.get('HMS_SECRET');
  if (!accessKey || !secret) throw new Error('100ms env not configured');
  return { accessKey, secretBytes: new TextEncoder().encode(secret) };
}

async function hmsToken(payload: Record<string, unknown>) {
  const { accessKey, secretBytes } = hmsConfig();
  return new SignJWT({ access_key: accessKey, version: 2, jti: crypto.randomUUID(), ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setNotBefore(Math.floor(Date.now() / 1000))
    .setExpirationTime('1h')
    .sign(secretBytes);
}

async function createHmsRoom(userId: string): Promise<string> {
  const token = await hmsToken({ type: 'management' });
  const res = await fetch('https://api.100ms.live/v2/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `call_${userId.slice(0, 8)}_${Date.now()}` }),
  });
  if (!res.ok) throw new Error(`100ms room api ${res.status}`);
  const data = await res.json();
  if (!data?.id) throw new Error('100ms room id missing');
  return data.id;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
