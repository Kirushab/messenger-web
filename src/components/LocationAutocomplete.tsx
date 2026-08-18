import { useEffect, useRef, useState } from 'react';

const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN as string | undefined;

interface Suggestion {
  place_name: string;
  center: [number, number];  // [lng, lat]
  text: string;
  place_type?: string[];
}

interface Props {
  value: string;
  onChange: (text: string, lat?: number, lng?: number) => void;
  placeholder?: string;
}

export default function LocationAutocomplete({ value, onChange, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);
  const ignoreNextChangeRef = useRef(false);

  // Дебаунсный поиск
  useEffect(() => {
    if (ignoreNextChangeRef.current) {
      ignoreNextChangeRef.current = false;
      return;
    }
    if (!MAPBOX_TOKEN) return;
    if (!value || value.length < 2) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${MAPBOX_TOKEN}&language=ru&limit=5&types=place,locality,neighborhood,address,poi`
        );
        const data = await res.json();
        setSuggestions((data?.features || []) as Suggestion[]);
      } catch (e) {
        console.error('Geocoding:', e);
      } finally {
        setLoading(false);
      }
    }, 280);
  }, [value]);

  // Закрытие при клике вне
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const pick = (s: Suggestion) => {
    ignoreNextChangeRef.current = true;
    onChange(s.place_name, s.center[1], s.center[0]);
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} style={{position:'relative', marginBottom:16}}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || 'Начните вводить адрес'}
        style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)'}}
      />

      {open && (suggestions.length > 0 || loading) && (
        <div style={{
          position:'absolute',
          top:'100%', left:0, right:0,
          marginTop:4,
          background:'var(--surface)',
          border:'1px solid var(--border)',
          borderRadius:10,
          boxShadow:'0 4px 14px rgba(0,0,0,0.18)',
          zIndex:20,
          maxHeight:240,
          overflowY:'auto',
        }}>
          {loading && (
            <div style={{padding:'10px 12px', fontSize: 'var(--fs-caption)', color:'var(--muted)'}}>Поиск...</div>
          )}
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => pick(s)}
              style={{
                width:'100%', textAlign:'left',
                padding:'10px 12px',
                background:'none', border:'none',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                cursor:'pointer',
                color:'var(--text)',
                fontSize: 'var(--fs-label)',
                lineHeight:1.3,
                display:'flex',
                alignItems:'flex-start',
                gap:8,
              }}
            >
              <span style={{flexShrink:0, opacity:0.7, marginTop:1}}>📍</span>
              <span>
                <div style={{fontWeight:500, marginBottom:1}}>{s.text}</div>
                <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.place_name}</div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
