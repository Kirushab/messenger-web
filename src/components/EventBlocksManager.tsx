import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import FormSheet from '@/components/FormSheet';
import { haptic } from '@/lib/haptics';
import { IconCar } from '@/components/icons/EventIcons';


// Мини-иконки блоков (SVG вместо эмодзи; хром без эмодзи)
const I = (d: string, extra?: string) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={d} />{extra ? <path d={extra} /> : null}</svg>
);
const BLOCK_ICONS: Record<string, JSX.Element> = {
  gallery: I('M3 5h18v14H3z M3 15l5-5 4 4 3-3 6 6', 'M8.5 9.5h.01'),
  moments: I('M23 19V7a2 2 0 0 0-2-2h-3.2L16 3H8L6.2 5H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'),
  checklist: I('M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'),
  schedule: I('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'),
  wishlist: I('M20 12v10H4V12 M2 7h20v5H2z M12 22V7', 'M12 7c1.5-3.5 6-3.5 6-1 0 2-3 2-6 1zm0 0C10.5 3.5 6 3.5 6 6c0 2 3 2 6 1z'),
  notes: I('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6 M9 13h6 M9 17h4'),
  links: I('M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'),
  contacts: I('M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.4 2.1L8 9.9a16 16 0 0 0 6 6l1.4-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.8 2z'),
  bringing: I('M21 8l-9-5-9 5v8l9 5 9-5V8z', 'M3.3 8.3 12 13l8.7-4.7 M12 22V13'),
  activities: I('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'),
  poll: I('M18 20V10 M12 20V4 M6 20v-6'),
  splitbill: I('M2 7h20v10H2z', 'M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M5 10h.01 M19 14h.01'),
  housing: I('M3 21h18 M5 21V7l7-4 7 4v14', 'M9 21v-6h6v6'),
  cars: <IconCar size={17} strokeWidth={1.9} /> ,
  weather_hourly: I('M12 3v2 M5.6 5.6l1.4 1.4 M3 12h2 M12 9a4 4 0 0 1 3.5 2.1', 'M7 17a5 5 0 0 1 9.6-2H18a3 3 0 0 1 0 6H8a3.5 3.5 0 0 1-1-6.9z'),
  checkin: I('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z', 'M9.5 10l2 2 3.5-3.5'),
  roadmap: I('M9 20l-6-3V4l6 3 6-3 6 3v13l-6-3-6 3z', 'M9 7v13 M15 4v13'),
  movies: I('M2 4h20v16H2z', 'M7 4v16 M17 4v16 M2 9h5 M2 15h5 M17 9h5 M17 15h5'),
  personal_program: I('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'),
  survey: I('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'M9 2h6v4H9z M9 12h6 M9 16h4'),
  emergency: I('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v4 M12 16h.01'),
  route_checkin: I('M4 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M20 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 16h8a3 3 0 0 0 0-6h-1'),
  lost_found: I('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'),
  sim_info: I('M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M9 12h6v6H9z M12 12v6 M9 15h6'),
  preferences: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v8"/><path d="M8.5 3v8"/><path d="M11 3v8"/><path d="M8.5 11v10"/><path d="M16 4v17"/><path d="M16 4c2.2 0 3.5 1.5 3.5 3.6S18.2 11.2 16 11.2"/><path d="M14.5 21h3"/></svg>,
  challenges: I('M8 21h8 M12 17v4', 'M17 4H7v6a5 5 0 0 0 10 0V4zM7 6H4a2 2 0 0 0 2 5h1M17 6h3a2 2 0 0 1-2 5h-1'),
  transport: I('M4 5h16v11H4z', 'M4 11h16 M8 21l1-3 M16 21l-1-3 M7.5 15h.01 M16.5 15h.01'),
  flight: I('M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z'),
  places: I('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'),
  shopping: I('M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18 M16 10a4 4 0 0 1-8 0'),
  packing: I('M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z', 'M10 7V5h4v2'),
  diary: I('M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'),
  alarm: I('M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M12 9v4l2.5 1.5 M5 3 2 6 M19 3l3 3'),
};

export const ALL_BLOCKS: { id: string; title: string; desc: string }[] = [
  { id: 'gallery',        title: 'Медиа',           desc: 'Общие фото и видео' },
  { id: 'moments',        title: 'Моменты события', desc: 'Истории и посты с отметкой' },
  { id: 'checklist',      title: 'Чек-лист',        desc: 'Что взять/сделать' },
  { id: 'schedule',       title: 'Расписание',      desc: 'План по часам/дням' },
  { id: 'wishlist',       title: 'Список желаний',  desc: 'Подарки (для ДР)' },
  { id: 'notes',          title: 'Заметки',         desc: 'Важная информация' },
  { id: 'links',          title: 'Полезные ссылки', desc: 'Документы, плейлисты' },
  { id: 'contacts',       title: 'Контакты',        desc: 'Связь с участниками' },
  { id: 'bringing',       title: 'Кто что приносит', desc: 'Распределение еды/вещей' },
  { id: 'activities',     title: 'Активности',      desc: 'Голосование за идеи' },
  { id: 'poll',           title: 'Опросы',          desc: 'Несколько вариантов' },
  { id: 'splitbill',      title: 'Скидываемся',     desc: 'Кто сколько потратил' },
  { id: 'housing',        title: 'Жильё',           desc: 'Отель, аренда' },
  { id: 'cars',           title: 'Машины',          desc: 'Кто за рулём' },
  { id: 'weather_hourly', title: 'Погода почасовая', desc: 'Прогноз на 7 дней' },
  { id: 'checkin',        title: 'Чек-ин «я тут»',  desc: 'Отметка прибытия' },
  { id: 'roadmap',        title: 'Подготовка',      desc: 'Этапы с прогрессом' },
  { id: 'movies',         title: 'Фильмы',          desc: 'Голосование за фильмы' },
  { id: 'personal_program', title: 'Персональная программа', desc: 'Кому что делать' },
  { id: 'survey',         title: 'Анкета',          desc: 'Аллергии, размер...' },
  { id: 'emergency',      title: 'Экстренные',      desc: 'SOS телефоны' },
  { id: 'route_checkin',  title: 'Чек-ин маршрута', desc: 'Точки по пути' },
  { id: 'lost_found',     title: 'Бюро находок',    desc: 'Потеряно / найдено' },
  { id: 'sim_info',       title: 'SIM / eSIM',      desc: 'Связь в поездке' },
  { id: 'preferences',    title: 'Что пьёт / ест',  desc: 'Предпочтения' },
  { id: 'challenges',     title: 'Челленджи',       desc: 'Задания на событии' },
  { id: 'transport',      title: 'Транспорт',       desc: 'Билеты, рейсы' },
  { id: 'flight',         title: 'Рейс',            desc: 'Номер рейса + место, борт на карте' },
  { id: 'places',         title: 'Места',           desc: 'Что посетить' },
  { id: 'shopping',       title: 'Покупки',         desc: 'Общий список' },
  { id: 'packing',        title: 'Багаж',           desc: 'Личный список вещей' },
  { id: 'diary',          title: 'Дневник',         desc: 'Записи и впечатления' },
  { id: 'alarm',          title: 'Будильник',       desc: 'Общий подъём для всех' },
];

interface Props {
  eventId: string;
  initialBlocks: string[] | null;
  initialExpanded?: string[] | null;
  onClose: () => void;
  onSaved: (blocks: string[], expanded: string[]) => void;
}

export default function EventBlocksManager({ eventId, initialBlocks, initialExpanded, onClose, onSaved }: Props) {
  // Состояние: упорядоченный массив включённых блоков
  const [enabled, setEnabled] = useState<string[]>(initialBlocks || []);
  const [expanded, setExpanded] = useState<string[]>(initialExpanded ?? ['schedule']);
  const toggleExpanded = (id: string) => setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    haptic.tap();
    setEnabled(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const moveUp = (id: string) => {
    setEnabled(prev => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (id: string) => {
    setEnabled(prev => {
      const idx = prev.indexOf(id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const expandedClean = expanded.filter(e => enabled.includes(e));
    const { error } = await supabase.from('events')
      .update({ enabled_blocks: enabled, expanded_blocks: expandedClean })
      .eq('id', eventId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Блоки обновлены');
    onSaved(enabled, expandedClean);
    onClose();
  };

  // Сортируем: сначала включённые (в выбранном порядке), затем выключенные (в дефолтном)
  const enabledSet = new Set(enabled);
  const orderedList = [
    ...enabled.map(id => ALL_BLOCKS.find(b => b.id === id)!).filter(Boolean),
    ...ALL_BLOCKS.filter(b => !enabledSet.has(b.id)),
  ];

  return (
    <FormSheet onClose={onClose} title="Блоки события" maxWidth={480} flushBottom>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: -4, marginBottom: 12 }}>
        Включите нужные и расставьте порядок
      </div>
      <div style={{ paddingBottom: 8 }}>
          {orderedList.map((b, idx) => {
            const isOn = enabledSet.has(b.id);
            const enabledIdx = enabled.indexOf(b.id);
            const canUp = isOn && enabledIdx > 0;
            const canDown = isOn && enabledIdx >= 0 && enabledIdx < enabled.length - 1;
            return (
              <div key={b.id} className="ev-block-row-in" style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', marginBottom: 6,
                borderRadius: 10,
                background: isOn ? 'var(--surface-light)' : 'transparent',
                border: isOn ? '1px solid var(--border)' : '1px dashed var(--border)',
                opacity: isOn ? 1 : 0.6,
                animationDelay: Math.min(idx, 14) * 26 + 'ms',
              }}>
                {/* Order number / drag handle для включённых */}
                {isOn && (
                  <div style={{
                    width: 24, height: 24, borderRadius: 12,
                    background: 'var(--primary)', color: 'var(--bg)',
                    fontSize: 'var(--fs-caption)', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>{enabledIdx + 1}</div>
                )}

                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{BLOCK_ICONS[b.id] ?? I('M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z')}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 600, color: 'var(--text)' }}>{b.title}</div>
                  <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>{b.desc}</div>
                </div>

                {/* Развёрнут по умолчанию (только для включённых) */}
                {isOn && (() => { const ex = expanded.includes(b.id); return (
                  <button onClick={() => toggleExpanded(b.id)} aria-label={ex ? 'Свернуть по умолчанию' : 'Развернуть по умолчанию'} title="Развёрнут при открытии события" style={{
                    width: 30, height: 30, borderRadius: 10, flexShrink: 0,
                    background: ex ? 'var(--text)' : 'transparent',
                    border: ex ? 'none' : '1px solid var(--border)',
                    color: ex ? 'var(--bg)' : 'var(--muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
                  </button>
                ); })()}

                {/* up/down (только для включённых) */}
                {isOn && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => moveUp(b.id)} disabled={!canUp} aria-label="Вверх" style={{
                      width: 24, height: 20, borderRadius: 6,
                      background: 'transparent', border: '1px solid var(--border)',
                      color: canUp ? 'var(--text)' : 'var(--muted)',
                      cursor: canUp ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 15 12 9 6 15"/>
                      </svg>
                    </button>
                    <button onClick={() => moveDown(b.id)} disabled={!canDown} aria-label="Вниз" style={{
                      width: 24, height: 20, borderRadius: 6,
                      background: 'transparent', border: '1px solid var(--border)',
                      color: canDown ? 'var(--text)' : 'var(--muted)',
                      cursor: canDown ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                  </div>
                )}

                {/* Toggle */}
                <button onClick={() => toggle(b.id)} aria-label="Toggle" style={{
                  width: 42, height: 26, borderRadius: 13,
                  background: isOn ? 'var(--primary)' : 'var(--border)',
                  border: 'none', cursor: 'pointer',
                  position: 'relative', transition: 'background 200ms ease',
                  flexShrink: 0, marginLeft: 4,
                }}>
                  <div style={{
                    position: 'absolute', top: 2, left: isOn ? 18 : 2,
                    width: 22, height: 22, borderRadius: 11,
                    background: '#fff',
                    transition: 'left 200ms ease',
                  }} />
                </button>
                {/* idx unused but TS happy */}
                {idx === -1 && null}
              </div>
            );
          })}
        </div>

      <div style={{
        position: 'sticky', bottom: 12, zIndex: 4,
        background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        padding: '10px 0 4px', marginTop: 8,
      }}>
        <button onClick={handleSave} disabled={saving} className="btn" style={{ width: '100%', minHeight: 52, borderRadius: 16 }}>
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </div>
    </FormSheet>
  );
}
