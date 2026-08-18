// supabase/functions/flight-track/index.ts
//
// Прокси к AirLabs: живая позиция борта по номеру рейса + координаты аэропортов вылета/прилёта.
// Ключ AirLabs хранится ТОЛЬКО в секрете AIRLABS_API_KEY — никогда в коде/во фронте.
//
// Деплой: дашборд Supabase → Edge Functions → flight-track → вставить код → Deploy updates.
// Секрет: Project Settings → Edge Functions → AIRLABS_API_KEY = ключ.
//
// Вызовы:
//   ?flight=SU100        → { found, lat, lng, dir, status, dep:{iata,lat,lng,name}, arr:{...}, ... }
//   ?flight=SU100&debug=1 → сырой ответ AirLabs (для отладки)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const FLIGHT_TTL_MS = 40_000;                 // позиция борта — свежая 40с
const AIRPORT_TTL_MS = 30 * 24 * 3600 * 1000; // аэропорты статичны — кэшируем надолго

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    const flight = (url.searchParams.get("flight") || url.searchParams.get("flight_iata") || "")
      .trim().toUpperCase().replace(/\s+/g, "");
    const debug = url.searchParams.get("debug") === "1";
    if (!flight) return json({ error: "missing flight" }, 400);

    const key = Deno.env.get("AIRLABS_API_KEY");
    if (!key) return json({ error: "AIRLABS_API_KEY not set" }, 500);

    const cached = debug ? null : await cacheGet(flight, FLIGHT_TTL_MS);
    if (cached) return json({ ...cached, cached: true }, 200);

    const api = `https://airlabs.co/api/v9/flights?flight_iata=${encodeURIComponent(flight)}&api_key=${key}`;
    const r = await fetch(api);
    const d = await r.json();
    if (debug) return json({ http: r.status, flight, airlabs_raw: d }, 200);

    const list = Array.isArray(d?.response) ? d.response : (Array.isArray(d) ? d : []);
    const f = list.find((x: any) => typeof x?.lat === "number" && typeof x?.lng === "number") || list[0];

    let payload: Record<string, unknown>;
    if (!f || typeof f.lat !== "number" || typeof f.lng !== "number") {
      payload = { found: false, flight_iata: flight, airlabs_error: d?.error ?? null, count: list.length };
    } else {
      payload = {
        found: true,
        flight_iata: f.flight_iata || flight,
        status: f.status ?? null,
        lat: f.lat,
        lng: f.lng,
        dir: typeof f.dir === "number" ? f.dir : 0,
        alt: f.alt ?? null,
        speed: f.speed ?? null,
        dep_iata: f.dep_iata ?? null,
        arr_iata: f.arr_iata ?? null,
        airline_iata: f.airline_iata ?? null,
        aircraft_icao: f.aircraft_icao ?? null,
        updated: f.updated ?? null,
        dep: await resolveAirport(f.dep_iata, key),
        arr: await resolveAirport(f.arr_iata, key),
      };
    }
    if ((payload as any).found) await cacheSet(flight, payload);
    return json(payload, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

// Координаты аэропорта по IATA-коду (с долгим кэшем — данные статичны)
async function resolveAirport(iata: string | null | undefined, key: string): Promise<Record<string, unknown> | null> {
  try {
    if (!iata) return null;
    const ck = `apt:${iata}`;
    const c = await cacheGet(ck, AIRPORT_TTL_MS);
    if (c) return c;
    const r = await fetch(`https://airlabs.co/api/v9/airports?iata_code=${encodeURIComponent(iata)}&api_key=${key}`);
    const d = await r.json();
    const a = Array.isArray(d?.response) ? d.response[0] : null;
    if (!a || typeof a.lat !== "number" || typeof a.lng !== "number") return null;
    const out = { iata, lat: a.lat, lng: a.lng, name: a.name ?? iata };
    await cacheSet(ck, out);
    return out;
  } catch { return null; }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// ---- Кэш через таблицу public.flight_cache (ключ = номер рейса или apt:КОД). При ошибке тихо пропускаем. ----
function admin(): { base: string; srk: string } | null {
  const base = Deno.env.get("SUPABASE_URL");
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return base && srk ? { base, srk } : null;
}
async function cacheGet(key: string, ttlMs: number): Promise<Record<string, unknown> | null> {
  try {
    const a = admin(); if (!a) return null;
    const res = await fetch(
      `${a.base}/rest/v1/flight_cache?flight_iata=eq.${encodeURIComponent(key)}&select=data,updated_at`,
      { headers: { apikey: a.srk, Authorization: `Bearer ${a.srk}` } },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const row = rows?.[0];
    if (!row) return null;
    if (Date.now() - new Date(row.updated_at).getTime() > ttlMs) return null;
    return row.data;
  } catch { return null; }
}
async function cacheSet(key: string, data: unknown): Promise<void> {
  try {
    const a = admin(); if (!a) return;
    await fetch(`${a.base}/rest/v1/flight_cache`, {
      method: "POST",
      headers: {
        apikey: a.srk,
        Authorization: `Bearer ${a.srk}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ flight_iata: key, data, updated_at: new Date().toISOString() }),
    });
  } catch { /* ignore */ }
}
