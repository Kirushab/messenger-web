import { useState, useRef, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { triggerConfetti } from '@/lib/confetti';
import { compressImage } from '@/lib/compress';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { useEventsStore, type EventType } from '@/stores/eventsStore';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import { haptic } from '@/lib/haptics';
import { IconCamera, IconCar } from '@/components/icons/EventIcons';


function BlockIcon({ id }: { id: string }) {
  const common = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (id) {
    case 'gallery': return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8" cy="10" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>;
    case 'checklist': return <svg {...common}><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/></svg>;
    case 'schedule': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'wishlist': return <svg {...common}><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 2.2-3.7L12 7Zm0 0h4.5a2.5 2.5 0 1 0-2.2-3.7L12 7Z"/></svg>;
    case 'notes': return <svg {...common}><path d="M4 4h12l4 4v12H4z"/><path d="M16 4v5h5"/><path d="M8 13h8M8 17h5"/></svg>;
    case 'links': return <svg {...common}><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/></svg>;
    case 'contacts': return <svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.4a2 2 0 0 1-.6 1.8L7.6 9.2a16 16 0 0 0 7.2 7.2l1.3-1.3a2 2 0 0 1 1.8-.6l2.4.4a2 2 0 0 1 1.7 2Z"/></svg>;
    case 'bringing': return <svg {...common}><path d="M5 11h14l-1.5 9h-11L5 11Z"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M9 15h6"/></svg>;
    case 'activities': return <svg {...common}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v4M21 12h-4M12 21v-4M3 12h4"/></svg>;
    case 'poll': return <svg {...common}><path d="M4 19V5"/><rect x="7" y="13" width="3" height="6" rx="1"/><rect x="12" y="9" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="14" rx="1"/></svg>;
    case 'splitbill': return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/><path d="M16 16h.01"/></svg>;
    case 'housing': return <svg {...common}><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>;
    case 'cars': return <IconCar size={17} strokeWidth={1.9} />;
    case 'weather_hourly': return <svg {...common}><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/><circle cx="12" cy="12" r="4"/></svg>;
    case 'checkin': return <svg {...common}><path d="M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path d="M19.5 10c0 7.2-7.5 12-7.5 12S4.5 17.2 4.5 10a7.5 7.5 0 1 1 15 0Z"/></svg>;
    case 'roadmap': return <svg {...common}><path d="M4 6h7M4 12h11M4 18h7"/><path d="M17 6h3M19 4v4M19 16v4M17 18h3"/></svg>;
    case 'movies': return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h18M3 15h18"/></svg>;
    case 'personal_program': return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-5"/></svg>;
    case 'survey': return <svg {...common}><path d="M9 4h6l1 2h3v16H5V6h3l1-2Z"/><path d="M9 12h6M9 16h4"/></svg>;
    case 'emergency': return <svg {...common}><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 18h.01"/></svg>;
    case 'route_checkin': return <svg {...common}><path d="M5 19c4-5 10-5 14-10"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="9" r="2"/><path d="M9 5h6"/></svg>;
    case 'lost_found': return <svg {...common}><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/><path d="M12 11v.01M12 15h.01"/></svg>;
    case 'sim_info': return <svg {...common}><path d="M7 2h8l4 4v16H7z"/><path d="M15 2v5h5"/><path d="M10 13h6M10 17h4"/></svg>;
    case 'preferences': return <svg {...common}><path d="M6 3v8"/><path d="M8.5 3v8"/><path d="M11 3v8"/><path d="M8.5 11v10"/><path d="M16 4v17"/><path d="M16 4c2.2 0 3.5 1.5 3.5 3.6S18.2 11.2 16 11.2"/><path d="M14.5 21h3"/></svg>;
    case 'transport': return <svg {...common}><path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2l-1.2 1.2L9 12l-2 2H4l-1 1 4 1 1 4 1-1v-3l2-2 4.6 5.5 1.2-1.3Z"/></svg>;
    case 'places': return <svg {...common}><path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 1 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>;
    case 'shopping': return <svg {...common}><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 3h3l2.2 12.2a2 2 0 0 0 2 1.8h8.8a2 2 0 0 0 2-1.6L21 8H6"/></svg>;
    case 'packing': return <svg {...common}><rect x="5" y="7" width="14" height="14" rx="3"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/><path d="M9 12h6M9 16h4"/></svg>;
    case 'diary': return <svg {...common}><path d="M6 4h11a3 3 0 0 1 3 3v13H8a4 4 0 0 1-4-4V6a2 2 0 0 1 2-2Z"/><path d="M8 4v17M11 9h5M11 13h4"/></svg>;
    default: return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12h8"/></svg>;
  }
}

function CheckMiniIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="anim-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px' }}>
      <path d="M21 12a9 9 0 0 1-9 9" />
      <path d="M3 12a9 9 0 0 1 9-9" opacity="0.35" />
    </svg>
  );
}


