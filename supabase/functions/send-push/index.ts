// Supabase Edge Function: send-push
// Authenticated senders request delivery; all recipient resolution happens server-side.
// Required secrets: WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, WEB_PUSH_SUBJECT.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import webpush from 'npm:web-push@3.6.7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const VAPID_PUBLIC_KEY = Deno.env.get('WEB_PUSH_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('WEB_PUSH_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('WEB_PUSH_SUBJECT') || 'mailto:admin@example.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Preference = {
  enabled: boolean;
  direct_messages: boolean;
  group_messages: boolean;
  calls: boolean;
  previews: boolean;
};

type Recipient = {
  user_id: string;
  is_muted?: boolean | null;
};

type PushPayload = {
  kind: 'message' | 'call';
  title: string;
  body: string;
  tag: string;
  url: string;
  icon?: string;
  badge?: string;
  messageId?: string;
  conversationId: string;
  roomId?: string;
  requireInteraction?: boolean;
  renotify?: boolean;
  silent?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Supabase server secrets are missing' }, 500);
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return json({ error: 'Web Push VAPID secrets are missing' }, 503);

  try {
    const actor = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const kind = String(body?.kind || '');

    if (kind === 'message') {
      const messageId = String(body?.messageId || '').trim();
      if (!messageId) return json({ error: 'messageId required' }, 400);
      const delivery = await buildMessageDelivery(actor.id, messageId);
      if (!delivery) return json({ ok: true, sent: 0, skipped: true });
      const totals = { sent: 0, failed: 0, removed: 0 };
      for (const batch of delivery.batches) {
        const result = await deliver(batch.recipientIds, batch.payload);
        totals.sent += result.sent;
        totals.failed += result.failed;
        totals.removed += result.removed;
      }
      return json({ ok: true, ...totals });
    }

    if (kind === 'call') {
      const conversationId = String(body?.conversationId || '').trim();
      const roomId = String(body?.roomId || '').trim();
      const callType = body?.callType === 'video' ? 'video' : 'audio';
      const requestedTargets = Array.isArray(body?.targetUserIds)
        ? body.targetUserIds.map(String).filter(isUuid)
        : [];
      if (!conversationId || !roomId) return json({ error: 'conversationId and roomId required' }, 400);
      const delivery = await buildCallDelivery(actor.id, conversationId, roomId, callType, requestedTargets);
      if (!delivery) return json({ ok: true, sent: 0, skipped: true });
      return json({ ok: true, ...(await deliver(delivery.recipientIds, delivery.payload)) });
    }

    return json({ error: 'unknown kind' }, 400);
  } catch (error) {
    console.error('send-push:', error);
    const message = error instanceof Error ? error.message : String(error);
    const status = /unauthorized|forbidden/i.test(message) ? 401 : 500;
    return json({ error: message }, status);
  }
});

async function requireUser(req: Request): Promise<{ id: string }> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('unauthorized');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error('unauthorized');
  return { id: data.user.id };
}

