import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import { VOICE_FX, type VoiceFxType } from '@/lib/voiceFx';
import { toast } from '@/stores/toastStore';
import { avatarColor } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { GlyphIcon, normalizeGlyph } from '@/components/icons/AppGlyph';

// ============== Audio/Video helper components ==============

function RemoteAudio({ stream, muted }: { stream: MediaStream | null; muted?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    if (!stream) { el.srcObject = null; return; }
    el.srcObject = stream;
    el.volume = 1.0;
    el.muted = !!muted;
    el.autoplay = true;
    (el as any).playsInline = true;
    const tryPlay = async () => {
      try { await el.play(); }
      catch { setTimeout(tryPlay, 300); }
    };
    tryPlay();
    return () => { try { el.srcObject = null; } catch {} };
  }, [stream, muted]);
  return <audio ref={ref} autoPlay playsInline controls={false} style={{ position:'absolute', width:1, height:1, opacity:0, pointerEvents:'none' }} />;
}

// Невидимый <video> с remote stream — используется для маршрутизации аудио
// в основной динамик на iOS Safari. <audio> в iOS отправляет звук в earpiece
// (разговорный), а <video> — в speaker. Это единственный способ переключить
// вывод в Safari, потому что setSinkId там не поддерживается.
function RemoteAudioViaVideo({ stream, muted }: { stream: MediaStream | null; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    if (!stream) { el.srcObject = null; return; }
    el.srcObject = stream;
    el.volume = 1.0;
    el.muted = !!muted;
    el.autoplay = true;
    el.playsInline = true;
    const tryPlay = async () => {
      try { await el.play(); }
      catch { setTimeout(tryPlay, 300); }
    };
    tryPlay();
    return () => { try { el.srcObject = null; } catch {} };
  }, [stream, muted]);
  return <video ref={ref} autoPlay playsInline muted={muted} style={{ position:'absolute', width:1, height:1, opacity:0, pointerEvents:'none' }} />;
}

function PeerVideo({ stream, muted, style }: { stream: MediaStream | null; muted?: boolean; style?: React.CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    if (!stream) { try { el.srcObject = null; } catch {} return; }
    el.srcObject = stream;
    el.autoplay = true;
    el.playsInline = true;
    if (muted !== undefined) el.muted = muted;
    const tryPlay = async () => {
      try { await el.play(); }
      catch { setTimeout(tryPlay, 300); }
    };
    tryPlay();
    return () => { try { el.srcObject = null; } catch {} };
  }, [stream, muted]);
  return <video ref={ref} autoPlay playsInline muted={muted} style={style} />;
}

function HmsVideo({ trackId, hmsActions, muted, style }: any) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current || !trackId || !hmsActions) return;
    hmsActions.attachVideo(trackId, ref.current);
    return () => { try { hmsActions.detachVideo(trackId, ref.current); } catch {} };
  }, [trackId, hmsActions]);
  if (!trackId) return null;
  return <video ref={ref} autoPlay playsInline muted={muted} style={style} />;
}

// ============== Common controls ==============

function CallSpinner({ size = 20 }: { size?: number }) {
  return <span className="call-control-spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

function RoundIconBtn({ onClick, children, bg, size = 44, title, active = false, disabled = false }: {
  onClick: () => void | Promise<void>;
  children: React.ReactNode;
  bg?: string;
  size?: number;
  title?: string;
  active?: boolean;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy || disabled) return;
    haptic.tap();
    try {
      const result = onClick();
      if (result && typeof (result as Promise<void>).then === 'function') {
        setBusy(true);
        await result;
      }
    } finally { setBusy(false); }
  };
  return (
    <button
      onClick={run}
      title={title}
      disabled={disabled || busy}
      className={`call-round-btn call-control-interactive${active ? ' is-active' : ''}${busy ? ' is-busy' : ''}`}
      style={{ width: size, height: size, borderRadius: size / 2, background: bg }}
    >
      {busy ? <CallSpinner size={Math.max(16, Math.round(size * 0.42))} /> : children}
    </button>
  );
}

