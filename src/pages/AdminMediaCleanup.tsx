// Админ-панель массовой очистки медиа из чатов.
// Доступна только владельцу проекта (защищено и на клиенте, и в SECURITY DEFINER RPC).
// Удаляет сообщения с вложениями старше выбранной даты + чистит файлы из storage.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { isOwnerEmail } from '@/lib/admin';
import { toast } from '@/stores/toastStore';
import { haptic } from '@/lib/haptics';

interface Preview {
  message_count: number;
  attachment_count: number;
}

function urlToStoragePath(url: string): { bucket: string; path: string } | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  return { bucket: m[1], path: m[2] };
}

export default function AdminMediaCleanup() {
  const nav = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user && !isOwnerEmail(user.email)) nav(-1);
  }, [user, nav]);

  const defaultCutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  const [cutoff, setCutoff] = useState(defaultCutoff);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastResult, setLastResult] = useState<{ messages: number; storageDeleted: number; storageFailed: number } | null>(null);

  const cutoffIso = cutoff ? `${cutoff}T23:59:59Z` : null;

  const runPreview = async () => {
    if (!cutoffIso) return;
    setLoadingPreview(true);
    setPreview(null);
    setLastResult(null);
    const { data, error } = await supabase.rpc('admin_preview_chat_media_cleanup', { cutoff_date: cutoffIso });
    setLoadingPreview(false);
    if (error) {
      toast.error('Ошибка: ' + error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setPreview({
      message_count: Number(row?.message_count || 0),
      attachment_count: Number(row?.attachment_count || 0),
    });
  };

  const runExecute = async () => {
    if (!cutoffIso || !preview || executing) return;
    setExecuting(true);
    setConfirming(false);
    setProgress(null);

    const { data, error } = await supabase.rpc('admin_execute_chat_media_cleanup', { cutoff_date: cutoffIso });
    if (error) {
      setExecuting(false);
      toast.error('Ошибка: ' + error.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const deletedMessages = Number(row?.deleted_messages || 0);
    const fileUrls: string[] = row?.file_urls || [];

    const byBucket = new Map<string, string[]>();
    for (const u of fileUrls) {
      const parsed = urlToStoragePath(u);
      if (!parsed) continue;
      if (!byBucket.has(parsed.bucket)) byBucket.set(parsed.bucket, []);
      byBucket.get(parsed.bucket)!.push(parsed.path);
    }

    const totalFiles = Array.from(byBucket.values()).reduce((a, b) => a + b.length, 0);
    setProgress({ done: 0, total: totalFiles });

    let okCount = 0;
    let failCount = 0;

    for (const [bucket, paths] of byBucket) {
      for (let i = 0; i < paths.length; i += 100) {
        const batch = paths.slice(i, i + 100);
        const { error: stErr } = await supabase.storage.from(bucket).remove(batch);
        if (stErr) {
          failCount += batch.length;
          console.error(`storage.remove (${bucket}) error:`, stErr);
        } else {
          okCount += batch.length;
        }
        setProgress(p => p ? { ...p, done: p.done + batch.length } : null);
      }
    }

    setExecuting(false);
    setProgress(null);
    setPreview(null);
    setLastResult({ messages: deletedMessages, storageDeleted: okCount, storageFailed: failCount });
    toast.success(`Удалено сообщений: ${deletedMessages}, файлов: ${okCount}${failCount > 0 ? ` (ошибок: ${failCount})` : ''}`);
  };

  return (
    <div className="admin-tool-page">
      <header className="admin-tool-header safe-top-sm">
        <button onClick={() => nav(-1)} className="admin-tool-back" aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1>Чистка медиа</h1>
          <p>Удаление сообщений с вложениями старше даты</p>
        </div>
      </header>

      <div className="admin-tool-scroll page-scroll">
        <div className="admin-tool-shell">
          <div className="admin-tool-danger">
            <b>⚠️ Опасная операция</b>
            <div>Удаляются сообщения <strong>всех пользователей во всех чатах</strong> с вложениями (фото, видео, голосовые, файлы), созданные <strong>до выбранной даты включительно</strong>. Восстановить нельзя.</div>
          </div>

          <section className="admin-tool-card">
            <div className="admin-date-wrap">
              <div className="admin-field-label">Удалять сообщения до</div>
              <input
                className="admin-date-input"
                type="date"
                value={cutoff}
                onChange={e => { setCutoff(e.target.value); setPreview(null); setLastResult(null); }}
                max={new Date().toISOString().slice(0, 10)}
              />
              <div className="admin-date-note">Включительно до 23:59 указанного дня</div>
            </div>

            <button onClick={() => { haptic.tap(); runPreview(); }} disabled={!cutoffIso || loadingPreview || executing} className="admin-tool-button-secondary" style={{ marginBottom: 12 }}>
              {loadingPreview ? 'Считаем…' : 'Посмотреть сколько удалится'}
            </button>

            {preview && (
              <div className="admin-tool-result" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: 8 }}>Будет удалено:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                  <span style={{ fontSize: '14px' }}>Сообщений</span>
                  <strong style={{ color: '#EF4444', fontSize: '16px' }}>{preview.message_count}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: '14px' }}>Файлов</span>
                  <strong style={{ color: '#EF4444', fontSize: '16px' }}>{preview.attachment_count}</strong>
                </div>
              </div>
            )}

            {preview && preview.message_count > 0 && !confirming && (
              <button onClick={() => { haptic.tap(); setConfirming(true); }} disabled={executing} className="admin-tool-button-danger">
                Удалить {preview.message_count} сообщений
              </button>
            )}

            {confirming && preview && (
              <div className="admin-tool-result danger">
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Подтверждение удаления</div>
                <div className="admin-tool-muted" style={{ marginBottom: 12 }}>
                  Будут удалены <b>{preview.message_count}</b> сообщений и до <b>{preview.attachment_count}</b> файлов. Это действие необратимо.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button onClick={() => { haptic.tap(); setConfirming(false); }} className="admin-tool-button-secondary">Отмена</button>
                  <button onClick={() => { haptic.tap(); runExecute(); }} className="admin-tool-button-danger">Точно удалить</button>
                </div>
              </div>
            )}

            {executing && (
              <div className="admin-tool-muted" style={{ textAlign: 'center', marginTop: 12 }}>
                Удаляем сообщения и очищаем файлы…
              </div>
            )}
            {progress && (
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-light)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`, background: '#EF4444', transition: 'width .2s ease' }} />
                </div>
                <div className="admin-date-note" style={{ textAlign: 'center' }}>{progress.done} / {progress.total}</div>
              </div>
            )}

            {lastResult && (
              <div className="admin-tool-result success" style={{ marginTop: 12 }}>
                Удалено сообщений: <b>{lastResult.messages}</b><br/>
                Удалено файлов: <b>{lastResult.storageDeleted}</b>
                {lastResult.storageFailed > 0 && <span style={{ color: '#EF4444' }}><br/>Ошибок при удалении файлов: {lastResult.storageFailed}</span>}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