async function buildMessageDelivery(actorId: string, messageId: string) {
  const { data: message, error } = await admin
    .from('messages')
    .select('id, conversation_id, sender_id, content, type, reply_to_id, deleted_at, expires_at, is_encrypted, is_spoiler')
    .eq('id', messageId)
    .maybeSingle();
  if (error) throw error;
  if (!message || message.sender_id !== actorId || message.deleted_at) return null;
  if (message.expires_at && new Date(message.expires_at).getTime() <= Date.now()) return null;
  if (message.type === 'system' || message.type === 'call') return null;

  const [{ data: conversation, error: conversationError }, { data: sender, error: senderError }, { data: members, error: membersError }] = await Promise.all([
    admin.from('conversations').select('id, type, name, avatar_url').eq('id', message.conversation_id).single(),
    admin.from('users').select('id, display_name, avatar_url').eq('id', actorId).single(),
    admin.from('conversation_members').select('user_id, is_muted').eq('conversation_id', message.conversation_id).neq('user_id', actorId),
  ]);
  if (conversationError) throw conversationError;
  if (senderError) throw senderError;
  if (membersError) throw membersError;

  const recipients = (members || []) as Recipient[];
  if (!recipients.length) return null;

  const mentionIds = new Set(extractMentionIds(String(message.content || '')));
  let replyAuthorId: string | null = null;
  if (message.reply_to_id) {
    const { data: reply } = await admin.from('messages').select('sender_id').eq('id', message.reply_to_id).maybeSingle();
    replyAuthorId = reply?.sender_id || null;
  }

  const recipientIds = recipients.map(row => row.user_id);
  const [preferences, blocked] = await Promise.all([
    getPreferences(recipientIds),
    getBlockedRecipients(actorId, recipientIds),
  ]);

  const isGroup = conversation.type === 'group';
  const filtered = recipients.filter(row => {
    if (blocked.has(row.user_id)) return false;
    const pref = preferences.get(row.user_id) || defaultPreference();
    if (!pref.enabled) return false;
    const priority = mentionIds.has(row.user_id) || replyAuthorId === row.user_id;
    if (row.is_muted && !priority) return false;
    if (isGroup && !pref.group_messages && !priority) return false;
    if (!isGroup && !pref.direct_messages) return false;
    return true;
  });
  if (!filtered.length) return null;

  const title = isGroup
    ? `${sender.display_name || 'Пользователь'} · ${conversation.name || 'Группа'}`
    : (sender.display_name || 'Новое сообщение');
  const basePayload = {
    kind: 'message' as const,
    title,
    tag: `message-${message.id}`,
    url: `/chat/${message.conversation_id}`,
    icon: sender.avatar_url || conversation.avatar_url || '/icon-192.png',
    badge: '/icon-192.png',
    messageId: message.id,
    conversationId: message.conversation_id,
    renotify: false,
    silent: false,
  };
  const withPreview = filtered.filter(row => (preferences.get(row.user_id) || defaultPreference()).previews);
  const withoutPreview = filtered.filter(row => !(preferences.get(row.user_id) || defaultPreference()).previews);
  const batches: Array<{ recipientIds: string[]; payload: PushPayload }> = [];
  if (withPreview.length) {
    batches.push({
      recipientIds: withPreview.map(row => row.user_id),
      payload: { ...basePayload, body: makeMessageBody(message, true) },
    });
  }
  if (withoutPreview.length) {
    batches.push({
      recipientIds: withoutPreview.map(row => row.user_id),
      payload: { ...basePayload, body: makeMessageBody(message, false) },
    });
  }
  return { batches };
}

async function buildCallDelivery(
  actorId: string,
  conversationId: string,
  roomId: string,
  callType: 'audio' | 'video',
  requestedTargets: string[],
) {
  const [{ data: actorMember }, { data: conversation, error: conversationError }, { data: caller, error: callerError }, { data: members, error: membersError }] = await Promise.all([
    admin.from('conversation_members').select('user_id').eq('conversation_id', conversationId).eq('user_id', actorId).maybeSingle(),
    admin.from('conversations').select('id, type, name, avatar_url').eq('id', conversationId).single(),
    admin.from('users').select('id, display_name, avatar_url').eq('id', actorId).single(),
    admin.from('conversation_members').select('user_id').eq('conversation_id', conversationId).neq('user_id', actorId),
  ]);
  if (!actorMember) throw new Error('forbidden');
  if (conversationError) throw conversationError;
  if (callerError) throw callerError;
  if (membersError) throw membersError;

  const allowedTargets = new Set((members || []).map(row => row.user_id));
  const candidates = requestedTargets.length
    ? requestedTargets.filter(id => allowedTargets.has(id))
    : Array.from(allowedTargets);
  if (!candidates.length) return null;

  const [preferences, blocked] = await Promise.all([
    getPreferences(candidates),
    getBlockedRecipients(actorId, candidates),
  ]);
  const recipientIds = candidates.filter(id => {
    const pref = preferences.get(id) || defaultPreference();
    return pref.enabled && pref.calls && !blocked.has(id);
  });
  if (!recipientIds.length) return null;

  const isGroup = conversation.type === 'group';
  const callerName = caller.display_name || 'Пользователь';
  return {
    recipientIds,
    payload: {
      kind: 'call' as const,
      title: callType === 'video' ? 'Входящий видеозвонок' : 'Входящий звонок',
      body: isGroup ? `${callerName} · ${conversation.name || 'Групповой звонок'}` : `${callerName} звонит…`,
      tag: `call-${roomId}`,
      url: `/chat/${conversationId}`,
      icon: caller.avatar_url || conversation.avatar_url || '/icon-192.png',
      badge: '/icon-192.png',
      conversationId,
      roomId,
      requireInteraction: true,
      renotify: true,
      silent: false,
    } satisfies PushPayload,
  };
}

