import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';
import { getNotifPref, setNotifPref, getRingtonePref, setRingtonePref, RingtoneId } from '@/lib/notifPrefs';
import { playMessageSound, playCallSound, RINGTONE_OPTIONS, updateBadge } from '@/lib/notifications';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { disablePushNotifications, enablePushNotifications, getPushState, syncRemoteNotificationPreferences } from '@/lib/pushNotifications';

const Icon = ({ bg, children }: { bg: string; children: React.ReactNode }) => (
  <div className="set-icon" style={{ background: bg }}>{children}</div>
);

export default function NotificationSettings() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const totalUnread = useChatStore(s => s.totalUnread);

  const [master, setMaster] = useState(() => getNotifPref('master') && typeof Notification !== 'undefined' && Notification.permission === 'granted');
  const [msg, setMsg] = useState(getNotifPref('msg'));
  const [group, setGroup] = useState(getNotifPref('group'));
  const [call, setCall] = useState(getNotifPref('call'));
  const [preview, setPreview] = useState(getNotifPref('preview'));
  const [badge, setBadge] = useState(getNotifPref('badge'));
  const [sndMsg, setSndMsg] = useState(getNotifPref('sndMsg'));
  const [sndCall, setSndCall] = useState(getNotifPref('sndCall'));
  const [ringtone, setRingtone] = useState<RingtoneId>(() => getRingtonePref());
  const [pulseKey, setPulseKey] = useState<string>('');
  const [pushState, setPushState] = useState<'checking' | 'enabled' | 'disabled' | 'blocked' | 'unsupported' | 'unconfigured'>('checking');

  useEffect(() => {
    let cancelled = false;
    void getPushState().then(state => {
      if (cancelled) return;
      setPushState(state);
      setMaster(state === 'enabled');
    });
    return () => { cancelled = true; };
  }, []);

  const bump = (key: string) => {
    setPulseKey(key);
    window.setTimeout(() => setPulseKey(cur => cur === key ? '' : cur), 420);
  };

  const toggleMaster = async () => {
    if (!user?.id) { toast.error('Сначала войдите в аккаунт'); return; }
    const next = !master;
    haptic.select(); bump('master');

    if (next) {
      setNotifPref('master', true);
      setPushState('checking');
      const result = await enablePushNotifications(user.id);
      if (!result.ok) {
        setNotifPref('master', false);
        setMaster(false);
        setPushState(result.state);
        toast.warning(result.error || 'Не удалось включить push-уведомления');
        return;
      }
      setMaster(true);
      setPushState('enabled');
      toast.success('Push-уведомления включены');
      return;
    }

    setNotifPref('master', false);
    setMaster(false);
    setPushState('disabled');
    const result = await disablePushNotifications(user.id);
    if (!result.ok) toast.warning(result.error || 'Подписка отключена только на этом устройстве');
    else toast.success('Push-уведомления выключены');
  };

  const flip = (
    val: boolean,
    set: (v: boolean) => void,
    key: Parameters<typeof setNotifPref>[0],
    after?: (next: boolean) => void
  ) => {
    const next = !val;
    setNotifPref(key, next); set(next); haptic.select(); bump(String(key));
    after?.(next);
    if (user?.id && ['msg', 'group', 'call', 'preview'].includes(String(key))) {
      void syncRemoteNotificationPreferences(user.id).catch(error => console.warn('[push] preferences sync failed:', error));
    }
  };

  return (
    <div className="page-fade-in" style={{ minHeight: '100%', background: 'var(--bg)' }}>
      <div className="appr-head safe-top" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => navigate(-1)} className="tap-effect" style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--surface-light)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 600 }}>Уведомления и звуки</div>
      </div>

      <div className="settings-group set-cascade" style={{ marginTop: 14 }}>
        <div className="sg-label">PUSH-УВЕДОМЛЕНИЯ</div>

        <div className="set-row" onClick={toggleMaster}>
          <Icon bg="#E17055"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg></Icon>
          <span className="set-label">Push-уведомления</span>
          <span className={'set-toggle' + (master ? ' on' : '') + (pulseKey === 'master' ? ' burst' : '')} />
        </div>
        {pushState !== 'enabled' && (
          <div style={{ padding: '0 16px 10px 58px', color: 'var(--muted)', fontSize: 'var(--fs-micro)', lineHeight: 1.35 }}>
            {pushState === 'checking' && 'Проверяем подписку…'}
            {pushState === 'blocked' && 'Уведомления заблокированы в настройках браузера.'}
            {pushState === 'unsupported' && 'В этом режиме браузера фоновые push недоступны.'}
            {pushState === 'unconfigured' && 'Push-сервер ещё не настроен владельцем приложения.'}
            {pushState === 'disabled' && 'Нажмите, чтобы разрешить фоновые уведомления на этом устройстве.'}
          </div>
        )}

        <div className={'set-row' + (master ? '' : ' set-row-disabled')} onClick={master ? () => flip(msg, setMsg, 'msg') : undefined}>
          <Icon bg="#3B82F6"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></Icon>
          <span className="set-label">О новых сообщениях</span>
          <span className={'set-toggle' + (msg ? ' on' : '') + (pulseKey === 'msg' ? ' burst' : '')} />
        </div>
        <div className={'set-row' + (master ? '' : ' set-row-disabled')} onClick={master ? () => flip(group, setGroup, 'group') : undefined}>
          <Icon bg="#6366F1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg></Icon>
          <span className="set-label">Сообщения в группах</span>
          <span className={'set-toggle' + (group ? ' on' : '') + (pulseKey === 'group' ? ' burst' : '')} />
        </div>

        <div className={'set-row' + (master ? '' : ' set-row-disabled')} onClick={master ? () => flip(call, setCall, 'call') : undefined}>
          <Icon bg="#10B981"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg></Icon>
          <span className="set-label">О входящих звонках</span>
          <span className={'set-toggle' + (call ? ' on' : '') + (pulseKey === 'call' ? ' burst' : '')} />
        </div>

        <div className={'set-row' + (master ? '' : ' set-row-disabled')} onClick={master ? () => flip(preview, setPreview, 'preview') : undefined}>
          <Icon bg="#8B5CF6"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg></Icon>
          <span className="set-label">Показывать текст сообщения</span>
          <span className={'set-toggle' + (preview ? ' on' : '') + (pulseKey === 'preview' ? ' burst' : '')} />
        </div>

        <div className="set-row" onClick={() => flip(badge, setBadge, 'badge', () => updateBadge(totalUnread))}>
          <Icon bg="#EF4444"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4.5h7a3.5 3.5 0 0 1 3.5 3.5v7A3.5 3.5 0 0 1 14 18.5H7A3.5 3.5 0 0 1 3.5 15V8A3.5 3.5 0 0 1 7 4.5Z"/><path d="M7.5 9.5h5M7.5 12.5h3.5"/><circle cx="17.5" cy="7" r="3.25" fill="#fff" stroke="none"/><text x="17.5" y="8.25" textAnchor="middle" fontSize="4.4" fontFamily="Arial, sans-serif" fontWeight="700" fill="#EF4444">1</text></svg></Icon>
          <span className="set-label">Счётчик на иконке</span>
          <span className={'set-toggle' + (badge ? ' on' : '') + (pulseKey === 'badge' ? ' burst' : '')} />
        </div>
      </div>

      <div className="settings-group set-cascade" style={{ marginTop: 14 }}>
        <div className="sg-label">ЗВУКИ</div>

        <div className="set-row" onClick={() => flip(sndMsg, setSndMsg, 'sndMsg', (n) => { if (n) playMessageSound(); })}>
          <Icon bg="#0BBCBC"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg></Icon>
          <span className="set-label">Звук новых сообщений</span>
          <span className={'set-toggle' + (sndMsg ? ' on' : '') + (pulseKey === 'sndMsg' ? ' burst' : '')} />
        </div>

        <div className="set-row" onClick={() => flip(sndCall, setSndCall, 'sndCall', (n) => { if (n) playCallSound(ringtone); })}>
          <Icon bg="#F59E0B"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /><path d="M15.5 5.5a5 5 0 0 1 3 3" /><path d="M15 2a9 9 0 0 1 6.5 6.5" /></svg></Icon>
          <span className="set-label">Звук звонка</span>
          <span className={'set-toggle' + (sndCall ? ' on' : '') + (pulseKey === 'sndCall' ? ' burst' : '')} />
        </div>

        <div className="ringtone-panel">
          <div className="ringtone-head">
            <div>
              <div className="ringtone-title">Рингтон звонка</div>
              <div className="ringtone-sub">Выбор сохраняется на этом устройстве</div>
            </div>
            <button className="ringtone-preview" onClick={(e) => { e.stopPropagation(); playCallSound(ringtone); haptic.tap(); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="7,4 20,12 7,20" /></svg>
              Прослушать
            </button>
          </div>
          <div className="ringtone-grid">
            {RINGTONE_OPTIONS.map(opt => {
              const active = ringtone === opt.id;
              return (
                <button
                  key={opt.id}
                  className={'ringtone-chip' + (active ? ' active' : '')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRingtonePref(opt.id);
                    setRingtone(opt.id);
                    bump('ringtone-' + opt.id);
                    haptic.select();
                    playCallSound(opt.id);
                  }}
                >
                  <span className={'ringtone-mark' + (pulseKey === 'ringtone-' + opt.id ? ' burst' : '')}>
                    {active ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : null}
                  </span>
                  <span className="ringtone-name">{opt.label}</span>
                  <span className="ringtone-desc">{opt.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}
