import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAppearance, saveAppearance, resetAppearance, AppearanceSettings, TextSize } from '@/lib/appearance';
import { haptic } from '@/lib/haptics';

const TEXT_SIZES: { value: TextSize; label: string; px: number }[] = [
  { value: 'small',  label: 'Малый',     px: 13 },
  { value: 'normal', label: 'Системный', px: 14 },
  { value: 'large',  label: 'Большой',   px: 16 },
  { value: 'xlarge', label: 'Огромный',  px: 18 },
];

interface ThemePreset {
  name: string; gradient: string; accent: string; recv: string; icon: 'sunset'|'ocean'|'forest'|'lilac'|'sakura'|'mint'|'coffee'|'amber'|'graphite'|'neon'|'cherry'|'midnight'; borderColor: string;
}
const PRESETS: ThemePreset[] = [
  { name: 'Закат',   gradient: 'linear-gradient(135deg, #FF6B35 0%, #F7286E 100%)', accent: '#FF6B35', recv: '#27272A', icon: 'sunset', borderColor: '#FF6B35' },
  { name: 'Океан',   gradient: 'linear-gradient(135deg, #2E5BFF 0%, #00D4FF 100%)', accent: '#2E5BFF', recv: '#1E293B', icon: 'ocean', borderColor: '#00D4FF' },
  { name: 'Лес',     gradient: 'linear-gradient(135deg, #0F9B6E 0%, #6BD9A7 100%)', accent: '#0F9B6E', recv: '#1F2937', icon: 'forest', borderColor: '#6BD9A7' },
  { name: 'Сирень',  gradient: 'linear-gradient(135deg, #A55EEA 0%, #F7B0E8 100%)', accent: '#A55EEA', recv: '#27272A', icon: 'lilac', borderColor: '#A55EEA' },
  { name: 'Сакура',  gradient: 'linear-gradient(135deg, #FF4D8D 0%, #FF92BA 100%)', accent: '#FF4D8D', recv: '#27272A', icon: 'sakura', borderColor: '#FF4D8D' },
  { name: 'Мята',    gradient: 'linear-gradient(135deg, #0BBCBC 0%, #4FE6E6 100%)', accent: '#0BBCBC', recv: '#1F2937', icon: 'mint', borderColor: '#4FE6E6' },
  { name: 'Кофе',    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #C4B5FD 100%)', accent: '#8B5CF6', recv: '#292524', icon: 'coffee', borderColor: '#8B5CF6' },
  { name: 'Янтарь',  gradient: 'linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%)', accent: '#F59E0B', recv: '#27272A', icon: 'amber', borderColor: '#F59E0B' },
  { name: 'Графит',  gradient: 'linear-gradient(135deg, #475569 0%, #94A3B8 100%)', accent: '#64748B', recv: '#1E293B', icon: 'graphite', borderColor: '#94A3B8' },
  { name: 'Неон',    gradient: 'linear-gradient(135deg, #6C5CE7 0%, #00D2D3 100%)', accent: '#6C5CE7', recv: '#1E1B4B', icon: 'neon', borderColor: '#00D2D3' },
  { name: 'Вишня',   gradient: 'linear-gradient(135deg, #DC2626 0%, #FB7185 100%)', accent: '#DC2626', recv: '#27272A', icon: 'cherry', borderColor: '#FB7185' },
  { name: 'Полночь', gradient: 'linear-gradient(135deg, #312E81 0%, #6366F1 100%)', accent: '#6366F1', recv: '#1E1B4B', icon: 'midnight', borderColor: '#6366F1' },
];

const ACCENT_SWATCHES = ['#10B981', '#2E5BFF', '#FF6B35', '#A55EEA', '#FF4D8D', '#F59E0B', '#0BBCBC', '#6366F1'];
const SENT_SWATCHES   = ['#10B981', '#2E5BFF', '#7C3AED', '#FF6B35', '#EC4899', '#0EA5E9', '#F59E0B', '#64748B'];
const RECV_SWATCHES   = ['#27272A', '#1F2937', '#1E293B', '#292524', '#3F3F46', '#1E1B4B'];

export default function Appearance() {
  const navigate = useNavigate();
  const [s, setS] = useState<AppearanceSettings>(() => loadAppearance());
  const [pulse, setPulse] = useState(0);
  const [dice, setDice] = useState(0);

  useEffect(() => { saveAppearance(s); }, [s]);

  const update = (patch: Partial<AppearanceSettings>) => {
    setS(prev => ({ ...prev, ...patch }));
    setPulse(p => p + 1);
  };

  const applyPreset = (p: ThemePreset) => {
    haptic.select();
    update({ accentColor: p.accent, sentColor: null, recvColor: p.recv, bubbleGradient: p.gradient });
  };
  const isPresetActive = (p: ThemePreset) => s.bubbleGradient === p.gradient && s.accentColor === p.accent;

  const randomTheme = () => {
    haptic.select();
    setDice(d => d + 1);
    const pool = PRESETS.filter(p => !isPresetActive(p));
    const pick = pool[Math.floor(Math.random() * pool.length)] || PRESETS[0];
    applyPreset(pick);
  };

  const radiusPct = ((s.bubbleRadius - 4) / 20) * 100;

  return (
    <div className="appearance-page apple-appearance" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header (sticky blur) */}
      <div className="appr-head safe-top" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => navigate(-1)} className="tap-effect appearance-nav-btn" style={{
          width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--surface-light)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)',
        }} aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 600 }}>Оформление</div>
          <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 2 }}>Темы и внешний вид чатов</div>
        </div>
      </div>

      <div className="appearance-scroll" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))' }}>
        {/* Live preview */}
        <div className="appr-in appearance-preview-card" style={{ padding: 16, background: 'linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid var(--border)' }}>
          <div className="appr-bubble appr-bubble-pop" key={'r' + pulse} style={{
            alignSelf: 'flex-start', background: 'var(--msg-recv)', color: 'var(--msg-recv-text)',
            padding: '7px 11px', borderRadius: 'var(--bubble-radius, 18px)', borderBottomLeftRadius: 'var(--bubble-tail-radius, 6px)',
            fontSize: 'var(--font-size-base, 14px)', maxWidth: '75%', border: '0.5px solid var(--border)',
          }}>
            Привет! Как дела?
          </div>
          <div className="appr-bubble" style={{
            alignSelf: 'flex-start', background: 'var(--msg-recv)',
            padding: '9px 12px', borderRadius: 'var(--bubble-radius, 18px)', borderBottomLeftRadius: 'var(--bubble-tail-radius, 6px)',
            border: '0.5px solid var(--border)',
          }}>
            <span className="appr-typing"><i /><i /><i /></span>
          </div>
          <div className="appr-bubble appr-bubble-pop" key={'s' + pulse} style={{
            alignSelf: 'flex-end', background: 'var(--msg-sent)', color: 'var(--msg-sent-text)',
            padding: '7px 11px', borderRadius: 'var(--bubble-radius, 18px)', borderBottomRightRadius: 'var(--bubble-tail-radius, 6px)',
            fontSize: 'var(--font-size-base, 14px)', maxWidth: '75%',
          }}>
            Отлично! Это живое превью оформления
          </div>
        </div>

        {/* Цветовая тема */}
        <Section title="ЦВЕТОВАЯ ТЕМА">
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px 16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any, scrollbarWidth: 'none' as any }}>
            {PRESETS.map(p => {
              const active = isPresetActive(p);
              return (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className={'appr-preset' + (active ? ' active' : '')}
                  style={{
                    flexShrink: 0, width: 96, height: 132, borderRadius: 14, padding: 0, cursor: 'pointer',
                    background: '#0a0a0a', position: 'relative', overflow: 'hidden',
                    border: active ? `2.5px solid ${p.borderColor}` : '2px solid transparent',
                    boxShadow: active ? `0 6px 20px -4px ${p.borderColor}88` : 'none',
                  }}
                  aria-label={p.name}
                >
                  <span className="appr-shine" />
                  <div style={{ position: 'absolute', top: 14, right: 10, width: 60, height: 18, borderRadius: 9, background: p.gradient }} />
                  <div style={{ position: 'absolute', top: 38, left: 10, width: 56, height: 18, borderRadius: 9, background: p.recv }} />
                  <div style={{ position: 'absolute', bottom: 27, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}><PresetGlyph icon={p.icon} color={p.borderColor} /></div>
                  <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 'var(--fs-micro)', color: active ? p.borderColor : 'var(--muted)', fontWeight: active ? 700 : 500 }}>{p.name}</div>
                  {active && (
                    <span className="appr-check" style={{
                      position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: 10,
                      background: p.borderColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, boxShadow: '0 2px 6px rgba(0,0,0,.4)',
                    }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Размер текста */}
        <Section title="РАЗМЕР ТЕКСТА">
          <div style={{ display: 'flex', gap: 6, padding: '12px 14px 14px' }}>
            {TEXT_SIZES.map(t => {
              const on = s.textSize === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => { haptic.select(); update({ textSize: t.value }); }}
                  className="appr-chip"
                  style={{
                    flex: 1, minWidth: 0, padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                    border: on ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: on ? 'var(--accent)' : 'transparent',
                    color: on ? 'var(--bg)' : 'var(--text)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  }}
                >
                  <span style={{ fontSize: t.px, fontWeight: on ? 700 : 600, lineHeight: 1 }}>Aa</span>
                  <span style={{ fontSize: 'var(--fs-micro)', fontWeight: on ? 700 : 500, whiteSpace: 'nowrap', opacity: 0.85 }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Закругление */}
        <Section title="ЗАКРУГЛЕНИЕ СООБЩЕНИЙ">
          <div style={{ padding: '14px 16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>Острые</span>
              <input
                type="range" min={4} max={24} step={1} value={s.bubbleRadius}
                onChange={e => update({ bubbleRadius: parseInt(e.target.value, 10) })}
                className="appr-range"
                style={{ flex: 1, ['--fillpct' as any]: radiusPct + '%' }}
              />
              <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>Круглые</span>
            </div>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <span className="appr-badge pop" key={s.bubbleRadius}>{s.bubbleRadius}px</span>
            </div>
          </div>
        </Section>

        {/* Цвет акцента */}
        <Section title="ЦВЕТ АКЦЕНТА">
          <SwatchRow value={s.accentColor} options={ACCENT_SWATCHES} onChange={(v) => update({ accentColor: v })} />
        </Section>

        {/* Цвет моих сообщений */}
        <Section title="ЦВЕТ МОИХ СООБЩЕНИЙ">
          <SwatchRow value={s.bubbleGradient ? null : s.sentColor} options={SENT_SWATCHES} onChange={(v) => update({ sentColor: v, bubbleGradient: null })} />
        </Section>

        {/* Цвет чужих сообщений */}
        <Section title="ЦВЕТ ЧУЖИХ СООБЩЕНИЙ">
          <SwatchRow value={s.recvColor} options={RECV_SWATCHES} onChange={(v) => update({ recvColor: v })} />
        </Section>

        {/* Actions */}
        <div className="appearance-bottom-actions" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <button
            onClick={() => { haptic.select(); randomTheme(); }}
            className="tap-effect appearance-action-primary"
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 16, border: 'none',
              background: 'var(--accent)',
              color: '#fff', cursor: 'pointer', fontSize: 'var(--fs-snap14)', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 10px 24px color-mix(in srgb, var(--accent) 34%, transparent)',
            }}
          >
            <span className="appr-dice roll" key={dice} style={{ display: 'inline-flex' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg></span>
            Случайная тема
          </button>
          <button
            onClick={() => { haptic.select(); resetAppearance(); setS(loadAppearance()); setPulse(p => p + 1); }}
            className="tap-effect appearance-action-secondary"
            style={{
              width: '100%', padding: '13px 16px', borderRadius: 16, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 'var(--fs-snap14)', fontWeight: 600,
            }}
          >
            Сбросить к стандартным
          </button>
        </div>
      </div>
    </div>
  );
}


function PresetGlyph({ icon, color }: { icon: ThemePreset['icon']; color: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (icon) {
    case 'sunset': return <svg className="appr-preset-glyph" viewBox="0 0 24 24"><path {...common} d="M4 18h16"/><path {...common} d="M7 18a5 5 0 0 1 10 0"/><path {...common} d="M12 4v3M5.6 8.2l2.1 2.1M18.4 8.2l-2.1 2.1"/></svg>;
    case 'ocean': return <svg className="appr-preset-glyph" viewBox="0 0 24 24"><path {...common} d="M3 15c3 0 3-2 6-2s3 2 6 2 3-2 6-2"/><path {...common} d="M3 19c3 0 3-2 6-2s3 2 6 2 3-2 6-2"/><path {...common} d="M7 8c2-2 5-2 7 0"/></svg>;
    case 'forest': return <svg className="appr-preset-glyph" viewBox="0 0 24 24"><path {...common} d="m12 3 6 8h-4l4 6H6l4-6H6z"/><path {...common} d="M12 17v4"/></svg>;
    case 'lilac': return <svg className="appr-preset-glyph" viewBox="0 0 24 24"><path {...common} d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z"/></svg>;
    case 'sakura': return <svg className="appr-preset-glyph" viewBox="0 0 24 24"><path {...common} d="M12 5.1c1.4 0 2.3 1.1 2.3 2.4 0 1-.5 2.1-1.3 3.1 1.6-.2 3-.05 4.1.7 1.1.8 1.4 2.1.7 3.3-.6 1-1.8 1.7-3.1 2.1 1.2.8 2.1 1.7 2.4 3 .3 1.3-.5 2.5-1.8 2.8-1.1.2-2.4-.2-3.6-1 .1 1.4-.1 2.7-.9 3.7-1 1.2-2.4 1.2-3.4 0-.8-1-.9-2.3-.9-3.7-1.2.8-2.5 1.2-3.6 1-1.3-.3-2.1-1.5-1.8-2.8.3-1.3 1.2-2.2 2.4-3-1.3-.4-2.5-1.1-3.1-2.1-.7-1.2-.4-2.5.7-3.3 1.1-.75 2.5-.9 4.1-.7-.8-1-1.3-2.1-1.3-3.1 0-1.3.9-2.4 2.3-2.4 1.1 0 2.1.7 3 1.8.9-1.1 1.9-1.8 3-1.8Z"/><circle cx="12" cy="13" r="1.55" fill={color} stroke="none"/><path {...common} d="M12 9.7v1.2M8.8 13H10M14 13h1.2M9.8 16l.85-.72M14.2 16l-.85-.72"/></svg>;
    case 'mint': return <svg className="appr-preset-glyph" viewBox="0 0 24 24"><path {...common} d="M12.2 20.5c-5.2 0-8.7-3.8-8.7-9.2 0-1.3.25-2.6.76-3.8 2.1.3 3.9.9 5.4 1.9 1.15-1.95 3.05-3.65 5.75-5.1.94 1.02 1.63 2.17 2.06 3.42 1.22.1 2.34.44 3.36 1.02-.23 5.04-3.84 11.15-8.63 11.76Z"/><path {...common} d="M7.2 18.2c2.8-1.1 5.15-3.5 6.55-6.55"/><path {...common} d="M10.1 9.55c1.25.42 2.27 1.19 3 2.27"/></svg>;
    case 'coffee': return <svg className="appr-preset-glyph" viewBox="0 0 24 24"><path {...common} d="M5 9h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5Z"/><path {...common} d="M16 11h1a3 3 0 0 1 0 6h-1"/><path {...common} d="M8 5c0 1-.8 1-.8 2M12 5c0 1-.8 1-.8 2"/></svg>;
    case 'amber': return <svg className="appr-preset-glyph" viewBox="0 0 24 24"><path {...common} d="m12 3 8 6-8 12L4 9z"/><path {...common} d="M4 9h16M9 9l3 12 3-12"/></svg>;
    case 'graphite': return <svg className="appr-preset-glyph" viewBox="0 0 24 24"><circle {...common} cx="12" cy="12" r="8"/><path {...common} d="M12 4a8 8 0 0 0 0 16c-3-2-3-14 0-16Z"/></svg>;
    case 'neon': return <svg className="appr-preset-glyph" viewBox="0 0 24 24"><path {...common} d="m13 2-8 12h6l-1 8 9-13h-6z"/></svg>;
    case 'cherry': return <svg className="appr-preset-glyph" viewBox="0 0 24 24"><circle {...common} cx="9" cy="15" r="4"/><circle {...common} cx="16" cy="16" r="3.5"/><path {...common} d="M12 12c1-5 4-7 7-8M12 12c-1-3-3-4-5-4"/></svg>;
    case 'midnight': return <svg className="appr-preset-glyph" viewBox="0 0 24 24"><path {...common} d="M20 15.5A8 8 0 1 1 8.5 4 6.5 6.5 0 0 0 20 15.5Z"/></svg>;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="appr-in appearance-section" style={{ marginTop: 14 }}>
      <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 600, color: 'var(--muted)', padding: '0 18px 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      <div className="appearance-section-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, margin: '0 12px', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function SwatchRow({ value, options, onChange }: {
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isCustom = value !== null && !options.includes(value);
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '12px 14px 14px', alignItems: 'center' }}>
      {/* По умолчанию */}
      <button
        className="appr-swatch"
        onClick={() => { haptic.select(); onChange(null); }}
        style={{
          background: 'var(--surface-light)', borderColor: value === null ? 'var(--accent)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 'var(--fs-micro)', fontWeight: 700,
        }}
        title="По умолчанию"
      >
        {value === null ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : 'A'}
      </button>
      {options.map(c => (
        <button
          key={c}
          className={'appr-swatch' + (value === c ? ' active' : '')}
          onClick={() => { haptic.select(); onChange(c); }}
          style={{ background: c, borderColor: value === c ? '#fff' : 'transparent' }}
          aria-label={c}
        />
      ))}
      {/* Своё */}
      <button
        className={'appr-swatch' + (isCustom ? ' active' : '')}
        onClick={() => inputRef.current?.click()}
        style={{ background: isCustom ? (value as string) : 'transparent', borderColor: isCustom ? '#fff' : 'transparent', position: 'relative', overflow: 'hidden' }}
        title="Свой цвет"
      >
        {!isCustom && (
          <span style={{ position: 'absolute', inset: '-22%', background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }} />
        )}
        <input
          ref={inputRef}
          type="color"
          value={isCustom ? (value as string) : '#888888'}
          onChange={e => { haptic.select(); onChange(e.target.value); }}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }}
        />
      </button>
    </div>
  );
}
