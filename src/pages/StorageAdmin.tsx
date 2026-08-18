import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { isOwnerEmail } from '@/lib/admin';

// Supabase Pro: 8 ГБ Postgres + 100 ГБ файловое хранилище.
// Если вернёмся на Free — DB лимит 500 МБ, файлы 1 ГБ.
const PLAN_LIMIT_BYTES = 8 * 1024 * 1024 * 1024;       // DB
const PLAN_STORAGE_LIMIT = 100 * 1024 * 1024 * 1024;   // Files (Supabase Pro)
const PLAN_NAME = 'Pro';

interface TableRow { name: string; bytes: number; pretty: string; }
interface SizeData { total_bytes: number; total_pretty: string; tables: TableRow[]; }

interface BucketRow { bucket_id: string; total_bytes: number; pretty_size: string; file_count: number; }

function fmtBytes(b: number): string {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
  return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export default function StorageAdmin() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const [data, setData] = useState<SizeData | null>(null);
  const [buckets, setBuckets] = useState<BucketRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Защита на клиенте, на сервере SECURITY DEFINER также проверяет email
  useEffect(() => {
    if (user && !isOwnerEmail(user.email)) nav('/apps');
  }, [user?.email]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Параллельно — БД и бакеты. Если бакеты упадут (нет RPC) — это ок,
      // покажем только БД с предупреждением.
      const [dbRes, bucketsRes] = await Promise.all([
        supabase.rpc('get_database_size'),
        supabase.rpc('get_storage_buckets_size'),
      ]);
      if (dbRes.error) throw dbRes.error;
      setData(dbRes.data as SizeData);
      if (!bucketsRes.error) {
        setBuckets((bucketsRes.data || []) as BucketRow[]);
      } else {
        // RPC ещё не накатили — не показываем секцию файлов
        console.warn('get_storage_buckets_size not available:', bucketsRes.error.message);
        setBuckets(null);
      }
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const usedPct = data ? Math.min(100, (data.total_bytes / PLAN_LIMIT_BYTES) * 100) : 0;
  const isNearLimit = usedPct > 80;
  const isOver = usedPct > 100;

  // Суммарный размер файлов и процент
  const totalFileBytes = buckets ? buckets.reduce((s, b) => s + b.total_bytes, 0) : 0;
  const filesPct = Math.min(100, (totalFileBytes / PLAN_STORAGE_LIMIT) * 100);
  const filesNear = filesPct > 80;
  const filesOver = filesPct > 100;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px',
        paddingTop: 'max(10px, env(safe-area-inset-top, 10px))',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', fontSize: 'var(--fs-title)', cursor: 'pointer', color: 'var(--text)', padding: 4 }}>‹</button>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-heading)', fontWeight: 600, flex: 1 }}>Хранилище</h2>
        <button onClick={load} disabled={loading} style={{ background: 'var(--surface-light)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 'var(--fs-label)', color: 'var(--text)', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
          ↻
        </button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        {loading && !data && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Загрузка…</div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', padding: 14, borderRadius: 10, fontSize: 'var(--fs-label)' }}>
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Главный прогресс-бар */}
            <div style={{ background: 'var(--surface-light)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                База данных · план {PLAN_NAME}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{data.total_pretty}</div>
                <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)' }}>/ {fmtBytes(PLAN_LIMIT_BYTES)}</div>
              </div>
              <div style={{ height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: usedPct + '%',
                  height: '100%',
                  background: isOver ? '#EF4444' : isNearLimit ? '#F59E0B' : '#10B981',
                  transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                }} />
              </div>
              <div style={{ marginTop: 8, fontSize: 'var(--fs-caption)', color: isNearLimit ? '#F59E0B' : 'var(--muted)' }}>
                {usedPct.toFixed(1)}% использовано
                {isNearLimit && !isOver && ' · приближается к лимиту, добавлять данные осторожно'}
                {isOver && ' · превышен лимит Pro — связаться с поддержкой Supabase или чистить данные'}
              </div>
            </div>

            {/* Таблицы по размеру */}
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 4px 8px' }}>
              Крупнейшие таблицы
            </div>
            <div style={{ background: 'var(--surface-light)', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
              {data.tables.map((t, i) => (
                <div key={t.name} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.name}
                    </div>
                    <div style={{ height: 4, background: 'var(--surface)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{
                        width: Math.min(100, (t.bytes / data.tables[0].bytes) * 100) + '%',
                        height: '100%',
                        background: 'var(--text)',
                        opacity: 0.7,
                      }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {t.pretty}
                  </div>
                </div>
              ))}
            </div>

            {/* === Файловое хранилище === */}
            {buckets && (
              <>
                <div style={{ background: 'var(--surface-light)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Файлы · фото, аудио, бэкграунды
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{fmtBytes(totalFileBytes)}</div>
                    <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)' }}>/ {fmtBytes(PLAN_STORAGE_LIMIT)}</div>
                  </div>
                  <div style={{ height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: filesPct + '%',
                      height: '100%',
                      background: filesOver ? '#EF4444' : filesNear ? '#F59E0B' : '#3B82F6',
                      transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 'var(--fs-caption)', color: filesNear ? '#F59E0B' : 'var(--muted)' }}>
                    {filesPct.toFixed(2)}% использовано
                    {!filesNear && ` · осталось ${fmtBytes(PLAN_STORAGE_LIMIT - totalFileBytes)}`}
                    {filesNear && !filesOver && ' · приближается к лимиту'}
                    {filesOver && ' · превышен лимит файлового хранилища Pro'}
                  </div>
                </div>

                {buckets.length > 0 && (
                  <>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 4px 8px' }}>
                      Бакеты по размеру
                    </div>
                    <div style={{ background: 'var(--surface-light)', borderRadius: 14, overflow: 'hidden' }}>
                      {buckets.map((b, i) => (
                        <div key={b.bucket_id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px',
                          borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {b.bucket_id}
                            </div>
                            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 2 }}>
                              {b.file_count} {b.file_count === 1 ? 'файл' : b.file_count < 5 ? 'файла' : 'файлов'}
                            </div>
                            {buckets[0].total_bytes > 0 && (
                              <div style={{ height: 4, background: 'var(--surface)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                                <div style={{
                                  width: Math.min(100, (b.total_bytes / buckets[0].total_bytes) * 100) + '%',
                                  height: '100%',
                                  background: '#3B82F6',
                                  opacity: 0.7,
                                }} />
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {b.pretty_size}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {buckets.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-label)', padding: 16 }}>
                    Файлов пока нет
                  </div>
                )}
              </>
            )}

            {!buckets && (
              <div style={{ marginTop: 12, fontSize: 'var(--fs-micro)', color: 'var(--muted)', textAlign: 'center' }}>
                Storage buckets ещё не подключены. Накати миграцию 071_storage_buckets_size.sql.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
