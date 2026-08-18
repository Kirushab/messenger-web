import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import AnimatedCheckbox from '@/components/AnimatedCheckbox';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { supabase } from '@/lib/supabase';
import { avatarColor } from '@/lib/utils';
import { haptic, isHapticsOn, setHapticsOn } from '@/lib/haptics';
import ZoomableImage from '@/components/ZoomableImage';
import { getCurrentDeviceId } from '@/lib/deviceIdentity';
import { isOwnerEmail } from '@/lib/admin';

type IconProps = { bg: string; children: React.ReactNode };
const Icon = ({ bg, children }: IconProps) => (
  <div className="set-icon" style={{ background: bg }}>{children}</div>
);


type SessionRow = {
  id: string;
  device_id?: string | null;
  device_info?: string | null;
  device_name?: string | null;
  platform?: string | null;
  browser?: string | null;
  os_version?: string | null;
  is_pwa?: boolean | null;
  created_at?: string | null;
  last_active: string;
};

type DeviceEntry = {
  key: string;
  rowIds: string[];
  deviceId: string | null;
  name: string;
  details: string;
  lastActive: string;
  current: boolean;
};

function groupDevices(rows: SessionRow[]): DeviceEntry[] {
  const currentSessionId = localStorage.getItem('sessionId');
  const currentDeviceId = getCurrentDeviceId();
  const grouped = new Map<string, DeviceEntry>();

  for (const row of rows) {
    const legacyName = (row.device_info || 'Устройство').trim();
    // Old rows do not have device_id. Collapse identical legacy labels so the
    // screen stops showing ten Safari logins as ten separate "devices".
    const key = row.device_id ? `device:${row.device_id}` : `legacy:${legacyName.toLowerCase()}`;
    const detailParts = [
      row.platform ? row.platform + (row.os_version ? ` ${row.os_version}` : '') : '',
      row.browser || '',
      row.is_pwa ? 'Приложение' : '',
    ].filter(Boolean);
    const candidate: DeviceEntry = {
      key,
      rowIds: [row.id],
      deviceId: row.device_id || null,
      name: row.device_name || legacyName.split(' · ')[0] || 'Устройство',
      details: detailParts.join(' · ') || legacyName,
      lastActive: row.last_active,
      current: row.id === currentSessionId || Boolean(row.device_id && row.device_id === currentDeviceId),
    };
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, candidate);
      continue;
    }
    existing.rowIds.push(row.id);
    existing.current = existing.current || candidate.current;
    if (new Date(candidate.lastActive).getTime() > new Date(existing.lastActive).getTime()) {
      existing.lastActive = candidate.lastActive;
      existing.name = candidate.name;
      existing.details = candidate.details;
    }
  }

  return [...grouped.values()].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
  });
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut, updateProfile } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.display_name || '');
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');
  const [changingPw, setChangingPw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [devices, setDevices] = useState<DeviceEntry[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (showSessions || changingPw) document.body.dataset.hideTabbar = 'true';
    else delete document.body.dataset.hideTabbar;
    return () => { delete document.body.dataset.hideTabbar; };
  }, [showSessions, changingPw]);

  const [hapticsOn, setHapticsOnState] = useState(() => isHapticsOn());
  const [settingsPulseKey, setSettingsPulseKey] = useState<string>('');
  const bumpSettingsToggle = (key: string) => {
    setSettingsPulseKey(key);
    window.setTimeout(() => setSettingsPulseKey(cur => cur === key ? '' : cur), 420);
  };
  // Эмодзи-клавиатура авто-включается на ПК (isDesktop в utils),
  // на телефонах используется системная — настройка не нужна.
  // compressPhotos убран — сжатие теперь автоматическое в чате (см. compressImage в lib/compress.ts).
  // HD-без-сжатия доступно через отдельную кнопку в attach menu чата.
  // ephemeralBtn убран — функция переехала в attach menu чата (v58.6)
  // фон чата удалён как фича

  const [showBirthdayEdit, setShowBirthdayEdit] = useState(false);
  const currentBirthday = (user as any)?.birthday as string | null | undefined;
  const currentBirthdayVisible = (user as any)?.birthday_visible !== false;
  const [birthdayInput, setBirthdayInput] = useState(currentBirthday || '');
  const [birthdayVisibleInput, setBirthdayVisibleInput] = useState(currentBirthdayVisible);

  const saveBirthday = async () => {
    await updateProfile({
      birthday: birthdayInput || null,
      birthday_visible: birthdayVisibleInput,
    } as any);
    setShowBirthdayEdit(false);
  };

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    haptic.select();
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#000000' : '#FFFFFF');
    localStorage.setItem('theme', next);
    setTheme(next);
    bumpSettingsToggle('theme');
  };

  const save = async () => {
    if (!name.trim()) return;
    const { error } = await updateProfile({ display_name: name.trim() });
    if (!error) setEditing(false);
  };

  const saveBio = async () => {
    const { error } = await updateProfile({ bio: bio.trim() });
    if (!error) setEditingBio(false);
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.warning('Макс. 5 МБ'); return; }
    if (!file.type.startsWith('image/')) { toast.warning('Только изображения'); return; }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      await supabase.storage.from('avatars').remove([path]);
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = data.publicUrl + '?v=' + Date.now();
      await updateProfile({ avatar_url: url });
    } catch (err: any) {
      toast.error('Ошибка загрузки: ' + (err.message || err));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeAvatar = async () => {
    if (!user) return;
    if (!confirm('Удалить фото профиля?')) return;
    await updateProfile({ avatar_url: null });
  };

  const loadSessions = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('last_active', { ascending: false });
    if (error) {
      toast.error('Не удалось загрузить устройства');
      return;
    }
    setDevices(groupDevices((data || []) as SessionRow[]));
    setShowSessions(true);
  };

  const kickDevice = async (device: DeviceEntry) => {
    if (device.current) return;
    if (!confirm(`Выйти на устройстве «${device.name}»?`)) return;
    const { error } = await supabase.from('user_sessions').delete().in('id', device.rowIds);
    if (error) {
      toast.error('Не удалось завершить вход на устройстве');
      return;
    }
    setDevices(items => items.filter(item => item.key !== device.key));
    toast.success('Устройство отключено');
  };

  const handleSignOut = () => {
    if (confirm('Выйти из аккаунта?')) signOut();
  };

  const changePassword = async () => {
    if (newPw.length < 6) { toast.warning('Минимум 6 символов'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) toast.error('Ошибка: ' + error.message);
    else { toast.success('Пароль изменён'); setChangingPw(false); setNewPw(''); }
  };

  const requestAccountDeletion = async () => {
    if (deletingAccount) return;
    if (!confirm('Запросить удаление аккаунта и персональных данных? После подтверждения мы выйдем из аккаунта на этом устройстве.')) return;
    if (!confirm('Подтверди ещё раз: создать запрос на удаление аккаунта?')) return;
    setDeletingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>('account-delete', {
        body: { client: 'web-settings' },
      });
      if (error || data?.error || !data?.ok) throw new Error(error?.message || data?.error || 'Не удалось создать запрос');
      toast.success('Запрос на удаление аккаунта создан');
      await signOut();
    } catch (e: any) {
      toast.error('Не удалось создать запрос: ' + (e?.message || 'ошибка'));
    } finally {
      setDeletingAccount(false);
    }
  };

  const color = avatarColor(user?.id || '');
  const initial = user?.display_name?.[0]?.toUpperCase() || '?';

  return (
    <div className="settings-page">
      {/* Hero section with avatar */}
      <div className="settings-hero">
        <div className="avatar-ring">
          <div style={{ position: 'relative', width: 128, height: 128 }}>
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                onClick={() => setAvatarPreview(user.avatar_url!)}
                className="settings-avatar"
              />
            ) : (
              <div className="settings-avatar settings-avatar-fallback" style={{ background: color }} onClick={() => fileRef.current?.click()}>
                {initial}
              </div>
            )}
            {user?.avatar_url && (
              <button className="avatar-edit-btn" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} aria-label="Изменить фото">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>
            )}
            {uploading && <div style={{position:'absolute',inset:0,borderRadius:64,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center'}}><div className="spinner" /></div>}
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} style={{ display: 'none' }} />
          </div>
        </div>

        {!editing ? (
          <>
            <div className="settings-name" onClick={() => { setEditing(true); setName(user?.display_name || ''); }}>{user?.display_name || 'Без имени'}</div>
            <div className="settings-email">{user?.email}</div>
          </>
        ) : (
          <div style={{ marginTop: 16, maxWidth: 280, marginInline: 'auto' }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              className="profile-name-input"
              style={{ textAlign: 'center', fontSize: 'var(--fs-heading)' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
              <button className="btn-ghost" onClick={() => { setEditing(false); setName(user?.display_name || ''); }}>Отмена</button>
              <button className="btn-primary" onClick={save}>Сохранить</button>
            </div>
          </div>
        )}
      </div>

      {editingBio && <div className="settings-group set-cascade" style={{padding:16}}>
        <input
          value={bio}
          onChange={e => setBio(e.target.value.substring(0, 70))}
          placeholder="Расскажи о себе..."
          maxLength={70}
          autoFocus
          onKeyDown={e => e.key === 'Enter' && saveBio()}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={() => setEditingBio(false)}>Отмена</button>
          <button className="btn-primary" onClick={saveBio}>Сохранить</button>
        </div>
        <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', textAlign: 'right', marginTop: 4 }}>{bio.length}/70</div>
      </div>}

      {/* Account section */}
      <div className="settings-group set-cascade">
        <div className="sg-label">АККАУНТ</div>
        <div className="set-row" onClick={() => { setEditing(true); setName(user?.display_name || ''); }}>
          <Icon bg="#6C5CE7">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </Icon>
          <span className="set-label">Имя</span>
          <span className="set-value">{user?.display_name}</span>
          <svg className="set-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>
        <div className="set-row">
          <Icon bg="#0984E3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </Icon>
          <span className="set-label">Email</span>
          <span className="set-value">{user?.email}</span>
        </div>

        <div className="set-row" onClick={() => { setShowBirthdayEdit(true); setBirthdayInput(currentBirthday || ''); setBirthdayVisibleInput(currentBirthdayVisible); }}>
          <Icon bg="#FBBF24">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7"/><path d="M4 16.5c1 0 1.2-1 2.5-1s1.5 1 2.5 1 1.2-1 2.5-1 1.5 1 2.5 1 1.2-1 2.5-1 1.5 1 2.5 1"/><path d="M2 21h20"/><path d="M7.5 8.5v2.5M12 8.5v2.5M16.5 8.5v2.5"/><path d="M7.5 5h.01M12 5h.01M16.5 5h.01"/></svg>
          </Icon>
          <span className="set-label">День рождения</span>
          <span className="set-value">{currentBirthday
            ? new Date(currentBirthday + 'T00:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'не указан'}</span>
          <svg className="set-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>

        {showBirthdayEdit && (
          <div className="profile-birthday-editor">
            <input
              type="date"
              value={birthdayInput}
              onChange={e => setBirthdayInput(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="profile-birthday-input"
            />
            <div onClick={() => setBirthdayVisibleInput(v => !v)} style={{display:'flex',alignItems:'center',gap:11,padding:'10px 2px', cursor:'pointer', fontSize: 'var(--fs-label)', color:'var(--text)', userSelect:'none'}}>
              <AnimatedCheckbox done={birthdayVisibleInput} onToggle={() => setBirthdayVisibleInput(v => !v)} size={21} />
              Показывать всем (день и месяц в Календаре)
            </div>
            <div className="profile-birthday-actions">
              <button className="btn-ghost" onClick={() => setShowBirthdayEdit(false)}>Отмена</button>
              <button className="btn-primary" onClick={saveBirthday}>Сохранить</button>
            </div>
          </div>
        )}
        {user?.avatar_url && (
          <div className="set-row set-row-danger" onClick={removeAvatar}>
            <Icon bg="transparent">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </Icon>
            <span className="set-label" style={{color:'var(--danger)'}}>Удалить фото профиля</span>
          </div>
        )}
      </div>

      {/* Settings section */}
      <div className="settings-group set-cascade">
        <div className="sg-label">НАСТРОЙКИ</div>
        <div className="set-row" onClick={() => { haptic.select(); navigate('/profile/notifications'); }}>
          <Icon bg="#E17055">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </Icon>
          <span className="set-label">Уведомления и звуки</span>
          <svg className="set-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>

        <div className="set-row" onClick={() => {
          const next = !hapticsOn;
          setHapticsOn(next);
          setHapticsOnState(next);
          bumpSettingsToggle('haptics');
          if (next) haptic.select();
        }}>
          <Icon bg="#14B8A6">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m2 8 2 2-2 2 2 2-2 2"/><path d="m22 8-2 2 2 2-2 2 2 2"/><rect width="8" height="14" x="8" y="5" rx="1"/></svg>
          </Icon>
          <span className="set-label">Вибрация</span>
          <span className={'set-toggle' + (hapticsOn ? ' on' : '') + (settingsPulseKey === 'haptics' ? ' burst' : '')} />
        </div>

        <div className="set-row" onClick={toggleTheme}>
          <Icon bg={theme === 'dark' ? '#1E293B' : '#FBBF24'}>
            <span className="theme-ico" key={theme}>
            {theme === 'dark'
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4.5"/><line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/><line x1="4.58" y1="4.58" x2="6.35" y2="6.35"/><line x1="17.65" y1="17.65" x2="19.42" y2="19.42"/><line x1="4.58" y1="19.42" x2="6.35" y2="17.65"/><line x1="17.65" y1="6.35" x2="19.42" y2="4.58"/></svg>}
            </span>
          </Icon>
          <span className="set-label">Тёмная тема</span>
          <span className={'set-toggle' + (theme === 'dark' ? ' on' : '') + (settingsPulseKey === 'theme' ? ' burst' : '')} />
        </div>

        <div className="set-row" onClick={() => navigate('/profile/appearance')}>
          <Icon bg="#6C5CE7">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </Icon>
          <span className="set-label">Оформление</span>
          <svg className="set-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>

      {/* Сервисы — показываем только если есть хотя бы один сервис для пользователя. */}
      {(user as any)?.fedya_access && (
      <div className="settings-group set-cascade">
        <div className="sg-label">СЕРВИСЫ</div>
        {(user as any)?.fedya_access && (
          <div className="set-row" onClick={() => navigate('/fedya')}>
            <Icon bg="#8B5CF6">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="5"/>
                <path d="M20 21a8 8 0 1 0-16 0"/>
              </svg>
            </Icon>
            <span className="set-label">Для Феди</span>
            <svg className="set-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        )}
      </div>
      )}

      {/* Security section */}
      <div className="settings-group set-cascade settings-security-group">
        <div className="sg-label">БЕЗОПАСНОСТЬ</div>
        <div className="set-row" onClick={() => setChangingPw(!changingPw)}>
          <Icon bg="#FF6B6B">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </Icon>
          <span className="set-label">Сменить пароль</span>
          <svg className="set-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>
        {changingPw && <div className="settings-inline-editor">
          <input
            type="password"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            placeholder="Новый пароль (мин. 6)"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && changePassword()}
          />
          <div className="settings-inline-actions">
            <button className="btn-ghost" onClick={() => {setChangingPw(false); setNewPw('');}}>Отмена</button>
            <button className="btn-primary" onClick={changePassword}>Изменить</button>
          </div>
        </div>}

        {isOwnerEmail(user?.email) && (
          <div className="set-row" onClick={() => navigate('/apps')}>
            <Icon bg="#111111">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
            </Icon>
            <span className="set-label">Консоль владельца</span>
            <svg className="set-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        )}

        <div className="set-row" onClick={loadSessions}>
          <Icon bg="var(--accent)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="3"/><path d="M9 5h6M11 18h2"/></svg>
          </Icon>
          <span className="set-label">Устройства</span>
          <svg className="set-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>

        <div className="set-row set-row-danger" onClick={requestAccountDeletion} style={{ opacity: deletingAccount ? 0.65 : 1, pointerEvents: deletingAccount ? 'none' : 'auto' }}>
          <Icon bg="transparent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </Icon>
          <span className="set-label" style={{ color: 'var(--danger)' }}>{deletingAccount ? 'Создаём запрос...' : 'Удалить аккаунт и данные'}</span>
          <svg className="set-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>

        <div className="set-row set-row-danger" onClick={handleSignOut}>
          <Icon bg="transparent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </Icon>
          <span className="set-label" style={{color:'var(--danger)'}}>Выйти из аккаунта</span>
        </div>
      </div>

      {avatarPreview && createPortal(
        <div className="photo-viewer" onClick={() => setAvatarPreview(null)}>
          <ZoomableImage src={avatarPreview} onClose={() => setAvatarPreview(null)} />
          <button className="photo-viewer-close" onClick={() => setAvatarPreview(null)} aria-label="Закрыть">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>,
        document.body
      )}

      {/* Devices modal */}
      {showSessions && <div className="modal-overlay" onClick={() => setShowSessions(false)}>
        <div className="modal-content devices-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2>УСТРОЙСТВА</h2>
              <div className="devices-modal-subtitle">Одна установка приложения или браузера — одно устройство</div>
            </div>
            <button className="modal-close" onClick={() => setShowSessions(false)} aria-label="Закрыть"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
          </div>
          {devices.length === 0 && <div className="devices-empty">Нет активных устройств</div>}
          {devices.map(device => {
            const dev = `${device.name} ${device.details}`.toLowerCase();
            const icon = dev.includes('iphone') || dev.includes('ipad') || dev.includes('android')
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M10 5h4M11 18h2"/></svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2.5"/><path d="M8 21h8M12 17v4"/></svg>;
            const fmtActive = (iso: string) => {
              const d = new Date(iso);
              const diff = Date.now() - d.getTime();
              if (diff < 60000) return 'только что';
              if (diff < 3600000) return Math.floor(diff/60000) + ' мин назад';
              if (diff < 86400000) return Math.floor(diff/3600000) + ' ч назад';
              return d.toLocaleDateString('ru-RU');
            };
            return (
              <div key={device.key} className={'device-card' + (device.current ? ' current' : '')}>
                <div className="device-card-icon">{icon}</div>
                <div className="device-card-copy">
                  <div className="device-card-title">
                    <span>{device.name}</span>
                    {device.current && <span className="device-current-badge">ТЕКУЩЕЕ</span>}
                  </div>
                  <div className="device-card-detail">{device.details}</div>
                  <div className="device-card-active">Активно {fmtActive(device.lastActive)}</div>
                </div>
                {!device.current && <button className="device-logout-button" onClick={() => kickDevice(device)}>Выйти</button>}
              </div>
            );
          })}
          {devices.some(device => !device.current) && (
            <div className="devices-modal-footer">
              <button
                className="devices-logout-all"
                onClick={async () => {
                  if (!confirm('Выйти со всех других устройств?')) return;
                  const otherIds = devices.filter(device => !device.current).flatMap(device => device.rowIds);
                  if (otherIds.length === 0) return;
                  const { error } = await supabase.from('user_sessions').delete().in('id', otherIds);
                  if (error) { toast.error('Не удалось отключить другие устройства'); return; }
                  setDevices(items => items.filter(device => device.current));
                  toast.success('Другие устройства отключены');
                }}
              >
                Выйти со всех других устройств
              </button>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
