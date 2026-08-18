import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isHapticsOn, setHapticsOn, haptic } from '@/lib/haptics';
import { isSoundOn, setSoundOn, getStaffTheme, setStaffTheme, getSpeechRate, setSpeechRate, getVoiceURI, setVoiceURI, type StaffTheme } from '@/lib/eduPrefs';
import { getBestVoice, getVoiceQualityLabel, getVoicesFor, speak, speechSupported } from '@/lib/speech';

const VOICE_LANGS: [string, string, string][] = [
  ['en', 'EN · English', 'Hello, how are you?'],
  ['it', 'IT · Italiano', 'Ciao, come stai?'],
  ['es', 'ES · Español', 'Hola, ¿cómo estás?'],
  ['de', 'DE · Deutsch', 'Hallo, wie geht es dir?'],
  ['fr', 'FR · Français', 'Bonjour, comment ça va ?'],
];

function Switch({ on, burst }: { on: boolean; burst?: boolean }) {
  return <span className={'set-toggle' + (on ? ' on' : '') + (burst ? ' burst' : '')} />;
}

function Row({ icon, title, desc, on, onToggle, delay, burst }: { icon: JSX.Element; title: string; desc: string; on: boolean; onToggle: () => void; delay: number; burst?: boolean }) {
  return (
    <button onClick={onToggle} className="edu-card edu-settings-card" style={{
      animationDelay: delay + 'ms', width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 14,
      borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{ display: 'flex', color: 'var(--text2)' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
      </div>
      <Switch on={on} burst={burst} />
    </button>
  );
}

export default function EduSettings() {
  const nav = useNavigate();
  const [sound, setSound] = useState(isSoundOn());
  const [hap, setHap] = useState(isHapticsOn());
  const [staff, setStaff] = useState<StaffTheme>(getStaffTheme());
  const [rate, setRate] = useState(getSpeechRate());
  const [, setVoicesTick] = useState(0);
  const [pulseKey, setPulseKey] = useState<string>('');
  const bump = (key: string) => {
    setPulseKey(key);
    window.setTimeout(() => setPulseKey(cur => cur === key ? '' : cur), 420);
  };
  const [voiceURIs, setVoiceURIs] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const [code] of VOICE_LANGS) o[code] = getVoiceURI(code) || '';
    return o;
  });
  useEffect(() => {
    const refresh = () => setVoicesTick(t => t + 1);
    try { window.speechSynthesis?.addEventListener('voiceschanged', refresh); } catch { /* noop */ }
    refresh();
    return () => { try { window.speechSynthesis?.removeEventListener('voiceschanged', refresh); } catch { /* noop */ } };
  }, []);
  const pickRate = (r: number) => { haptic.select(); setRate(r); setSpeechRate(r); };

  const toggleSound = () => { const n = !sound; setSound(n); setSoundOn(n); haptic.tap(); bump('sound'); };
  const toggleHap = () => { const n = !hap; setHap(n); setHapticsOn(n); if (n) haptic.tap(); bump('haptics'); };
  const pickStaff = (t: StaffTheme) => { haptic.select(); setStaff(t); setStaffTheme(t); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="safe-top" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button onClick={() => { haptic.tap(); nav(-1); }} style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--surface-light)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold, 600)', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Настройки обучения</div>
      </header>

      <div className="page-scroll" style={{ padding: 16 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>} title="Звук упражнений" desc="Ноты, сигналы «верно/неверно», озвучка слов" on={sound} onToggle={toggleSound} delay={0} burst={pulseKey === 'sound'} />
          <Row icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M3 9v6M21 9v6"/></svg>} title="Вибрация" desc="Тактильный отклик при нажатиях и ответах" on={hap} onToggle={toggleHap} delay={60} burst={pulseKey === 'haptics'} />

          {/* Тема нотного стана */}
          <div className="edu-card edu-settings-card" style={{ animationDelay: '120ms', padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", color: "var(--text2)" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>Фон нотного стана</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Как выглядит «лист» в тренажёре нот</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([['warm', 'Тёплый', '#f8f7f2'], ['white', 'Белый', '#ffffff']] as [StaffTheme, string, string][]).map(([val, label, bg]) => (
                <button key={val} onClick={() => pickStaff(val)} style={{
                  padding: 8, borderRadius: 12, cursor: 'pointer',
                  border: '2px solid', borderColor: staff === val ? 'var(--accent)' : 'var(--border)',
                  background: 'var(--surface-light)',
                }}>
                  <div style={{ height: 40, borderRadius: 8, background: bg, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    <span style={{ fontFamily: "'Bravura','Apple Symbols','Segoe UI Symbol',serif", fontSize: 'var(--fs-snap24)', color: '#1a1a1a', lineHeight: 1 }}>𝄞</span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: staff === val ? 'var(--accent)' : 'var(--text)' }}>{label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Озвучка */}
          <div className="edu-card edu-settings-card" style={{ animationDelay: '180ms', padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", color: "var(--text2)" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l15-5v12L3 13z"/><path d="M11.6 17a3 3 0 1 1-5.6-1.7"/></svg></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>Озвучка слов</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Лучший системный голос, естественный темп и паузы</div>
              </div>
            </div>
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginBottom: 6 }}>Скорость</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {([[0.8, 'Медленно'], [0.95, 'Натурально'], [1.08, 'Быстрее']] as [number, string][]).map(([r, label]) => (
                <button key={r} onClick={() => pickRate(r)} style={{ padding: '10px 0', borderRadius: 10, border: '1px solid', borderColor: rate === r ? 'var(--accent)' : 'var(--border)', background: rate === r ? 'var(--accent)' : 'var(--surface-light)', color: rate === r ? 'var(--bg)' : 'var(--text)', fontSize: 'var(--fs-label)', fontWeight: 600, cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
            {speechSupported() ? (
              <>
                {VOICE_LANGS.map(([code, label, sample], i) => {
                  const langCode = code as any;
                  const voices = getVoicesFor(langCode);
                  const automaticVoice = getBestVoice(langCode);
                  return (
                    <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i === 0 ? 12 : 10 }}>
                      <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text)', width: 96, flexShrink: 0 }}>{label}</div>
                      <select value={voiceURIs[code] || ''} onChange={e => { const val = e.target.value; setVoiceURIs(st => ({ ...st, [code]: val })); setVoiceURI(code, val || null); }} style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 'var(--fs-label)' }}>
                        <option value="">{automaticVoice ? `Авто · ${automaticVoice.name}` : 'Авто · лучший голос'}</option>
                        {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {getVoiceQualityLabel(v)}</option>)}
                      </select>
                      <button onClick={() => { haptic.tap(); speak(sample, langCode, 'example'); }} aria-label="Прослушать" className="alias-btn-press" style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-light)', color: 'var(--text)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 5v14l11-7z"/></svg></button>
                    </div>
                  );
                })}
              </>
            ) : (
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 10 }}>Синтез речи недоступен в этом браузере.</div>
            )}
          </div>

          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-micro)', marginTop: 14, lineHeight: 1.5 }}>
            Настройки сохраняются на этом устройстве. Качество озвучки зависит от установленных системных голосов.
          </p>
        </div>
      </div>
    </div>
  );
}
