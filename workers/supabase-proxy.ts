export interface Env {
  SUPABASE_UPSTREAM_URL: string;
  ALLOWED_ORIGINS?: string;
  ALLOW_NO_ORIGIN?: string;
}

const SUPABASE_PATHS = [
  '/auth/v1',
  '/rest/v1',
  '/realtime/v1',
  '/storage/v1',
  '/functions/v1',
] as const;

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function getAllowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
}

function isAllowedOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return env.ALLOW_NO_ORIGIN === 'true';

  const allowed = getAllowedOrigins(env);
  if (allowed.length === 0) return true;

  const normalized = normalizeOrigin(origin);
  return allowed.includes(normalized);
}

function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('origin');
  const allowed = getAllowedOrigins(env);
  const allowOrigin = origin && (allowed.length === 0 || allowed.includes(normalizeOrigin(origin))) ? origin : allowed[0] || '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': request.headers.get('access-control-request-headers') || 'authorization,apikey,content-type,x-client-info,x-supabase-api-version',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin, Access-Control-Request-Headers',
  };
}

function isSupabasePath(pathname: string): boolean {
  return SUPABASE_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function cleanUpstreamUrl(rawUrl: string): URL {
  if (!rawUrl) throw new Error('SUPABASE_UPSTREAM_URL is not configured');
  const url = new URL(rawUrl);
  url.pathname = url.pathname.replace(/\/$/, '');
  url.search = '';
  url.hash = '';
  return url;
}

function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get('upgrade')?.toLowerCase() === 'websocket';
}

function createUpstreamRequest(request: Request, upstreamUrl: URL): Request {
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(upstreamUrl.toString());
  targetUrl.pathname = `${upstreamUrl.pathname}${incomingUrl.pathname}`.replace(/\/+/g, '/');
  targetUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  if (!isWebSocketUpgrade(request)) {
    for (const name of HOP_BY_HOP_HEADERS) headers.delete(name);
  }
  headers.delete('host');
  headers.set('x-forwarded-host', incomingUrl.host);
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''));

  return new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });
}

function withCors(response: Response, request: Request, env: Env): Response {
  const next = new Response(response.body, response);
  const cors = getCorsHeaders(request, env);
  for (const [key, value] of Object.entries(cors)) next.headers.set(key, value);
  next.headers.set('x-supabase-proxy', 'cloudflare-worker');
  return next;
}

function json(status: number, body: unknown, request: Request, env: Env): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...getCorsHeaders(request, env),
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(request, env) });
    }

    if (!isAllowedOrigin(request, env)) {
      return json(403, { error: 'Origin is not allowed by Supabase proxy' }, request, env);
    }

    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return json(200, { ok: true, service: 'supabase-proxy' }, request, env);
    }

    if (!isSupabasePath(url.pathname)) {
      return json(404, {
        error: 'Unsupported Supabase proxy path',
        allowedPrefixes: SUPABASE_PATHS,
      }, request, env);
    }

    let upstreamUrl: URL;
    try {
      upstreamUrl = cleanUpstreamUrl(env.SUPABASE_UPSTREAM_URL);
    } catch (error) {
      return json(500, { error: error instanceof Error ? error.message : 'Invalid upstream URL' }, request, env);
    }

    const upstreamRequest = createUpstreamRequest(request, upstreamUrl);
    const upstreamResponse = await fetch(upstreamRequest);

    // WebSocket upgrade responses cannot be safely wrapped in a new Response,
    // otherwise Cloudflare may detach the websocket. Return them as-is.
    if (isWebSocketUpgrade(request)) return upstreamResponse;

    return withCors(upstreamResponse, request, env);
  },
};