async function getPreferences(userIds: string[]): Promise<Map<string, Preference>> {
  const map = new Map<string, Preference>();
  if (!userIds.length) return map;
  const { data, error } = await admin.from('notification_preferences')
    .select('user_id, enabled, direct_messages, group_messages, calls, previews')
    .in('user_id', userIds);
  if (error) throw error;
  for (const row of data || []) map.set(row.user_id, row as Preference & { user_id: string });
  return map;
}

async function getBlockedRecipients(actorId: string, recipientIds: string[]): Promise<Set<string>> {
  const blocked = new Set<string>();
  if (!recipientIds.length) return blocked;
  const { data, error } = await admin.from('blocked_users')
    .select('blocker_id')
    .eq('blocked_id', actorId)
    .in('blocker_id', recipientIds);
  if (error) {
    console.warn('blocked-users lookup skipped:', error.message);
    return blocked;
  }
  for (const row of data || []) blocked.add(row.blocker_id);
  return blocked;
}

async function deliver(recipientIds: string[], payload: PushPayload) {
  if (!recipientIds.length) return { sent: 0, failed: 0, removed: 0 };
  const { data: subscriptions, error } = await admin.from('push_subscriptions')
    .select('id, user_id, device_id, endpoint, p256dh, auth')
    .in('user_id', recipientIds)
    .eq('enabled', true);
  if (error) throw error;

  // Settings → Devices can remotely terminate a session. A stale browser endpoint
  // must not keep receiving private messages after its user_sessions row is removed.
  const deviceBacked = (subscriptions || []).filter(subscription => subscription.device_id);
  let activeSubscriptions = subscriptions || [];
  if (deviceBacked.length) {
    const userIds = Array.from(new Set(deviceBacked.map(subscription => subscription.user_id)));
    const { data: sessions, error: sessionError } = await admin.from('user_sessions')
      .select('user_id, device_id')
      .in('user_id', userIds);
    if (sessionError) throw sessionError;
    const activeKeys = new Set((sessions || []).map(row => `${row.user_id}:${row.device_id}`));
    const inactiveIds = deviceBacked
      .filter(subscription => !activeKeys.has(`${subscription.user_id}:${subscription.device_id}`))
      .map(subscription => subscription.id);
    activeSubscriptions = (subscriptions || []).filter(subscription =>
      !subscription.device_id || activeKeys.has(`${subscription.user_id}:${subscription.device_id}`)
    );
    if (inactiveIds.length) {
      await admin.from('push_subscriptions').update({ enabled: false, last_error: 'device session ended' }).in('id', inactiveIds);
    }
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;
  await Promise.all(activeSubscriptions.map(async subscription => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify(payload), {
        TTL: payload.kind === 'call' ? 45 : 86400,
        urgency: payload.kind === 'call' ? 'high' : 'normal',
      });
      sent += 1;
      await admin.from('push_subscriptions').update({ last_error: null, last_seen_at: new Date().toISOString() }).eq('id', subscription.id);
    } catch (error) {
      failed += 1;
      const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
      const message = error instanceof Error ? error.message : String(error);
      if (statusCode === 404 || statusCode === 410) {
        removed += 1;
        await admin.from('push_subscriptions').delete().eq('id', subscription.id);
      } else {
        await admin.from('push_subscriptions').update({ last_error: message.slice(0, 500) }).eq('id', subscription.id);
      }
    }
  }));

  return { sent, failed, removed };
}

function makeMessageBody(message: Record<string, any>, previews: boolean): string {
  if (message.is_encrypted) return '🔒 Новое сообщение';
  if (!previews) return 'Новое сообщение';
  if (message.is_spoiler) return 'Скрытое сообщение';

  const labels: Record<string, string> = {
    image: 'Фото',
    file: 'Файл',
    voice: 'Голосовое сообщение',
    album: 'Медиаальбом',
    location: 'Геопозиция',
    poll: 'Опрос',
  };
  const clean = stripMentionTokens(String(message.content || '')).trim();
  return (clean || labels[String(message.type)] || 'Новое сообщение').slice(0, 140);
}

function stripMentionTokens(value: string): string {
  return value.replace(/@\[([^\]]*)\]\(mention:[0-9a-fA-F-]{36}\)/g, (_raw, encoded) => {
    try { return `@${decodeURIComponent(encoded)}`; } catch { return `@${encoded}`; }
  });
}

function extractMentionIds(value: string): string[] {
  return Array.from(value.matchAll(/@\[[^\]]*\]\(mention:([0-9a-fA-F-]{36})\)/g), match => match[1]);
}

function defaultPreference(): Preference {
  return { enabled: true, direct_messages: true, group_messages: true, calls: true, previews: true };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
