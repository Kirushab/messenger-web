import { useEffect, useRef, useState } from 'react';

interface Props {
  read: boolean;
  size?: number; // default 14
  readColor?: string; // default — теплый голубой, как в WhatsApp
}

/**
 * Галочки прочтения сообщения. Одна когда отправлено, две — когда прочитано.
 * При первом mount первая галочка рисуется stroke-анимацией.
 * При переходе single→double вторая галочка появляется с stroke-анимацией.
 */
export default function ReadChecks({ read, size = 14, readColor = '#4FC3F7' }: Props) {
  const [animateFirst, setAnimateFirst] = useState(true);
  const [animateSecond, setAnimateSecond] = useState(false);
  const prevReadRef = useRef(read);

  // Первая галочка анимируется только при mount
  useEffect(() => {
    const t = setTimeout(() => setAnimateFirst(false), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Если перешли из false в true — анимируем вторую
    if (!prevReadRef.current && read) {
      setAnimateSecond(true);
      const t = setTimeout(() => setAnimateSecond(false), 320);
      prevReadRef.current = read;
      return () => clearTimeout(t);
    }
    prevReadRef.current = read;
  }, [read]);

  const color = read ? readColor : 'currentColor';

  return (
    <span
      className="read-check-svg"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: 4,
        color,
        verticalAlign: 'baseline',
        height: size,
      }}
    >
      {/* Первая галочка — всегда видна */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 14 14"
        fill="none"
        className={animateFirst ? 'read-check-appear' : ''}
        style={{ marginRight: read ? -size * 0.55 : 0 }}
      >
        <path
          d="M2 7.5 L5 10.5 L12 3"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {/* Вторая галочка — только если read */}
      {read && (
        <svg
          width={size}
          height={size}
          viewBox="0 0 14 14"
          fill="none"
          className={animateSecond ? 'read-check-appear' : ''}
        >
          <path
            d="M2 7.5 L5 10.5 L12 3"
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}
