import { useRef, useEffect, useState } from 'react';

interface Tab {
  key: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

/**
 * Вкладки с анимированным скользящим подчёркиванием.
 */
export default function AnimatedTabs({ tabs, active, onChange }: Props) {
  const tabsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const [underline, setUnderline] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const el = tabsRef.current[active];
    if (el) {
      setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [active, tabs.length]);

  return (
    <div className="animated-tabs" style={{
      borderBottom: '1px solid var(--border)',
      position: 'relative',
    }}>
      {tabs.map(t => (
        <button
          key={t.key}
          ref={el => { tabsRef.current[t.key] = el; }}
          onClick={() => onChange(t.key)}
          style={{
            flex: 1,
            padding: '12px 6px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'var(--fs-snap14)',
            fontWeight: 600,
            color: active === t.key ? 'var(--accent)' : 'var(--muted)',
            transition: 'color 0.25s ease',
          }}
        >{t.label}</button>
      ))}
      <div className="animated-tabs-underline" style={{
        left: underline.left,
        width: underline.width,
      }} />
    </div>
  );
}
