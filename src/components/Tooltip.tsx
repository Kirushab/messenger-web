import { useState, type ReactNode } from 'react';

interface Props {
  text: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
}

/**
 * Tooltip с fade-in. Появляется при hover/long-press.
 */
export default function Tooltip({ text, children, side = 'top' }: Props) {
  const [show, setShow] = useState(false);
  return (
    <span
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onTouchStart={() => {
        setShow(true);
        setTimeout(() => setShow(false), 2000);
      }}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      {children}
      {show && (
        <span className="tooltip-fade" style={{
          position: 'absolute',
          [side === 'top' ? 'bottom' : 'top']: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--text)',
          color: 'var(--bg)',
          fontSize: 'var(--fs-micro)',
          fontWeight: 500,
          padding: '4px 8px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>{text}</span>
      )}
    </span>
  );
}