function BottomBtn({ children, label, onClick, bg, big, active = false, danger = false, disabled = false }: {
  children: React.ReactNode;
  label: string;
  onClick: () => void | Promise<void>;
  bg?: string;
  big?: boolean;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const sz = big ? 64 : 56;
  const run = async () => {
    if (busy || disabled) return;
    haptic.tap();
    try {
      const result = onClick();
      if (result && typeof (result as Promise<void>).then === 'function') {
        setBusy(true);
        await result;
      }
    } finally { setBusy(false); }
  };
  return (
    <button
      onClick={run}
      disabled={disabled || busy}
      className={`call-control-button${active ? ' is-active' : ''}${danger ? ' is-danger' : ''}${busy ? ' is-busy' : ''}`}
      aria-label={label}
    >
      <span className="call-control-orb" style={{ width: sz, height: sz, borderRadius: sz / 2, background: bg }}>
        {busy ? <CallSpinner /> : children}
      </span>
      <span className="call-control-label">{label}</span>
    </button>
  );
}

// ============== ICONS ==============
const IconClose = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>;
const IconMore = <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>;
const IconChevronDown = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>;
const IconBack = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>;
const IconMicOn = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>;
const IconMicOff = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><path d="M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2"/><path d="M19 10v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/></svg>;
const IconMicLargeOn = <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/></svg>;
const IconVideoOn = <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>;
const IconVideoOff = <svg width="24" height="24" viewBox="0 0 24 24"><path fill="#fff" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/><line x1="3" y1="3" x2="21" y2="21" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>;
const IconAudio = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-7h3v5zM3 19a2 2 0 0 0 2 2h1v-7H3v5z"/></svg>;
const IconChat = <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>;
const IconHangup = <svg width="27" height="27" viewBox="0 0 24 24" fill="none"><g transform="rotate(135 12 12)"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.98.98 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02A11.5 11.5 0 0 1 8.64 4c0-.55-.45-1-1-1H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99Z" fill="#fff"/></g></svg>;
const IconAddUser = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>;
const IconLink = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
const IconPin = <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M16 9V4l1-1h.5c.28 0 .5-.22.5-.5S17.78 2 17.5 2h-11c-.28 0-.5.22-.5.5s.22.5.5.5H7l1 1v5l-2 2v2h6v6l1 1 1-1v-6h6v-2l-2-2z"/></svg>;
const IconPhone = <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>;
const IconFlipCam = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15A9 9 0 0 1 5.64 18.36L1 14"/></svg>;
const IconMicLargeOff = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><path d="M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2"/><path d="M19 10v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/></svg>;
const IconFx = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 9-9"/><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M17.8 6.2 19 5"/><path d="m12.2 6.2 1.8-1.4"/><circle cx="15" cy="9" r="0.5" fill="#fff"/></svg>;

function pluralRu(n: number, words: [string, string, string]): string {
  const cases = [2, 0, 1, 1, 1, 2];
  return words[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[Math.min(n % 10, 5)]];
}

function PeerAvatarBig({ peer }: any) {
  const init = (peer?.name || '?')[0]?.toUpperCase();
  return (
    <div style={{
      width: 160, height: 160, borderRadius: 80, background: avatarColor(peer?.id || 'unknown'),
      display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize: 64, fontWeight: 600
    }}>{init}</div>
  );
}

function PeerAvatarSmall({ peer }: any) {
  const init = (peer?.name || '?')[0]?.toUpperCase();
  return (
    <div style={{
      width: '100%', height: '100%', background: avatarColor(peer?.id || 'unknown'),
      display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize: 36, fontWeight: 600
    }}>{init}</div>
  );
}

function ParticipantRow({ peer, isSpeaker, audioEnabled }: { peer: any; isSpeaker: boolean; audioEnabled?: boolean }) {
  const init = (peer.name || '?')[0]?.toUpperCase();
  const isMuted = audioEnabled !== undefined ? !audioEnabled : !peer.audioTrack;
  let handRaised = false;
  try { handRaised = !!JSON.parse(typeof peer.metadata === 'string' ? peer.metadata : '{}').raisedHand; } catch { /* noop */ }
  const status = peer.isLocal ? 'это Вы' : (isSpeaker ? 'говорит' : 'слушает');
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'10px 14px', gap:14 }}>
      <div style={{ position:'relative', flexShrink:0 }}>
        <div className={isSpeaker ? 'call-speaking' : undefined} style={{
          width:50, height:50, borderRadius:25,
          background: avatarColor(peer.id || 'x'),
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'#fff', fontSize: 'var(--fs-title)', fontWeight:600,
          outline: isSpeaker ? '2px solid #22C55E' : 'none', outlineOffset: 2,
          transition: 'outline 0.15s',
        }}>{init}</div>
        {handRaised && (
          <div style={{ position:'absolute', top:-4, right:-4, width:22, height:22, borderRadius:11, background:'#EAB308', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 'var(--fs-caption)', boxShadow:'0 1px 4px rgba(0,0,0,0.4)' }}>✋</div>
        )}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{peer.name || 'Участник'}{handRaised && ' ✋'}</div>
        <div style={{ fontSize: 'var(--fs-label)', color: isSpeaker ? '#22C55E' : 'rgba(255,255,255,0.55)', marginTop:2 }}>{status}</div>
      </div>
      <div style={{ flexShrink:0, opacity: isMuted ? 0.4 : 1 }}>
        {isMuted ? IconMicOff : IconMicOn}
      </div>
    </div>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch { return false; }
}

function ActionRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        if (busy) return;
        haptic.tap();
        try {
          const result = onClick();
          if (result && typeof (result as Promise<void>).then === 'function') {
            setBusy(true);
            await result;
          }
        } finally { setBusy(false); }
      }}
      disabled={busy}
      className="call-action-row"
    >
      <span className="call-action-row-icon">{busy ? <CallSpinner size={20} /> : icon}</span>
      <span>{label}</span>
      <svg className="call-action-row-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>
  );
}