function UploadPhotoIcon() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 48,
        height: 48,
        borderRadius: 16,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 22px rgba(0,0,0,.06)',
      }}
    >
      <IconCamera size={23} strokeWidth={1.8} />
    </span>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}


export default function CreateEvent() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { createEvent } = useEventsStore();

  const [type, setType] = useState<EventType>(
    (params.get('type') as EventType) === 'trip' ? 'trip' : 'party'
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const uploadCover = async (file: File | undefined) => {
    if (!file || !myId || uploadingCover) return;
    if (!file.type.startsWith('image/')) { toast.error('Нужен файл изображения'); return; }
    setUploadingCover(true);
    try {
      const compressed = await compressImage(file, 1600, 0.85);
      const ext = (compressed.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `covers/${myId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('event-photos').upload(path, compressed, { upsert: false });
      if (upErr) { toast.error('Не удалось загрузить: ' + upErr.message); return; }
      const { data: pub } = supabase.storage.from('event-photos').getPublicUrl(path);
      setCoverUrl(pub.publicUrl);
    } finally {
      setUploadingCover(false);
    }
  };
  const [dressCode, setDressCode] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetCurrency, setBudgetCurrency] = useState('₽');
  const [isBirthday, setIsBirthday] = useState(false);
  const [organizerNotes, setOrganizerNotes] = useState('');
  // Конструктор блоков: какие блоки показывать на странице события.
  // По умолчанию — рекомендованный набор по типу. Юзер может включить/выключить любые.
  const DEFAULT_BLOCKS_PARTY = ['gallery', 'checklist', 'schedule', 'notes', 'activities', 'bringing', 'poll', 'splitbill', 'checkin', 'movies', 'preferences'];
  const DEFAULT_BLOCKS_TRIP = ['gallery', 'checklist', 'schedule', 'transport', 'housing', 'cars', 'places', 'shopping', 'packing', 'diary', 'notes', 'links', 'contacts', 'weather_hourly', 'roadmap', 'emergency', 'route_checkin', 'sim_info', 'preferences', 'survey'];
  const [enabledBlocks, setEnabledBlocks] = useState<string[]>(
    (params.get('type') as EventType) === 'trip' ? DEFAULT_BLOCKS_TRIP : DEFAULT_BLOCKS_PARTY
  );
  const toggleBlock = (id: string) => {
    haptic.select();
    setEnabledBlocks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const [meetingPoint, setMeetingPoint] = useState('');
  const [meetingPointLat, setMeetingPointLat] = useState<number | null>(null);
  const [meetingPointLng, setMeetingPointLng] = useState<number | null>(null);
  const [meetingAt, setMeetingAt] = useState('');
  const [plusOnesLimit, setPlusOnesLimit] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = title.trim().length > 0 && startDate.length > 0;

  const handleSubmit = async () => {
    if (!myId || !isValid) return;
    setSubmitting(true);
    setError(null);

    const startTimeFinal = startTime || (type === 'party' ? '20:00' : '12:00');
    const startISO = new Date(`${startDate}T${startTimeFinal}:00`).toISOString();
    const endISO = endDate ? new Date(`${endDate}T23:59:59`).toISOString() : undefined;

    // Защита от зависания на 20 секунд
    const timeoutPromise = new Promise<{ id: null; error: string }>((resolve) =>
      setTimeout(() => resolve({ id: null, error: 'Сервер не отвечает. Попробуйте ещё раз.' }), 20000)
    );

    const result = await Promise.race([
      createEvent({
        type, creatorId: myId, title,
        description: description || undefined,
        start_at: startISO, end_at: endISO,
        location_name: locationName || undefined,
        location_lat: locationLat ?? undefined,
        location_lng: locationLng ?? undefined,
        cover_url: coverUrl || undefined,
      }),
      timeoutPromise,
    ]);

    // Обновляем дополнительные поля (бюджет, дресс-код, ДР)
    if (result.id) {
      const extra: any = {};
      if (dressCode.trim()) extra.dress_code = dressCode.trim();
      if (budgetAmount.trim()) {
        const n = parseInt(budgetAmount.replace(/[^\d]/g, ''));
        if (!isNaN(n) && n > 0) {
          extra.budget_per_person = n;
          extra.budget_currency = budgetCurrency;
        }
      }
      if (isBirthday) extra.is_birthday = true;
      if (organizerNotes.trim()) extra.organizer_notes = organizerNotes.trim();
      if (plusOnesLimit > 0) extra.plus_ones_limit = plusOnesLimit;
      // Конструктор: сохраняем выбранные блоки
      extra.enabled_blocks = enabledBlocks;
      if (type === 'trip') {
        if (meetingPoint.trim()) extra.meeting_point = meetingPoint.trim();
        if (meetingPointLat !== null) extra.meeting_point_lat = meetingPointLat;
        if (meetingPointLng !== null) extra.meeting_point_lng = meetingPointLng;
        if (meetingAt) extra.meeting_at = new Date(meetingAt).toISOString();
      }
      if (Object.keys(extra).length > 0) {
        await supabase.from('events').update(extra).eq('id', result.id);
      }
    }

    setSubmitting(false);
    if (result.error) {
      // Понятное сообщение если 034 не применена
      const msg = result.error.includes('title') && result.error.includes('conversations')
        ? 'Нужно применить миграцию 034 в Supabase'
        : result.error;
      setError(msg);
      return;
    }
    if (result.id) {
      haptic.success();
      // Маленький салют при создании
      triggerConfetti({
        count: 60,
        colors: type === 'party'
          ? ['#EC4899', '#F472B6', '#FBBF24', '#FFFFFF']
          : ['#3B82F6', '#60A5FA', '#10B981', '#FFFFFF'],
        power: 11,
        duration: 2000,
      });
      nav('/events/' + result.id, { replace: true });
    }
  };

  const TYPE_LABELS: Record<EventType, { label: string; icon: ReactNode }> = {
    party: {
      label: 'Туса',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.8 11.3 2 22l10.7-3.79"/>
          <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/>
          <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/>
          <path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>
        </svg>
      )
    },
    trip: {
      label: 'Поездка',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
        </svg>
      )
    },
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div className="page-header" style={{display:'flex',alignItems:'center',gap:12,paddingBottom:8}}>
        <button onClick={() => nav(-1)} aria-label="Назад" style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:6,marginLeft:-6,lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center'}}><BackIcon /></button>
        <h1 style={{fontSize: 'var(--fs-title)', textTransform:'none', letterSpacing:0}}>
          Новое событие
        </h1>
      </div>

      <div className="page-scroll ce-form create-event-form" style={{padding:'8px 16px 32px'}}>
        <Label>Тип</Label>
        <div style={{position:'relative', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16}}>
          <div style={{position:'absolute', top:0, bottom:0, left:0, width:'calc(50% - 4px)', borderRadius:10, background:'var(--surface-light)', border:'2px solid var(--primary)', transform: type === 'trip' ? 'translateX(calc(100% + 8px))' : 'translateX(0)', transition:'transform .26s cubic-bezier(0.16,1,0.3,1)', pointerEvents:'none'}} />
          {(['party', 'trip'] as EventType[]).map(t => {
            const m = TYPE_LABELS[t];
            const active = type === t;
            return (
              <button
                key={t}
                onClick={() => { haptic.tap(); setType(t); }}
                style={{
                  position:'relative', zIndex:1,
                  padding:'14px',
                  borderRadius:10,
                  border:'2px solid transparent',
                  background:'transparent',
                  cursor:'pointer',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                  color:'var(--text)', fontSize: 'var(--fs-label)',
                  fontWeight: active ? 600 : 500,
                  transition:'font-weight .2s',
                }}
              >
                <span style={{display:'flex',alignItems:'center',justifyContent:'center'}}>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        <Label>Название</Label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={type === 'party' ? 'День рождения у меня' : 'Поездка в Грузию'}
          maxLength={100}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16}}
        />

        <Label>Дата начала</Label>
        <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:16}}>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            style={{width:'100%',minWidth:0,boxSizing:'border-box',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)', fontFamily:'inherit'}}
          />
          {type === 'party' && (
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              style={{width:'100%',minWidth:0,boxSizing:'border-box',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)', fontFamily:'inherit'}}
            />
          )}
        </div>

        {type === 'trip' && (
          <>
            <Label optional>Дата конца</Label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={startDate || new Date().toISOString().slice(0, 10)}
              style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16, fontFamily:'inherit'}}
            />
          </>
        )}

        <Label optional>{type === 'party' ? 'Место' : 'Куда'}</Label>
        <LocationAutocomplete
          value={locationName}
          onChange={(text, lat, lng) => {
            setLocationName(text);
            setLocationLat(lat ?? null);
            setLocationLng(lng ?? null);
          }}
          placeholder={type === 'party' ? 'У Кирилла дома, ул. Ленина 5' : 'Тбилиси, Грузия'}
        />

        <Label optional>Описание</Label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Что да как"
          maxLength={500}
          rows={3}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16,resize:'vertical',fontFamily:'inherit'}}
        />

        <Label optional>Обложка</Label>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => { uploadCover(e.target.files?.[0]); e.target.value = ''; }}
        />
        {coverUrl ? (
          <div style={{ position:'relative', marginBottom:16, borderRadius:12, overflow:'hidden' }}>
            <img key={coverUrl} className="ce-cover-img" src={coverUrl} alt="Обложка" style={{ width:'100%', maxHeight:200, objectFit:'cover', display:'block' }} />
            <div style={{ position:'absolute', top:8, right:8, display:'flex', gap:8 }}>
              <button
                type="button"
                onClick={() => { haptic.tap(); coverInputRef.current?.click(); }}
                disabled={uploadingCover}
                style={{ padding:'7px 12px', borderRadius:10, border:'none', background:'rgba(0,0,0,0.55)', color:'#fff', fontSize: 'var(--fs-label)', fontWeight:600, cursor:'pointer', backdropFilter:'blur(4px)' }}
              >{uploadingCover ? <SpinnerIcon /> : 'Заменить'}</button>
              <button
                type="button"
                onClick={() => { haptic.tap(); setCoverUrl(''); }}
                disabled={uploadingCover}
                style={{ padding:'7px 12px', borderRadius:10, border:'none', background:'rgba(0,0,0,0.55)', color:'#fff', fontSize: 'var(--fs-label)', fontWeight:600, cursor:'pointer', backdropFilter:'blur(4px)' }}
              >Удалить</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="event-cover-picker"
            onClick={() => { haptic.tap(); coverInputRef.current?.click(); }}
            disabled={uploadingCover}
            style={{
              width:'100%',
              minHeight:156,
              padding:'24px 16px',
              marginBottom:16,
              borderRadius:18,
              border:'1px solid var(--border)',
              background:'var(--surface-light)',
              color:'var(--text)',
              cursor:'pointer',
              display:'flex',
              flexDirection:'column',
              alignItems:'center',
              justifyContent:'center',
              gap:10,
              boxSizing:'border-box',
            }}
          >
            {uploadingCover ? <SpinnerIcon /> : <UploadPhotoIcon />}
            <span style={{ fontSize: 'var(--fs-snap14)', fontWeight:700 }}>
              {uploadingCover ? 'Загружаем обложку…' : 'Добавить обложку'}
            </span>
            <span style={{ fontSize: 'var(--fs-caption)', color:'var(--muted)', fontWeight:500 }}>
              Необязательно · JPG, PNG или HEIC
            </span>
          </button>
        )}

        {type === 'party' && (
          <>
            <Label optional>Дресс-код / тематика</Label>
            <input
              value={dressCode}
              onChange={e => setDressCode(e.target.value)}
              placeholder="Чёрный галстук, 90-е, чилл..."
              maxLength={80}
              style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16}}
            />
          </>
        )}

        <Label optional>Бюджет на человека</Label>
        <div style={{display:'flex',gap:8,marginBottom:16,minWidth:0}}>
          <input
            value={budgetAmount}
            onChange={e => setBudgetAmount(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="например 5000"
            inputMode="numeric"
            style={{flex:1,minWidth:0,padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)'}}
          />
          <select
            value={budgetCurrency}
            onChange={e => setBudgetCurrency(e.target.value)}
            style={{flexShrink:0,width:76,padding:'12px 8px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)'}}
          >
            <option value="₽">₽</option>
            <option value="$">$</option>
            <option value="€">€</option>
            <option value="GEL">₾</option>
          </select>
        </div>

        {type === 'party' && (
          <div
            onClick={() => { haptic.tap(); setIsBirthday(b => !b); }}
            style={{
              display:'flex',alignItems:'center',gap:12,padding:'10px 14px',
              background:'var(--surface-light)',borderRadius:12,cursor:'pointer',marginBottom:18,
              border: isBirthday ? '1px solid var(--primary)' : '1px solid var(--border)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16c1.5 1 2.5 1 4 0s2.5-1 4 0 2.5 1 4 0 2.5-1 4 0"/><path d="M2 21h20"/><path d="M7 8v3M12 8v3M17 8v3"/><path d="M7 4h.01M12 4h.01M17 4h.01"/></svg>
            <div style={{flex:1}}>
              <div style={{fontSize: 'var(--fs-snap14)',fontWeight:500,color:'var(--text)'}}>Это мой День Рождения</div>
              <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',marginTop:2}}>
                Откроется Wishlist. Брони подарков скрыты от вас — сюрприз.
              </div>
            </div>
            <div style={{
              width:42,height:26,borderRadius:13,
              background: isBirthday ? 'var(--primary)' : 'var(--border)',
              position:'relative',transition:'background 0.2s',
            }}>
              <div style={{
                position:'absolute',top:3,left: isBirthday ? 19 : 3,
                width:20,height:20,borderRadius:10,background:'#fff',
                transition:'left 0.2s',
                boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </div>
          </div>
        )}

        {type === 'party' && (
          <>
            <Label optional>Можно привести с собой</Label>
            <div style={{display:'flex',gap:8,marginBottom:18}}>
              {[0, 1, 2, 3, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { haptic.tap(); setPlusOnesLimit(n); }}
                  style={{
                    flex:1,padding:'10px',borderRadius:10,
                    border: plusOnesLimit === n ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: plusOnesLimit === n ? 'var(--surface-light)' : 'transparent',
                    color:'var(--text)',fontSize: 'var(--fs-label)',fontWeight: plusOnesLimit === n ? 600 : 500,
                    cursor:'pointer',
                  }}
                >{n === 0 ? 'нет' : `+${n}`}</button>
              ))}
            </div>
          </>
        )}

        {type === 'trip' && (
          <>
            <Label optional>Точка сбора (где встречаемся)</Label>
            <LocationAutocomplete
              value={meetingPoint}
              onChange={(text, lat, lng) => {
                setMeetingPoint(text);
                setMeetingPointLat(lat ?? null);
                setMeetingPointLng(lng ?? null);
              }}
              placeholder="Шереметьево, терминал D"
            />

            <Label optional>Время сбора</Label>
            <input
              type="datetime-local"
              value={meetingAt}
              onChange={e => setMeetingAt(e.target.value)}
              style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16,fontFamily:'inherit'}}
            />
          </>
        )}

        <Label optional>Заметка от организатора</Label>
        <textarea
          value={organizerNotes}
          onChange={e => setOrganizerNotes(e.target.value)}
          placeholder="Парковка с задней стороны, домофон 25..."
          maxLength={500}
          rows={2}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16,resize:'vertical',fontFamily:'inherit'}}
        />

        {/* === Конструктор блоков === */}
        <div style={{marginBottom:24, padding:'14px', borderRadius:18, background:'var(--surface)', border:'1px solid var(--border)', boxShadow:'0 10px 26px rgba(0,0,0,0.04)'}}>
          <Label optional>Какие блоки показывать в событии</Label>
          <div style={{fontSize:'var(--fs-caption)', color:'var(--muted)', marginBottom:12, lineHeight:1.45}}>
            Выбери только те модули, которые реально нужны. Так страница события будет чище и удобнее.
          </div>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:10, flexWrap:'wrap'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
              <span style={{display:'inline-flex', alignItems:'center', gap:6, padding:'7px 10px', borderRadius:999, background:'var(--surface-light)', border:'1px solid var(--border)', fontSize:'var(--fs-caption)', color:'var(--muted)'}}>Выбрано <b style={{color:'var(--text)'}}>{enabledBlocks.length}</b></span>
              <span style={{fontSize:'var(--fs-micro)', color:'var(--muted)'}}>Можно включать и выключать в один тап</span>
            </div>
            <button type="button" onClick={() => { haptic.tap(); setEnabledBlocks(type === 'trip' ? DEFAULT_BLOCKS_TRIP : DEFAULT_BLOCKS_PARTY); }} style={{background:'var(--surface-light)', border:'1px solid var(--border)', color:'var(--primary)', borderRadius:12, padding:'8px 12px', fontSize:'var(--fs-label)', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 10px rgba(0,0,0,0.03)'}}>Рекомендуемые</button>
          </div>
          <div className="ce-block-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(158px, 1fr))', gap:10}}>
            {[
              { id: 'gallery',        title: 'Фотогалерея',    desc: 'Общие фото' },
              { id: 'checklist',      title: 'Чек-лист',       desc: 'Что взять' },
              { id: 'schedule',       title: 'Расписание',     desc: 'План по часам' },
              { id: 'wishlist',       title: 'Желания',        desc: 'Подарки (ДР)' },
              { id: 'notes',          title: 'Заметки',        desc: 'Информация' },
              { id: 'links',          title: 'Ссылки',         desc: 'Документы' },
              { id: 'contacts',       title: 'Контакты',       desc: 'Связь' },
              { id: 'bringing',       title: 'Кто что несёт',  desc: 'Разбор позиций' },
              { id: 'activities',     title: 'Активности',     desc: 'Голосование' },
              { id: 'poll',           title: 'Опросы',         desc: 'Несколько вариантов' },
              { id: 'splitbill',      title: 'Скидываемся',    desc: 'Скидывание' },
              { id: 'housing',        title: 'Жильё',          desc: 'Отель/аренда' },
              { id: 'cars',           title: 'Машины',         desc: 'Кто за рулём' },
              { id: 'weather_hourly', title: 'Погода',         desc: 'Почасовая' },
              { id: 'checkin',        title: 'Чек-ин «я тут»', desc: 'Отметка прибытия' },
              { id: 'roadmap',        title: 'Подготовка',     desc: 'Этапы' },
              { id: 'movies',         title: 'Фильмы',         desc: 'Голосование' },
              { id: 'personal_program', title: 'Персонально',  desc: 'Кому что' },
              { id: 'survey',         title: 'Анкета',         desc: 'Аллергии и т.д.' },
              { id: 'emergency',      title: 'Экстренные',     desc: 'SOS' },
              { id: 'route_checkin',  title: 'Чек-ин маршрута', desc: 'Точки пути' },
              { id: 'lost_found',     title: 'Бюро находок',   desc: 'Потеряно/найдено' },
              { id: 'sim_info',       title: 'SIM / eSIM',     desc: 'Связь в поездке' },
              { id: 'preferences',    title: 'Что пьёт / ест', desc: 'Предпочтения' },
              { id: 'transport',      title: 'Транспорт',      desc: 'Билеты' },
              { id: 'places',         title: 'Места',          desc: 'Что посетить' },
              { id: 'shopping',       title: 'Покупки',        desc: 'Общий список' },
              { id: 'packing',        title: 'Багаж',          desc: 'Личный список' },
              { id: 'diary',          title: 'Дневник',        desc: 'Впечатления' },
            ].map((b, bi) => {
              const active = enabledBlocks.includes(b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => toggleBlock(b.id)}
                  className="ce-block"
                  style={{
                    display:'flex', flexDirection:'column', alignItems:'flex-start', gap:8,
                    minHeight:92, padding:'12px 12px 11px', borderRadius:16, position:'relative',
                    animationDelay: Math.min(bi, 16) * 22 + 'ms',
                    background: active ? 'color-mix(in srgb, var(--primary) 10%, var(--surface))' : 'var(--surface-light)',
                    border: active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    color:'var(--text)',
                    cursor:'pointer', textAlign:'left',
                    boxShadow: active ? '0 10px 20px color-mix(in srgb, var(--primary) 14%, transparent)' : '0 3px 10px rgba(0,0,0,0.02)',
                    transition:'background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
                    transform: active ? 'translateY(-1px)' : 'none',
                  }}
                >
                  <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', width:'100%', gap:10}}>
                    <span style={{ width:36, height:36, borderRadius:12, display:'inline-flex', alignItems:'center', justifyContent:'center', background: active ? 'var(--primary)' : 'var(--surface)', border: active ? '1px solid var(--primary)' : '1px solid var(--border)', color: active ? 'var(--bg)' : 'var(--text)' }} className="ce-block-icon"><BlockIcon id={b.id} /></span>
                    <span style={{ width:24, height:24, borderRadius:12, display:'inline-flex', alignItems:'center', justifyContent:'center', background: active ? 'var(--primary)' : 'transparent', border: active ? 'none' : '1px solid var(--border)', color: active ? 'var(--bg)' : 'transparent', flexShrink:0 }}>
                      <CheckMiniIcon />
                    </span>
                  </div>
                  <div style={{fontSize:'var(--fs-label)', fontWeight:700, lineHeight:1.2}}>{b.title}</div>
                  <div style={{fontSize:'var(--fs-micro)', color:'var(--muted)', lineHeight:1.35}}>{b.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="anim-fade-in" style={{
            background:'rgba(239,68,68,0.1)', color:'#EF4444',
            padding:'10px 12px', borderRadius:8, fontSize: 'var(--fs-label)', marginBottom:12,
          }}>{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          style={{
            width:'100%', padding:'14px',
            background: isValid ? 'var(--primary)' : 'var(--surface-light)',
            color: isValid ? 'var(--bg)' : 'var(--muted)',
            border:'none', borderRadius:10,
            fontSize: 'var(--fs-body)', fontWeight:600,
            cursor: isValid && !submitting ? 'pointer' : 'default',
          }}
        >{submitting ? <><SpinnerIcon /> Создаём...</> : 'Создать событие'}</button>
        {!isValid && !submitting && (
          <div style={{textAlign:'center', fontSize:'var(--fs-caption)', color:'var(--muted)', marginTop:8}}>
            {!title.trim() && !startDate ? 'Укажите название и дату начала' : !title.trim() ? 'Укажите название' : 'Укажите дату начала'}
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{
      fontSize: 'var(--fs-micro)', fontWeight:600, color:'var(--muted)',
      marginBottom:6, letterSpacing:0.3, textTransform:'uppercase',
    }}>
      {children}
      {optional && <span style={{textTransform:'none', fontWeight:500, marginLeft:6, opacity:0.7}}>(опц.)</span>}
    </div>
  );
}
