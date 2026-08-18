interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * iOS-style toggle с плавным slide knob.
 */
export default function IosToggle({ checked, onChange, disabled, ariaLabel }: Props) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`ios-toggle${checked ? ' on' : ''}`}
      style={{
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
        padding: 0,
      }}
    >
      <div className="ios-toggle-knob" />
    </button>
  );
}