function BottomControls({ s }: any) {
  const [fxOpen, setFxOpen] = useState(false);
  const me = useAuthStore(st => st.user);
  const fxAllowed = !!(me as any)?.voice_fx_access;
  const fxOn = s.voiceFx && s.voiceFx !== 'none';
  const isVid = s.callType === 'video';
  const canShare = s.provider === '100ms'
    && typeof navigator !== 'undefined'
    && !!(navigator.mediaDevices as any)?.getDisplayMedia;
  const canRouteAudio = s.provider === 'peerjs' || (
    typeof navigator !== 'undefined' && (
      typeof (navigator.mediaDevices as any)?.selectAudioOutput === 'function'
      || typeof (HTMLMediaElement.prototype as any)?.setSinkId === 'function'
    )
  );
  const hasSecondary = canShare || (isVid && s.cameraEnabled) || fxAllowed || s.isGroupCall;

  return (
    <div className="call-controls-shell">
      {hasSecondary && (
        <div className="call-secondary-controls" aria-label="Дополнительные действия">
          {canShare && (
            <div className="call-secondary-item">
              <RoundIconBtn onClick={s.toggleScreenShare} active={s.isScreenSharing} title={s.isScreenSharing ? 'Остановить демонстрацию' : 'Показать экран'}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </RoundIconBtn>
              <span>{s.isScreenSharing ? 'стоп' : 'экран'}</span>
            </div>
          )}
          {isVid && s.cameraEnabled && (
            <div className="call-secondary-item">
              <RoundIconBtn onClick={s.switchCamera} title="Сменить камеру">{IconFlipCam}</RoundIconBtn>
              <span>камера</span>
            </div>
          )}
          {fxAllowed && (
            <div className="call-secondary-item">
              <RoundIconBtn onClick={() => setFxOpen(true)} active={fxOn} title="Эффекты голоса">{IconFx}</RoundIconBtn>
              <span>эффекты</span>
            </div>
          )}
          {s.isGroupCall && (
            <div className="call-secondary-item">
              <RoundIconBtn onClick={s.toggleRaiseHand} active={s.myHandRaised} title={s.myHandRaised ? 'Опустить руку' : 'Поднять руку'}>
                <span style={{ fontSize: 'var(--fs-title)' }}>✋</span>
              </RoundIconBtn>
              <span>{s.myHandRaised ? 'опустить' : 'рука'}</span>
            </div>
          )}
        </div>
      )}

      <div className="call-primary-controls" style={{ gridTemplateColumns: `repeat(${canRouteAudio ? 4 : 3}, minmax(0, 1fr))` }}>
        {canRouteAudio && (
          <BottomBtn
            label={s.audioOutputMode === 'speaker' ? 'динамик' : 'телефон'}
            onClick={s.toggleAudioOutput}
            active={s.audioOutputMode === 'speaker'}
          >{IconAudio}</BottomBtn>
        )}
        <BottomBtn
          label={s.micEnabled ? 'микрофон' : 'без звука'}
          onClick={s.toggleMic}
          active={s.micEnabled}
          big
        >{s.micEnabled ? IconMicLargeOn : IconMicLargeOff}</BottomBtn>
        <BottomBtn
          label={s.cameraEnabled ? 'камера' : 'без видео'}
          onClick={s.toggleVideo}
          active={s.cameraEnabled}
        >{s.cameraEnabled ? IconVideoOn : IconVideoOff}</BottomBtn>
        <BottomBtn label="завершить" onClick={s.endCall} danger>{IconHangup}</BottomBtn>
      </div>

      {fxAllowed && fxOpen && (
        <VoiceFxSheet current={s.voiceFx} onPick={(t: VoiceFxType) => s.setVoiceFx(t)} onClose={() => setFxOpen(false)} />
      )}
    </div>
  );
}

function VoiceFxSheet({ current, onPick, onClose }: { current: VoiceFxType; onPick: (t: VoiceFxType) => void; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'100%', background:'#1c1c1e', color:'#fff', borderRadius:'18px 18px 0 0', padding:'12px 16px max(20px, env(safe-area-inset-bottom, 20px))' }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.25)' }} />
        </div>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight:700, marginBottom:4 }}>Эффект голоса</div>
        <div style={{ fontSize: 'var(--fs-caption)', opacity:0.6, marginBottom:14 }}>Слышат другие участники. Переключается на лету.</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
          {VOICE_FX.map(fx => {
            const active = current === fx.id;
            return (
              <button key={fx.id} onClick={() => { onPick(fx.id); }} style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'14px 6px',
                borderRadius:14, cursor:'pointer',
                border: active ? '2px solid #A855F7' : '2px solid transparent',
                background: active ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.07)',
                color:'#fff',
              }}>
                <GlyphIcon name={normalizeGlyph(fx.icon, 'mic')} size={30} />
                <span style={{ fontSize: 'var(--fs-label)', fontWeight:500 }}>{fx.label}</span>
              </button>
            );
          })}
        </div>
        <button onClick={onClose} style={{ width:'100%', marginTop:16, padding:12, borderRadius:12, border:'none', background:'rgba(255,255,255,0.12)', color:'#fff', fontSize: 'var(--fs-body)', fontWeight:600, cursor:'pointer' }}>Готово</button>
      </div>
    </div>
  );
}

// ============== Group call layout (Telegram-style) ==============

