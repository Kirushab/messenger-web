// Displays a user's custom admin-assigned status inline.
// Returns null if no custom status is set.

type UserWithStatus = {
  custom_status_text?: string | null;
  custom_status_color?: string | null;
  custom_status_emoji?: string | null;
};

export default function CustomStatus({
  user,
  size = 'sm',
  inline = true,
}: {
  user: UserWithStatus | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
}) {
  if (!user?.custom_status_text) return null;
  const fontSize = size === 'sm' ? 11 : size === 'md' ? 13 : 15;
  const color = user.custom_status_color || 'var(--muted)';
  return (
    <span style={{
      color,
      fontSize,
      fontWeight: 600,
      display: inline ? 'inline-flex' : 'flex',
      alignItems: 'center',
      gap: 4,
      letterSpacing: 0.3,
    }}>
      {user.custom_status_emoji && <span style={{fontSize: fontSize + 1}}>{user.custom_status_emoji}</span>}
      <span>{user.custom_status_text}</span>
    </span>
  );
}
