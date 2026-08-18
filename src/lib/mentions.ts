export interface MentionRef {
  userId: string;
  name: string;
}

export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; userId: string; name: string; raw: string };

const MENTION_TOKEN_RE = /@\[([^\]]*)\]\(mention:([0-9a-fA-F-]{36})\)/g;

function safeDecodeName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function makeMentionToken(ref: MentionRef): string {
  return `@[${encodeURIComponent(ref.name)}](mention:${ref.userId})`;
}

/** Converts selected visible @names into stable tokens containing user ids. */
export function encodeMentionRefs(text: string, refs: MentionRef[]): string {
  let result = text;

  for (const ref of refs) {
    if (!ref.userId || !ref.name) continue;
    const pattern = new RegExp(`@${escapeRegExp(ref.name)}(?=$|[\\s.,!?;:()\\[\\]{}])`);
    const match = pattern.exec(result);
    if (!match) continue;
    const token = makeMentionToken(ref);
    result = result.slice(0, match.index) + token + result.slice(match.index + match[0].length);
  }

  return result;
}

export function parseMentionContent(content: string): MentionSegment[] {
  if (!content) return [{ type: 'text', value: content || '' }];

  const segments: MentionSegment[] = [];
  let cursor = 0;
  MENTION_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = MENTION_TOKEN_RE.exec(content)) !== null) {
    if (match.index > cursor) {
      segments.push({ type: 'text', value: content.slice(cursor, match.index) });
    }
    segments.push({
      type: 'mention',
      userId: match[2],
      name: safeDecodeName(match[1]),
      raw: match[0],
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < content.length) {
    segments.push({ type: 'text', value: content.slice(cursor) });
  }

  return segments.length ? segments : [{ type: 'text', value: content }];
}

export function stripMentionTokens(content: string): string {
  if (!content) return content || '';
  MENTION_TOKEN_RE.lastIndex = 0;
  return content.replace(MENTION_TOKEN_RE, (_raw, encodedName) => `@${safeDecodeName(encodedName)}`);
}

export function getMentionRefs(content: string): MentionRef[] {
  return parseMentionContent(content)
    .filter((segment): segment is Extract<MentionSegment, { type: 'mention' }> => segment.type === 'mention')
    .map(segment => ({ userId: segment.userId, name: segment.name }));
}

export function isUserMentioned(content: string, userId: string): boolean {
  if (!content || !userId) return false;
  return getMentionRefs(content).some(ref => ref.userId === userId);
}