function GroupCallLayout({ s, fmt, elapsed, onBackToChat }: any) {
  const [fullscreenPeerId, setFullscreenPeerId] = useState<string | null>(null);
  const [pinnedPeerId, setPinnedPeerId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const peers = (s.groupPeers || []) as any[];
  const sortedPeers = [...peers].sort((a, b) => (b.isLocal ? 1 : 0) - (a.isLocal ? 1 : 0));
  const peersWithVideo = peers.filter(p => p.videoTrack);
  const fullscreenPeer = fullscreenPeerId ? peers.find(p => p.id === fullscreenPeerId) : null;

  if (fullscreenPeer) {
    const localPeer = peers.find(p => p.isLocal);
    const isAudioMuted = s.peerAudioEnabled?.[fullscreenPeer.id] === false;
    return (
      <div className="call-group-screen call-screen-in">
        <div style={{ position:'absolute', top:'max(12px, env(safe-area-inset-top, 12px))', left:0, right:0, padding:'0 12px', display:'flex', alignItems:'center', justifyContent:'space-between', zIndex:10 }}>
          <button onClick={() => setFullscreenPeerId(null)} style={{ background:'rgba(0,0,0,0.4)', border:'none', color:'#fff', padding:'8px 14px 8px 10px', borderRadius:20, display:'flex', alignItems:'center', gap:4, cursor:'pointer', fontSize: 'var(--fs-body)' }}>
            {IconBack} Назад
          </button>
          <RoundIconBtn
            onClick={() => setPinnedPeerId(pinnedPeerId === fullscreenPeer.id ? null : fullscreenPeer.id)}
            bg="rgba(0,0,0,0.4)"
            active={pinnedPeerId === fullscreenPeer.id}
            title={pinnedPeerId === fullscreenPeer.id ? 'Открепить' : 'Закрепить'}
          >{IconPin}</RoundIconBtn>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, position: 'relative' }}>
          {fullscreenPeer.videoTrack
            ? <HmsVideo trackId={fullscreenPeer.videoTrack} hmsActions={s.hmsActions} muted={fullscreenPeer.isLocal} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
            : <PeerAvatarBig peer={fullscreenPeer} />}
          {isAudioMuted && (
            <div style={{ position:'absolute', bottom: 16, left: 16, background:'rgba(0,0,0,0.55)', padding:'6px 10px', borderRadius:14, display:'flex', alignItems:'center', gap:6, color:'#fff', fontSize: 'var(--fs-label)' }}>
              {IconMicOff} {fullscreenPeer.name || 'Участник'}
            </div>
          )}
          {pinnedPeerId === fullscreenPeer.id && (
            <div className="call-pinned-badge">{IconPin}<span>Закреплено</span></div>
          )}
        </div>

        {localPeer && localPeer.id !== fullscreenPeer.id && (
          <div
            onClick={() => setFullscreenPeerId(localPeer.id)}
            style={{ position:'absolute', bottom: 'calc(120px + env(safe-area-inset-bottom, 0))', left: 12, width: 110, height: 150, borderRadius: 12, overflow: 'hidden', border: '2px solid #3B82F6', background: '#222', cursor: 'pointer', zIndex: 11 }}
          >
            {localPeer.videoTrack
              ? <HmsVideo trackId={localPeer.videoTrack} hmsActions={s.hmsActions} muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <PeerAvatarSmall peer={localPeer} />}
            <div style={{ position:'absolute', bottom:6, left:6, right:6, display:'flex', justifyContent:'space-between', alignItems:'center', color:'#fff', fontSize: 'var(--fs-micro)', textShadow:'0 1px 2px #000' }}>
              <span>{localPeer.name || 'Вы'}</span>
              {s.peerAudioEnabled?.[localPeer.id] === false && <span style={{ opacity:0.8 }}>{IconMicOff}</span>}
            </div>
          </div>
        )}

        {/* Смена камеры — только когда на весь экран ТВОЁ видео (чужую камеру не повернуть) */}
        {fullscreenPeer.isLocal && fullscreenPeer.videoTrack && (
          <div style={{ position:'absolute', top:'max(60px, env(safe-area-inset-top, 60px))', right:12, zIndex:11 }}>
            <RoundIconBtn onClick={s.switchCamera} bg="rgba(0,0,0,0.4)" title="Сменить камеру">{IconFlipCam}</RoundIconBtn>
          </div>
        )}

        <BottomControls s={s} />
      </div>
    );
  }

  return (
    <div className="call-group-screen call-screen-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'max(12px, env(safe-area-inset-top, 12px)) 12px 8px' }}>
        <RoundIconBtn onClick={onBackToChat} title="Назад в чат">{IconBack}</RoundIconBtn>
        <div style={{ textAlign:'center', flex:1 }}>
          <div style={{ fontSize: 'var(--fs-heading)', fontWeight:600 }}>{s.groupName || 'Групповой звонок'}</div>
          <div style={{ fontSize: 'var(--fs-label)', opacity:0.6, marginTop:2 }}>{peers.length || 0} {pluralRu(peers.length, ['участник','участника','участников'])}</div>
        </div>
        <div style={{ width:44, flexShrink:0 }} />
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'8px 12px 200px' }}>
        {s.hmsScreenTrack && (
          <div style={{ marginBottom:12, borderRadius:14, overflow:'hidden', background:'#000', position:'relative', aspectRatio:'16 / 9' }}>
            <HmsVideo trackId={s.hmsScreenTrack} hmsActions={s.hmsActions} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
            <div style={{ position:'absolute', top:8, left:8, display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:999, background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:'var(--fs-micro)', fontWeight:600 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/></svg>
              Демонстрация экрана
            </div>
          </div>
        )}
        {peersWithVideo.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns: peersWithVideo.length === 1 ? '1fr' : 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
            {peersWithVideo.map(peer => (
              <div
                key={peer.id}
                onClick={() => setFullscreenPeerId(peer.id)}
                className="call-tile-in"
                style={{ aspectRatio: '4/3', borderRadius: 14, overflow: 'hidden', background: '#222', position: 'relative', cursor: 'pointer' }}
              >
                <HmsVideo
                  trackId={peer.videoTrack}
                  hmsActions={s.hmsActions}
                  muted={peer.isLocal}
                  style={{ width:'100%', height:'100%', objectFit:'cover' }}
                />
                <div style={{ position:'absolute', bottom: 6, left: 8, display:'flex', alignItems:'center', gap:4, color:'#fff', fontSize: 'var(--fs-caption)', textShadow:'0 1px 2px rgba(0,0,0,0.8)' }}>
                  {s.peerAudioEnabled?.[peer.id] === false && <span style={{ display:'inline-flex' }}>{IconMicOff}</span>}
                  <span>{peer.isLocal ? 'Вы' : (peer.name || 'Участник')}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ background:'rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
          {sortedPeers.map((peer, i) => (
            <div key={peer.id} className="call-prow-in" style={{ animationDelay: Math.min(i, 10) * 40 + 'ms' }}>
              <ParticipantRow peer={peer} isSpeaker={s.dominantSpeakerId === peer.id} audioEnabled={s.peerAudioEnabled?.[peer.id]} />
              {i < sortedPeers.length - 1 && <div style={{ height:1, background:'rgba(255,255,255,0.05)', marginLeft: 80 }} />}
            </div>
          ))}
          {sortedPeers.length === 0 && (
            <div style={{ padding:24, textAlign:'center', opacity:0.6, fontSize: 'var(--fs-label)' }}>
              Ожидание участников...
            </div>
          )}

          <div style={{ height:1, background:'rgba(255,255,255,0.05)', marginLeft: 80 }} />
          <ActionRow icon={IconAddUser} label="Добавить участника" onClick={() => setShowAddDialog(true)} />
          <div style={{ height:1, background:'rgba(255,255,255,0.05)', marginLeft: 80 }} />
          <ActionRow icon={IconLink} label="Ссылка-приглашение" onClick={async () => {
            const link = `${location.origin}/?invite=${s.roomId || ''}`;
            const copied = await copyText(link);
            if (copied) toast.success('Ссылка скопирована');
            else toast.error('Не удалось скопировать ссылку');
          }} />
        </div>

        <div style={{ textAlign:'center', marginTop:16, fontSize: 'var(--fs-label)', opacity:0.6, fontVariantNumeric:'tabular-nums' }}>
          {fmt(elapsed)}
        </div>
      </div>

      <BottomControls s={s} />

      {showAddDialog && (
        <AddParticipantDialog
          existingIds={[
            ...(s.groupParticipants || []).map((u: any) => u.id),
            ...((s.groupPeers || []).map((p: any) => p.userId).filter(Boolean)),
          ]}
          onPick={async (user) => {
            const result = await s.inviteToGroupCall(user);
            if (!result.ok) {
              toast.error(result.error || 'Не удалось пригласить');
            }
            setShowAddDialog(false);
          }}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
}

// ============== ADD PARTICIPANT DIALOG ==============

function AddParticipantDialog({ existingIds, onPick, onClose }: {
  existingIds: string[];
  onPick: (user: any) => void;
  onClose: () => void;
}) {
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data } = await supabase
          .from('friendships')
          .select('friend:users!friendships_friend_id_fkey (id, display_name, avatar_url)')
          .eq('user_id', user.id)
          .eq('status', 'accepted');
        const list = (data || []).map((r: any) => r.friend).filter(Boolean);
        setFriends(list);
      } catch (e) {
        console.error('Load friends:', e);
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = friends.filter(f =>
    !existingIds.includes(f.id)
    && (!search || f.display_name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:10000, display:'flex', flexDirection:'column', justifyContent:'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16,
        maxHeight:'70vh', display:'flex', flexDirection:'column', color:'#fff',
        paddingBottom:'env(safe-area-inset-bottom, 0)',
      }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize: 'var(--fs-snap16)', fontWeight:600 }}>Кого добавить?</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#999', fontSize: 'var(--fs-title)', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:'10px 12px' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск..."
            style={{ width:'100%', padding:'10px 12px', background:'#2a2a2a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#fff', fontSize: 'var(--fs-snap14)', outline:'none' }}
          />
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'4px 8px' }}>
          {loading
            ? <div style={{ textAlign:'center', padding:24, opacity:0.6 }}>Загрузка...</div>
            : filtered.length === 0
              ? <div style={{ textAlign:'center', padding:24, opacity:0.6, fontSize: 'var(--fs-label)' }}>{search ? 'Никого не найдено' : 'Все друзья уже в звонке'}</div>
              : filtered.map(f => (
                <button key={f.id} onClick={() => onPick(f)} style={{
                  width:'100%', padding:'10px 12px', display:'flex', alignItems:'center', gap:12,
                  background:'transparent', border:'none', color:'#fff', cursor:'pointer',
                  borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'left',
                }}>
                  {f.avatar_url
                    ? <img src={f.avatar_url} alt="" style={{ width:36, height:36, borderRadius:18, objectFit:'cover' }} />
                    : <div style={{ width:36, height:36, borderRadius:18, background:avatarColor(f.id), display:'flex', alignItems:'center', justifyContent:'center', fontSize: 'var(--fs-snap14)', fontWeight:600 }}>{(f.display_name || '?')[0].toUpperCase()}</div>}
                  <div style={{ fontSize: 'var(--fs-body)' }}>{f.display_name || 'Без имени'}</div>
                </button>
              ))}
        </div>
      </div>
    </div>
  );
}

// ============== Minimized call PiP (Telegram-style) ==============
// Свёрнутый звонок — маленький перетаскиваемый PiP (как наш видеокружок).
// Тап — развернуть; красная кнопка — завершить; магнитится к бокам. Звонок живёт.
function CallPip({ s, fmt, elapsed }: any) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; baseX: number; baseY: number; moved: boolean } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [snapping, setSnapping] = useState(false);
  const W = 116, H = 160;

  let videoEl: React.ReactNode = null;
  if (s.isGroupCall) {
    const peers = (s.groupPeers || []) as any[];
    const rp = peers.find(p => !p.isLocal && p.videoTrack) || peers.find(p => p.videoTrack);
    if (rp?.videoTrack) videoEl = <HmsVideo trackId={rp.videoTrack} hmsActions={s.hmsActions} muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />;
  } else if (s.callType === 'video') {
    if (s.provider === 'peerjs' && s.remoteStream) videoEl = <PeerVideo stream={s.remoteStream} muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />;
    else if (s.hmsRemoteTrack) videoEl = <HmsVideo trackId={s.hmsRemoteTrack} hmsActions={s.hmsActions} muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />;
  }

  const title = s.isGroupCall ? (s.groupName || 'Звонок') : (s.remoteUser?.display_name || 'Звонок');
  const initial = (title || '?')[0]?.toUpperCase();
  const cid = s.isGroupCall ? (s.groupConversationId || 'group') : (s.remoteUser?.id || 'call');

  const onPointerDown = (e: React.PointerEvent) => {
    const wrap = wrapRef.current; if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setSnapping(false);
    drag.current = { sx: e.clientX, sy: e.clientY, baseX: rect.left, baseY: rect.top, moved: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    if (Math.abs(e.clientX - d.sx) > 4 || Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    const nx = d.baseX + (e.clientX - d.sx);
    const ny = d.baseY + (e.clientY - d.sy);
    const maxX = window.innerWidth - W - 6;
    const maxY = window.innerHeight - H - 6;
    setPos({ x: Math.max(6, Math.min(maxX, nx)), y: Math.max(40, Math.min(maxY, ny)) });
  };
  const onPointerUp = () => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (!d.moved) { s.setMinimized(false); return; } // тап без перетаскивания — развернуть
    const p = pos; if (!p) return;
    const center = p.x + W / 2;
    const snapX = center < window.innerWidth / 2 ? 8 : window.innerWidth - W - 8;
    setSnapping(true);
    setPos({ x: snapX, y: p.y });
    window.setTimeout(() => setSnapping(false), 240);
  };

  const wrapStyle: React.CSSProperties = pos
    ? { top: pos.y, left: pos.x, transition: snapping ? 'left 0.22s ease, top 0.22s ease' : 'none' }
    : { top: 'max(70px, calc(env(safe-area-inset-top, 0px) + 70px))', right: 12 };

  return (
    <div
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="call-pip-in"
      style={{ position:'fixed', width:W, height:H, borderRadius:16, overflow:'hidden', background:'#1c1c1e', zIndex:9997, boxShadow:'0 8px 28px rgba(0,0,0,0.5)', cursor:'pointer', touchAction:'none', ...wrapStyle }}
    >
      {videoEl || (
        <div style={{ width:'100%', height:'100%', background:avatarColor(cid), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:40, fontWeight:600 }}>{initial}</div>
      )}
      <div style={{ position:'absolute', top:6, left:6, background:'rgba(0,0,0,0.55)', padding:'2px 7px', borderRadius:10, color:'#fff', fontSize: 'var(--fs-micro)', fontVariantNumeric:'tabular-nums' }}>{fmt(elapsed)}</div>
      <div style={{ position:'absolute', bottom:6, left:6, maxWidth:60, color:'#fff', fontSize: 'var(--fs-micro)', textShadow:'0 1px 2px #000', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</div>
      <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); void s.endCall(); }} aria-label="Завершить" className="call-pip-end">
        {IconHangup}
      </button>
    </div>
  );
}

