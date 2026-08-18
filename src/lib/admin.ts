export const OWNER_EMAILS = ['lirikbog@gmail.com', 'lirikb2002@gmail.com'] as const;

export function isOwnerEmail(email?: string | null): boolean {
  return !!email && OWNER_EMAILS.includes(email.toLowerCase() as (typeof OWNER_EMAILS)[number]);
}
