import { SUPABASE_CONFIG_ERROR, SUPABASE_PROXY_URL, SUPABASE_DIRECT_URL } from '@/lib/supabase';

export default function SupabaseConfigScreen() {
  const hasProxy = Boolean(SUPABASE_PROXY_URL);
  const hasDirect = Boolean(SUPABASE_DIRECT_URL);

  return (
    <div style={{
      minHeight: '100dvh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(circle at top, rgba(124,77,255,.20), transparent 42%), #050507',
      color: '#fff',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: 'min(560px, 100%)',
        border: '1px solid rgba(255,255,255,.12)',
        borderRadius: 28,
        padding: 24,
        background: 'rgba(18,18,24,.78)',
        boxShadow: '0 24px 80px rgba(0,0,0,.45)',
        backdropFilter: 'blur(18px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, #7C4DFF, #23C6FF)',
          }}>
            <img src="/logo-mark.svg" alt="" style={{ width: 30, height: 30 }} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-title)', fontWeight: 800, letterSpacing: '-.03em' }}>Sigmas не запустился</div>
            <div style={{ color: 'rgba(255,255,255,.62)', fontSize: 'var(--fs-snap14)' }}>Нужно настроить Supabase env-переменные</div>
          </div>
        </div>

        <div style={{
          border: '1px solid rgba(239,68,68,.28)',
          background: 'rgba(239,68,68,.10)',
          borderRadius: 16,
          padding: 14,
          color: '#fecaca',
          marginBottom: 16,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 'var(--fs-caption)',
          lineHeight: 1.45,
          wordBreak: 'break-word',
        }}>
          {SUPABASE_CONFIG_ERROR || 'Supabase не настроен.'}
        </div>

        <p style={{ margin: '0 0 14px', color: 'rgba(255,255,255,.72)', lineHeight: 1.55, fontSize: 'var(--fs-body)' }}>
          На Cloudflare переменные Vite должны быть заданы именно в настройках билда/деплоя,
          потому что они встраиваются в JS во время <b>npm run build</b>.
        </p>

        <div style={{
          background: 'rgba(0,0,0,.34)',
          border: '1px solid rgba(255,255,255,.10)',
          borderRadius: 16,
          padding: 14,
          overflowX: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 'var(--fs-caption)',
          lineHeight: 1.6,
          color: 'rgba(255,255,255,.86)',
          marginBottom: 16,
        }}>
          <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
          <div>VITE_SUPABASE_ANON_KEY=your-public-anon-key</div>
          <div>VITE_SUPABASE_PROXY_URL=https://your-proxy.example.com</div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}>
          <div style={{ border: '1px solid rgba(255,255,255,.10)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 'var(--fs-micro)', color: 'rgba(255,255,255,.50)', marginBottom: 4 }}>Direct URL</div>
            <div style={{ fontWeight: 700 }}>{hasDirect ? 'задан' : 'не задан'}</div>
          </div>
          <div style={{ border: '1px solid rgba(255,255,255,.10)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 'var(--fs-micro)', color: 'rgba(255,255,255,.50)', marginBottom: 4 }}>Proxy URL</div>
            <div style={{ fontWeight: 700 }}>{hasProxy ? 'задан' : 'не задан'}</div>
          </div>
        </div>

        <button
          onClick={() => window.location.reload()}
          style={{
            width: '100%',
            border: 0,
            borderRadius: 14,
            padding: '13px 16px',
            color: '#fff',
            background: 'linear-gradient(135deg, #7C4DFF, #23C6FF)',
            fontWeight: 800,
            fontSize: 'var(--fs-body)',
            cursor: 'pointer',
          }}
        >Перезагрузить после настройки</button>
      </div>
    </div>
  );
}
