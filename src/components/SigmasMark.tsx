import type { CSSProperties } from 'react';

interface Props {
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
  variant?: 'outline' | 'solid' | 'tab';
}

/**
 * Monochrome versions of the current Sigmas mark.
 * - outline / solid use CSS masks and inherit currentColor.
 * - tab keeps the inner fill white and lets the bottom tab bar control the contour color.
 */
export default function SigmasMark({ size = 24, className, style, title, variant = 'outline' }: Props) {
  if (variant === 'tab') {
    return (
      <span
        className={className}
        role={title ? 'img' : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
        style={{
          width: size,
          height: size,
          display: 'inline-block',
          flex: '0 0 auto',
          position: 'relative',
          ...style,
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            background: '#fff',
            WebkitMask: 'url(/logo-mark.svg) center / contain no-repeat',
            mask: 'url(/logo-mark.svg) center / contain no-repeat',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            background: 'currentColor',
            WebkitMask: 'url(/logo-mark-outline.svg) center / contain no-repeat',
            mask: 'url(/logo-mark-outline.svg) center / contain no-repeat',
          }}
        />
      </span>
    );
  }

  const maskUrl = variant === 'solid' ? '/logo-mark.svg' : '/logo-mark-outline.svg';
  return (
    <span
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        flex: '0 0 auto',
        background: 'currentColor',
        WebkitMask: `url(${maskUrl}) center / contain no-repeat`,
        mask: `url(${maskUrl}) center / contain no-repeat`,
        ...style,
      }}
    />
  );
}
