import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { isOwnerEmail } from '@/lib/admin';
import { toast } from '@/stores/toastStore';
import { haptic } from '@/lib/haptics';

const MEDIA_BUCKETS = ['post-media', 'event-photos', 'event-diary'];

function urlToStoragePath(url: string): { bucket: string; path: string } | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  return { bucket: m[1], path: m[2] };
}

async function loadJSZip(): Promise<any> {
  // Не импортируем jszip как npm-зависимость: этот экран использует архиватор
  // только по запросу владельца. Так Vite/Rollup не требует пакет при build,
  // а основной bundle приложения не раздувается.
  const w = window as any;
  if (w.JSZip) return w.JSZip;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-sigmas-jszip]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Не удалось загрузить JSZip')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.async = true;
    script.dataset.sigmasJszip = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Не удалось загрузить JSZip'));
    document.head.appendChild(script);
  });

  if (!w.JSZip) throw new Error('JSZip не инициализировался');
  return w.JSZip;
}

async function listBucket(bucket: string): Promise<string[]> {
  const acc: string[] = [];
  async function walk(prefix = '') {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    for (const item of data || []) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if ((item as any).id || (item as any).metadata) acc.push(full);
      else await walk(full);
    }
  }
  await walk('');
  return acc;
}

export default function AdminData() {
  const nav = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user && !isOwnerEmail(user.email)) nav(-1);
  }, [user, nav]);

  const defaultCutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();

  const [cutoff, setCutoff] = useState(defaultCutoff);
  const [preview, setPreview] = useState<{ count: number; pinned: number } | null>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cleanResult, setCleanResult] = useState<{ deleted: number; filesDeleted: number; filesFailed: number } | null>(null);

  const cutoffIso = cutoff ? `${cutoff}T23:59:59Z` : null;

  const runPreview = async () => {
    if (!cutoffIso) return;
    setLoadingPrev(true);
    setPreview(null);
    setCleanResult(null);
    const { data, error } = await supabase.rpc('admin_stories_cleanup_preview', { cutoff_date: cutoffIso });
    setLoadingPrev(false);
    if (error) {
      toast.error('Ошибка: ' + error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setPreview({ count: Number(row?.story_count || 0), pinned: Number(row?.pinned_kept || 0) });
  };

  const runClean = async () => {
    if (!cutoffIso) return;
    setCleaning(true);
    setConfirming(false);
    const { data, error } = await supabase.rpc('admin_stories_cleanup_execute', { cutoff_date: cutoffIso });
    if (error) {
      setCleaning(false);
      toast.error('Ошибка: ' + error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const deleted = Number(row?.deleted || 0);
    const paths: string[] = row?.paths || [];

    const byBucket = new Map<string, string[]>();
    for (const p of paths) {
      let bucket = 'post-media', path = p;
      if (/^https?:\/\//.test(p)) {
        const parsed = urlToStoragePath(p);
        if (!parsed) continue;
        bucket = parsed.bucket;
        path = parsed.path;
      }
      if (!byBucket.has(bucket)) byBucket.set(bucket, []);
      byBucket.get(bucket)!.push(path);
    }

    let filesDeleted = 0, filesFailed = 0;
    for (const [bucket, list] of byBucket) {
      for (let i = 0; i < list.length; i += 100) {
        const batch = list.slice(i, i + 100);
        const { error: stErr } = await supabase.storage.from(bucket).remove(batch);
        if (stErr) filesFailed += batch.length; else filesDeleted += batch.length;
      }
    }

    setCleaning(false);
    setPreview(null);
    setCleanResult({ deleted, filesDeleted, filesFailed });
    toast.success('Истории очищены');
  };

  const [exporting, setExporting] = useState(false);
  const [expStatus, setExpStatus] = useState('');
  const [expProgress, setExpProgress] = useState<{ done: number; total: number } | null>(null);

  const runExport = async () => {
    setExporting(true);
    setExpStatus('Загружаю архиватор…');
    setExpProgress(null);
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();

      setExpStatus('Сканирую медиа…');
      const all: { bucket: string; path: string }[] = [];
      for (const bucket of MEDIA_BUCKETS) {
        const paths = await listBucket(bucket);
        for (const p of paths) all.push({ bucket, path: p });
      }
      if (!all.length) {
        setExporting(false);
        toast.error('Медиа не найдено (или нет доступа к бакетам)');
        return;
      }

      let done = 0, failed = 0;
      setExpProgress({ done: 0, total: all.length });
      for (const f of all) {
        try {
          const { data } = supabase.storage.from(f.bucket).getPublicUrl(f.path);
          const resp = await fetch(data.publicUrl);
          if (!resp.ok) failed++;
          else zip.file(`${f.bucket}/${f.path}`, await resp.blob());
        } catch {
          failed++;
        }
        done++;
        if (done % 3 === 0 || done === all.length) setExpProgress({ done, total: all.length });
      }

      setExpStatus('Упаковываю архив…');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `media-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExpStatus(`Готово: ${all.length - failed} файлов${failed ? `, не скачалось ${failed}` : ''}`);
      toast.success('Архив выгружен');
    } catch (e: any) {
      toast.error('Ошибка выгрузки: ' + (e?.message || ''));
      setExpStatus('');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="admin-tool-page">
      <header className="admin-tool-header safe-top-sm">
        <button onClick={() => nav(-1)} className="admin-tool-back" aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1>Данные и истории</h1>
          <p>Очистка историй · выгрузка медиа</p>
        </div>
      </header>

      <div className="admin-tool-scroll page-scroll">
        <div className="admin-tool-shell">
          <section className="admin-tool-card">
            <h2 style={{ marginBottom: 6 }}>Очистка историй</h2>
            <div className="admin-tool-muted" style={{ marginBottom: 14 }}>
              Удаляет истории всех пользователей, созданные до выбранной даты. Закреплённые «в профиле» сохраняются.
            </div>

            <div className="admin-date-wrap">
              <div className="admin-field-label">Удалять истории до</div>
              <input
                className="admin-date-input"
                type="date"
                value={cutoff}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => { setCutoff(e.target.value); setPreview(null); setCleanResult(null); }}
              />
            </div>

            <button onClick={() => { haptic.tap(); runPreview(); }} disabled={loadingPrev || cleaning} className="admin-tool-button-secondary" style={{ marginBottom: 12 }}>
              {loadingPrev ? 'Считаю…' : 'Посчитать'}
            </button>

            {preview && (
              <div className="admin-tool-result" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '14px' }}>Будет удалено историй: <b style={{ color: '#EF4444' }}>{preview.count}</b></div>
                {preview.pinned > 0 && <div className="admin-date-note" style={{ marginTop: 5 }}>Сохранится (закреплены в профиле): {preview.pinned}</div>}
              </div>
            )}

            {preview && preview.count > 0 && !confirming && !cleaning && (
              <button onClick={() => { haptic.tap(); setConfirming(true); }} className="admin-tool-button-danger">Удалить {preview.count}</button>
            )}

            {confirming && (
              <div className="admin-tool-result danger">
                <div className="admin-tool-muted" style={{ marginBottom: 12 }}>Это действие удалит найденные истории и их файлы из storage. Отменить после выполнения нельзя.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button onClick={() => { haptic.tap(); setConfirming(false); }} className="admin-tool-button-secondary">Отмена</button>
                  <button onClick={() => { haptic.tap(); runClean(); }} className="admin-tool-button-danger">Точно удалить</button>
                </div>
              </div>
            )}

            {cleaning && <div className="admin-tool-muted" style={{ textAlign: 'center', paddingTop: 8 }}>Удаляю…</div>}
            {cleanResult && (
              <div className="admin-tool-result success" style={{ marginTop: 12 }}>
                Удалено историй: <b>{cleanResult.deleted}</b><br/>
                Файлов удалено: <b>{cleanResult.filesDeleted}</b>
                {cleanResult.filesFailed > 0 && <span style={{ color: '#EF4444' }}><br/>Не удалось удалить файлов: {cleanResult.filesFailed}</span>}
              </div>
            )}
          </section>

          <section className="admin-tool-card">
            <h2 style={{ marginBottom: 6 }}>Выгрузка медиа в архив</h2>
            <div className="admin-tool-muted" style={{ marginBottom: 14 }}>
              Скачивает все медиа из ленты, событий и историй (бакеты <code>post-media</code>, <code>event-photos</code>, <code>event-diary</code>) одним ZIP. Чаты не включаются. На больших объёмах архив собирается в памяти браузера и может занять время.
            </div>
            <button onClick={() => { haptic.tap(); runExport(); }} disabled={exporting} className="admin-tool-button" style={blueButton}>
              {exporting ? 'Выгружаю…' : 'Скачать архив'}
            </button>
            {(expStatus || expProgress) && (
              <div style={{ marginTop: 12 }}>
                {expStatus && <div className="admin-tool-muted" style={{ marginBottom: 6 }}>{expStatus}</div>}
                {expProgress && (
                  <>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-light)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round((expProgress.done / expProgress.total) * 100)}%`, background: '#0EA5E9', transition: 'width 0.2s' }} />
                    </div>
                    <div className="admin-date-note">{expProgress.done} / {expProgress.total}</div>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const blueButton: CSSProperties = { background: '#0EA5E9', boxShadow: '0 14px 28px rgba(14,165,233,.22)' };
