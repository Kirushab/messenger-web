// Open-Meteo: бесплатный, без ключа, без регистрации.
// https://open-meteo.com/

export interface DailyWeather {
  date: string; // YYYY-MM-DD
  tMax: number;
  tMin: number;
  precip: number;
  code: number;
}

export interface WeatherResult {
  timezone: string;
  daily: DailyWeather[];
}

// Кэш в localStorage на 6 часов
const CACHE_TTL = 6 * 60 * 60 * 1000;

function cacheKey(lat: number, lng: number, start: string, end: string) {
  return `wx:${lat.toFixed(2)}:${lng.toFixed(2)}:${start}:${end}`;
}

export async function fetchWeather(
  lat: number,
  lng: number,
  startDate: string, // YYYY-MM-DD
  endDate: string,   // YYYY-MM-DD
): Promise<WeatherResult | null> {
  const key = cacheKey(lat, lng, startDate, endDate);

  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) return data;
    }
  } catch {}

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum&timezone=auto&start_date=${startDate}&end_date=${endDate}`;
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tm);
    if (!res.ok) return null;
    const j = await res.json();
    const tz: string = j.timezone || 'UTC';
    const daily: DailyWeather[] = (j?.daily?.time || []).map((d: string, i: number) => ({
      date: d,
      tMax: Math.round(j.daily.temperature_2m_max?.[i] ?? 0),
      tMin: Math.round(j.daily.temperature_2m_min?.[i] ?? 0),
      precip: j.daily.precipitation_sum?.[i] ?? 0,
      code: j.daily.weathercode?.[i] ?? 0,
    }));
    const data: WeatherResult = { timezone: tz, daily };
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
    return data;
  } catch {
    return null;
  }
}

// WMO weather codes → emoji + label
export function weatherIcon(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: '☀️', label: 'Ясно' };
  if (code === 1 || code === 2) return { emoji: '🌤️', label: 'Переменно' };
  if (code === 3) return { emoji: '☁️', label: 'Пасмурно' };
  if (code === 45 || code === 48) return { emoji: '🌫️', label: 'Туман' };
  if (code >= 51 && code <= 57) return { emoji: '🌦️', label: 'Морось' };
  if (code >= 61 && code <= 65) return { emoji: '🌧️', label: 'Дождь' };
  if (code === 66 || code === 67) return { emoji: '🌧️', label: 'Лед. дождь' };
  if (code >= 71 && code <= 77) return { emoji: '❄️', label: 'Снег' };
  if (code >= 80 && code <= 82) return { emoji: '🌧️', label: 'Ливень' };
  if (code >= 85 && code <= 86) return { emoji: '❄️', label: 'Метель' };
  if (code === 95) return { emoji: '⛈️', label: 'Гроза' };
  if (code >= 96 && code <= 99) return { emoji: '⛈️', label: 'Гроза+град' };
  return { emoji: '🌤️', label: '—' };
}

// Получить только таймзону места (для виджета TZ без погоды)
export async function fetchTimezone(lat: number, lng: number): Promise<string | null> {
  const key = `tz:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const { ts, tz } = JSON.parse(cached);
      // TZ кэшируем на 30 дней — почти не меняется
      if (Date.now() - ts < 30 * 24 * 60 * 60 * 1000) return tz;
    }
  } catch {}

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&timezone=auto&daily=temperature_2m_max&start_date=${todayIso()}&end_date=${todayIso()}`;
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tm);
    if (!res.ok) return null;
    const j = await res.json();
    const tz: string = j.timezone || null;
    if (tz) {
      try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), tz })); } catch {}
    }
    return tz;
  } catch {
    return null;
  }
}

function todayIso() { return new Date().toISOString().slice(0, 10); }
