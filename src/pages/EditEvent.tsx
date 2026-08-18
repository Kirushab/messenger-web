import { useEffect, useState, useRef } from 'react';
import { goBack } from '@/lib/nav';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/compress';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { useEventsStore } from '@/stores/eventsStore';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import { haptic } from '@/lib/haptics';
import { IconCamera, IconPartyPopper, IconPlane } from '@/components/icons/EventIcons';

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="anim-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" style={{ display:'inline-block', verticalAlign:'-2px' }}>
      <path d="M21 12a9 9 0 0 1-9 9" /><path d="M3 12a9 9 0 0 1 9-9" opacity="0.35" />
    </svg>
  );
}

function UploadPhotoIcon() {
  return (
    <span aria-hidden="true" style={{ width:48, height:48, borderRadius:16, display:'inline-flex', alignItems:'center', justifyContent:'center', color:'var(--text)', background:'var(--surface)', border:'1px solid var(--border)', boxShadow:'0 8px 22px rgba(0,0,0,.06)' }}>
      <IconCamera size={23} strokeWidth={1.8} />
    </span>
  );
}

export default function EditEvent() {
  const nav = useNavigate();
  const { id } = useParams();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { updateEvent } = useEventsStore();

  const [type, setType] = useState<'party' | 'trip'>('party');
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
  const [meetingPoint, setMeetingPoint] = useState('');
  const [meetingPointLat, setMeetingPointLat] = useState<number | null>(null);
  const [meetingPointLng, setMeetingPointLng] = useState<number | null>(null);
  const [meetingAt, setMeetingAt] = useState('');
  const [plusOnesLimit, setPlusOnesLimit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) {
        setError('Событие не найдено');
        setLoading(false);
        return;
      }
      setCreatorId(data.creator_id);
      setType(data.type);
      setTitle(data.title || '');
      setDescription(data.description || '');
      const sd = new Date(data.start_at);
      setStartDate(sd.toISOString().slice(0, 10));
      setStartTime(sd.toISOString().slice(11, 16));
      if (data.end_at) setEndDate(new Date(data.end_at).toISOString().slice(0, 10));
      setLocationName(data.location_name || '');
      setLocationLat(data.location_lat ?? null);
      setLocationLng(data.location_lng ?? null);
      setCoverUrl(data.cover_url || '');
      setDressCode(data.dress_code || '');
      setBudgetAmount(data.budget_per_person ? String(data.budget_per_person) : '');
      setBudgetCurrency(data.budget_currency || '₽');
      setIsBirthday(!!data.is_birthday);
      setOrganizerNotes(data.organizer_notes || '');
      setMeetingPoint(data.meeting_point || '');
      setMeetingPointLat(data.meeting_point_lat ?? null);
      setMeetingPointLng(data.meeting_point_lng ?? null);
      setMeetingAt(data.meeting_at ? new Date(data.meeting_at).toISOString().slice(0, 16) : '');
      setPlusOnesLimit(data.plus_ones_limit || 0);
      setLoading(false);
    })();
  }, [id]);

  const isValid = title.trim().length > 0 && startDate.length > 0;
  const isCreator = myId && creatorId && myId === creatorId;

  const handleSubmit = async () => {
    if (!id || !isValid || !isCreator) return;
    setSubmitting(true);
    setError(null);

    const startTimeFinal = startTime || (type === 'party' ? '20:00' : '12:00');
    const startISO = new Date(`${startDate}T${startTimeFinal}:00`).toISOString();
    const endISO = endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null;

    const patch: any = {
      type,
      title: title.trim(),
      description: description.trim() || null,
      start_at: startISO,
      end_at: endISO,
      location_name: locationName.trim() || null,
      location_lat: locationLat,
      location_lng: locationLng,
      cover_url: coverUrl.trim() || null,
      dress_code: dressCode.trim() || null,
      budget_per_person: budgetAmount.trim() ? parseInt(budgetAmount.replace(/[^\d]/g, '')) || null : null,
      budget_currency: budgetAmount.trim() ? budgetCurrency : null,
      is_birthday: isBirthday,
      organizer_notes: organizerNotes.trim() || null,
      meeting_point: meetingPoint.trim() || null,
      meeting_point_lat: meetingPointLat,
      meeting_point_lng: meetingPointLng,
      meeting_at: meetingAt ? new Date(meetingAt).toISOString() : null,
      plus_ones_limit: plusOnesLimit,
    };

    const res = await updateEvent(id, patch);
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
    } else {
      haptic.success();
      goBack(nav, '/calendar');
    }
  };

  if (loading) {
    return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100dvh'}}><div className="spinner" /></div>;
  }

  if (!isCreator) {
    return (
      <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
        <div className="page-header" style={{display:'flex',alignItems:'center',gap:12,paddingBottom:8}}>
          <button onClick={() => goBack(nav, '/calendar')} aria-label="Назад" style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:6,marginLeft:-6,lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center'}}><BackIcon /></button>
          <h1 style={{fontSize: 'var(--fs-title)',textTransform:'none',letterSpacing:0}}>Редактирование события</h1>
        </div>
        <div style={{padding:32,textAlign:'center',color:'var(--muted)'}}>
          Только организатор может редактировать
        </div>
      </div>
    );
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div className="page-header" style={{display:'flex',alignItems:'center',gap:12,paddingBottom:8}}>
        <button onClick={() => goBack(nav, '/calendar')} aria-label="Назад" style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:6,marginLeft:-6,lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center'}}><BackIcon /></button>
        <h1 style={{fontSize: 'var(--fs-title)',textTransform:'none',letterSpacing:0}}>Редактирование события</h1>
      </div>

      <div className="page-scroll ce-form create-event-form" style={{padding:'8px 16px 32px'}}>
        <Label>Тип</Label>
        <div style={{position:'relative', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16}}>
          <div style={{position:'absolute', top:0, bottom:0, left:0, width:'calc(50% - 4px)', borderRadius:10, background:'var(--surface-light)', border:'2px solid var(--primary)', transform: type === 'trip' ? 'translateX(calc(100% + 8px))' : 'translateX(0)', transition:'transform .26s cubic-bezier(0.16,1,0.3,1)', pointerEvents:'none'}} />
          <button type="button" onClick={() => { haptic.tap(); setType('party'); }} style={{position:'relative',zIndex:1,padding:'14px',borderRadius:10,border:'2px solid transparent',background:'transparent',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:6,color:'var(--text)',fontSize:'var(--fs-label)',fontWeight:type === 'party' ? 600 : 500}}>
            <IconPartyPopper size={24} strokeWidth={1.6} /><span>Туса</span>
          </button>
          <button type="button" onClick={() => { haptic.tap(); setType('trip'); }} style={{position:'relative',zIndex:1,padding:'14px',borderRadius:10,border:'2px solid transparent',background:'transparent',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:6,color:'var(--text)',fontSize:'var(--fs-label)',fontWeight:type === 'trip' ? 600 : 500}}>
            <IconPlane size={24} strokeWidth={1.6} /><span>Поездка</span>
          </button>
        </div>

        <Label>Название</Label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={100}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16}}
        />

        <Label>Дата начала</Label>
        <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:16}}>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{width:'100%',minWidth:0,boxSizing:'border-box',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',fontFamily:'inherit'}}
          />
          {type === 'party' && (
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              style={{width:'100%',minWidth:0,boxSizing:'border-box',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',fontFamily:'inherit'}}
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
              min={startDate || undefined}
              style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16,fontFamily:'inherit'}}
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
            style={{ width:'100%', minHeight:156, padding:'24px 16px', marginBottom:16, borderRadius:18, border:'1px solid var(--border)', background:'var(--surface-light)', color:'var(--text)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, boxSizing:'border-box' }}
          >
            {uploadingCover ? <SpinnerIcon /> : <UploadPhotoIcon />}
            <span style={{ fontSize:'var(--fs-snap14)', fontWeight:700 }}>{uploadingCover ? 'Загружаем обложку…' : 'Добавить обложку'}</span>
            <span style={{ fontSize:'var(--fs-caption)', color:'var(--muted)', fontWeight:500 }}>Необязательно · JPG, PNG или HEIC</span>
          </button>
        )}

        {type === 'party' && (
          <>
            <Label optional>Дресс-код / тематика</Label>
            <input
              value={dressCode}
              onChange={e => setDressCode(e.target.value)}
              placeholder="Чёрный галстук, 90-е..."
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
                Брони подарков скрыты от вас
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
            <Label optional>Точка сбора</Label>
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
          placeholder="Парковка с задней стороны..."
          maxLength={500}
          rows={2}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:24,resize:'vertical',fontFamily:'inherit'}}
        />

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
        >{submitting ? <><SpinnerIcon /> Сохраняем...</> : 'Сохранить изменения'}</button>
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