function CallMiniBar({ s, fmt, elapsed, onOpen }: any) {
  const title = s.isGroupCall ? (s.groupName || 'Групповой звонок') : (s.remoteUser?.display_name || 'Звонок');
  const avatar = !s.isGroupCall ? s.remoteUser?.avatar_url : null;
  const id = s.isGroupCall ? (s.groupConversationId || 'group') : (s.remoteUser?.id || 'call');
  const initial = (title || '?')[0]?.toUpperCase();
  return (
    <div className="call-mini-bar" role="status" aria-label="Активный звонок">
      <button className="call-mini-main" onClick={onOpen} aria-label="Вернуться к звонку">
        <span className="call-mini-avatar" style={{ background: avatar ? '#222' : avatarColor(id) }}>
          {avatar ? <img src={avatar} alt="" /> : initial}
        </span>
        <span className="call-mini-copy">
          <span className="call-mini-title">{title}</span>
          <span className="call-mini-meta"><span className="call-mini-live-dot" />{fmt(elapsed)} · защищено</span>
        </span>
        <span className="call-mini-open">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </span>
      </button>
      <button className="call-mini-end" onClick={(e)=>{ e.stopPropagation(); haptic.tap(); void s.endCall(); }} aria-label="Завершить звонок">{IconHangup}</button>
    </div>
  );
}

export default function CallOverlay() {
  const s = useCallStore();
  const nav = useNavigate();

  const minimizeToChat = () => {
    haptic.tap();
    s.setMinimized(true);
    const conversationId = s.groupConversationId;
    nav(conversationId ? `/chat/${conversationId}` : '/chats');
  };

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (s.callStatus !== 'active' || !s.callStartTime) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - s.callStartTime!) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [s.callStatus, s.callStartTime]);

  if (s.callStatus === 'idle') return null;

  const fmt = (n: number) => `${Math.floor(n / 60).toString().padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
  const init = s.remoteUser?.display_name?.[0]?.toUpperCase() || '?';
  const isVid = s.callType === 'video';
  const active = s.callStatus === 'active';
  const hasRV = s.provider === 'peerjs' ? !!s.remoteStream : !!s.hmsRemoteTrack;
  const hasLV = s.provider === 'peerjs' ? !!s.localStream : !!s.hmsLocalTrack;
  const avatarUrl = !s.isGroupCall ? s.remoteUser?.avatar_url : null;
  const statusLabel = active
    ? fmt(elapsed)
    : s.isAnswering || s.connectionStage === 'connecting'
      ? 'Подключение'
      : s.connectionStage === 'preparing'
        ? 'Подготавливаем звонок'
        : s.callStatus === 'ringing' && s.callDirection === 'incoming'
          ? (isVid ? 'Входящий видеозвонок' : 'Входящий звонок')
          : (isVid ? 'Видеовызов' : 'Звоним');

  if (s.isGroupCall && active) {
    return s.minimized
      ? <CallMiniBar s={s} fmt={fmt} elapsed={elapsed} onOpen={() => s.setMinimized(false)} />
      : <GroupCallLayout s={s} fmt={fmt} elapsed={elapsed} onBackToChat={minimizeToChat} />;
  }

  const localTransform = s.currentFacingMode === 'user' ? 'scaleX(-1)' : 'none';

  return (<>
    {s.minimized && active && <CallMiniBar s={s} fmt={fmt} elapsed={elapsed} onOpen={() => s.setMinimized(false)} />}
    <div className="call-screen-backdrop" style={{ display: s.minimized ? 'none' : 'block' }} />
    <div className="call-screen call-screen-in" style={{ display: s.minimized ? 'none' : 'flex' }}>
      {avatarUrl && <div className="call-ambient-photo" style={{ backgroundImage: `url(${avatarUrl})` }} aria-hidden="true" />}
      <div className="call-ambient-shade" aria-hidden="true" />
      {/* Аудио-маршрутизация (iOS): рендерим И <audio>, И невидимый <video>
          с одним и тем же remote stream. Активный определяется audioOutputMode:
          в режиме 'earpiece' играет <audio>, в 'speaker' — <video>. На desktop
          обе ветви звучат одинаково через дефолтное устройство. */}
      {s.provider === 'peerjs' && !isVid && (<>
        <RemoteAudio stream={s.remoteStream} muted={s.audioOutputMode !== 'earpiece'} />
        <RemoteAudioViaVideo stream={s.remoteStream} muted={s.audioOutputMode !== 'speaker'} />
      </>)}
      {/* В видео-звонке аудио уже идёт через видимый <PeerVideo> (speaker по умолчанию).
          Если выбран earpiece — играем тот же stream через <audio> и мьютим видео-аудио. */}
      {s.provider === 'peerjs' && isVid && (
        <RemoteAudio stream={s.remoteStream} muted={s.audioOutputMode !== 'earpiece'} />
      )}

      <div className="call-topbar">
        <button onClick={() => {
          if (active) minimizeToChat();
          else if (s.callStatus === 'ringing' && s.callDirection === 'incoming') s.declineCall();
          else void s.endCall();
        }} className="call-back-button">
          {IconBack}
          <span>Назад</span>
        </button>
        <div className="call-security-pill" title="Защищённое соединение">
          <span className="call-security-dot" /> защищено
        </div>
      </div>

      {active && s.isScreenSharing && (
        <div style={{ position:'absolute', top:'max(52px, calc(env(safe-area-inset-top, 16px) + 40px))', left:'50%', transform:'translateX(-50%)', zIndex:11, display:'flex', alignItems:'center', gap:7, padding:'6px 13px', borderRadius:999, background:'rgba(34,197,94,0.92)', color:'#fff', fontSize:'var(--fs-caption)', fontWeight:600, boxShadow:'0 4px 14px rgba(0,0,0,0.3)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/></svg>
          Вы демонстрируете экран
        </div>
      )}

      {active && (s.hmsScreenTrack || (isVid && hasRV)) && (
        <div style={{ position:'absolute', inset:0, zIndex:1 }}>
          {s.hmsScreenTrack
            ? <div style={{ width:'100%', height:'100%', background:'#000', display:'flex', alignItems:'center', justifyContent:'center' }}><HmsVideo trackId={s.hmsScreenTrack} hmsActions={s.hmsActions} style={{ width:'100%', height:'100%', objectFit:'contain' }} /></div>
            : (s.provider==='peerjs'
                ? <PeerVideo stream={s.remoteStream} muted={s.audioOutputMode === 'earpiece'} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <HmsVideo trackId={s.hmsRemoteTrack} hmsActions={s.hmsActions} style={{ width:'100%', height:'100%', objectFit:'cover' }} />)}
        </div>
      )}
      {isVid && active && hasLV && (
        <div className="pip-video" style={{ zIndex:2 }}>
          {s.provider==='peerjs' ? <PeerVideo stream={s.localStream} muted style={{ width:'100%', height:'100%', objectFit:'cover', transform: localTransform }} /> : <HmsVideo trackId={s.hmsLocalTrack} hmsActions={s.hmsActions} muted style={{ width:'100%', height:'100%', objectFit:'cover', transform: localTransform }} />}
        </div>
      )}

      {(s.callStatus === 'calling' || s.callStatus === 'ringing' || !isVid || !active || !hasRV) && !s.hmsScreenTrack && (
        <div className="call-center-stage">
          <div className="call-center-card">
            <div className="call-avatar-stage">
              {/* 3 концентрических пульсирующих кольца только если ringing/calling */}
              {(s.callStatus === 'calling' || s.callStatus === 'ringing') && (
                <>
                  <div className="call-ring" />
                  <div className="call-ring" />
                  <div className="call-ring" />
                </>
              )}
              <div className={`call-main-avatar${(s.callStatus === 'calling' || s.callStatus === 'ringing') ? ' call-avatar-breathe' : ''}`} style={{ background:s.isGroupCall ? '#3B82F6' : avatarColor(s.remoteUser?.id || 'unknown') }}>
                {s.isGroupCall
                  ? '👥'
                  : (s.remoteUser?.avatar_url
                    ? <img src={s.remoteUser.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : init)
                }
              </div>
            </div>
            <div className="call-person-name">
              {s.isGroupCall
                ? (s.groupName || 'Групповой звонок')
                : (s.remoteUser?.display_name || 'Собеседник')}
            </div>
            {s.isGroupCall && s.callDirection === 'incoming' && s.remoteUser?.display_name && (
              <div style={{ fontSize: 'var(--fs-snap14)', color:'rgba(255,255,255,0.7)', marginTop:4 }}>
                Звонит {s.remoteUser.display_name}
              </div>
            )}
            {s.isGroupCall && s.groupParticipants.length > 0 && (
              <div style={{ fontSize: 'var(--fs-label)', color:'rgba(255,255,255,0.6)', marginTop:6 }}>
                👥 {s.groupParticipants.length} участник{s.groupParticipants.length === 1 ? '' : s.groupParticipants.length < 5 ? 'а' : 'ов'}
              </div>
            )}
            <div className="call-status-line">
              <span>{statusLabel}</span>
              {!active && <span className="call-status-dots"><i/><i/><i/></span>}
            </div>
          </div>
        </div>
      )}

      {isVid && active && hasRV && <div style={{ flex:1 }} />}

      {isVid && active && hasRV && (
        <div style={{ position:'absolute', top:'max(56px, calc(env(safe-area-inset-top, 0px) + 56px))', left:16, zIndex:4, pointerEvents:'none' }}>
          <div style={{ background:'rgba(0,0,0,0.55)', backdropFilter:'blur(8px)', padding:'6px 12px', borderRadius:20, color:'#fff', fontSize: 'var(--fs-label)', fontVariantNumeric:'tabular-nums', display:'inline-flex', alignItems:'center', gap:6 }}>
            <span className="call-heartbeat" style={{width:6,height:6,borderRadius:3,background:'#4ADE80'}} />
            {fmt(elapsed)}
          </div>
        </div>
      )}

      <div className="call-bottom-zone">
        {active && <BottomControls s={s} />}

        {s.callStatus === 'calling' && (
          <div className="call-actions-in call-outgoing-action">
            <button onClick={() => { haptic.tap(); void s.endCall(); }} className="call-large-action is-decline">
              <span className="call-large-action-orb">{IconHangup}</span>
              <span>завершить</span>
            </button>
          </div>
        )}

        {s.callStatus === 'ringing' && s.callDirection === 'incoming' && (
          <div className="call-actions-in call-incoming-actions">
            <button onClick={() => { haptic.tap(); s.declineCall(); }} className="call-large-action is-decline" disabled={s.isAnswering}>
              <span className="call-large-action-orb">{IconHangup}</span>
              <span>отклонить</span>
            </button>
            <button onClick={() => { haptic.success(); void s.acceptCall(); }} className="call-large-action is-accept" disabled={s.isAnswering}>
              <span className="call-large-action-orb call-accept-pulse">{s.isAnswering ? <CallSpinner size={24}/> : IconPhone}</span>
              <span>{s.isAnswering ? 'подключение' : 'ответить'}</span>
            </button>
          </div>
        )}
      </div>
    </div>

  </>);
}
