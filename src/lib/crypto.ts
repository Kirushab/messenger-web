// E2E encryption using Web Crypto API: PBKDF2 + AES-256-GCM

const ITER_V1 = 100000;
const ITER_V2 = 210000;

async function deriveKey(password: string, salt: Uint8Array, iterations: number = ITER_V2): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
function b64encode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64decode(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

// Salt is derived from conversation ID (stable per chat)
function getSalt(convId: string): Uint8Array {
  const bytes = new TextEncoder().encode('sigmas_' + convId);
  const salt = new Uint8Array(16);
  for (let i = 0; i < 16; i++) salt[i] = bytes[i % bytes.length];
  return salt;
}

export async function encryptMessage(text: string, password: string, convId: string): Promise<{ ciphertext: string; iv: string }> {
  const salt = getSalt(convId);
  const key = await deriveKey(password, salt, ITER_V2);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(text);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
  return { ciphertext: b64encode(cipher), iv: '2.' + b64encode(toArrayBuffer(iv)) };
}

export async function decryptMessage(ciphertext: string, iv: string, password: string, convId: string): Promise<string> {
  try {
    const salt = getSalt(convId);
    let iterations = ITER_V1, ivStr = iv;
    if (iv.startsWith('2.')) { iterations = ITER_V2; ivStr = iv.slice(2); }
    const key = await deriveKey(password, salt, iterations);
    const ivBytes = b64decode(ivStr);
    const cipher = b64decode(ciphertext);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(ivBytes) }, key, toArrayBuffer(cipher));
    return new TextDecoder().decode(plain);
  } catch (e) {
    // Rethrow so caller can mark as __DECRYPT_ERROR__ and prompt for password
    throw e;
  }
}

// Password storage: in-memory by default; sessionStorage only if "remember"
const PW_KEY = 'sigmas_chat_pw_';
const memPw = new Map<string, string>();

export function getChatPassword(convId: string): string | null {
  if (memPw.has(convId)) return memPw.get(convId)!;
  const s = sessionStorage.getItem(PW_KEY + convId);
  if (s != null) { memPw.set(convId, s); return s; }
  return null;
}

export function setChatPassword(convId: string, password: string, remember: boolean = false) {
  memPw.set(convId, password);
  if (remember) sessionStorage.setItem(PW_KEY + convId, password);
  else sessionStorage.removeItem(PW_KEY + convId);
}

export function clearChatPassword(convId: string) {
  memPw.delete(convId);
  sessionStorage.removeItem(PW_KEY + convId);
}

export function isChatRemembered(convId: string): boolean {
  return sessionStorage.getItem(PW_KEY + convId) != null;
}

// ============ File encryption ============

async function deriveFileKey(password: string, convId: string, iterations: number = ITER_V2): Promise<CryptoKey> {
  const salt = getSalt(convId);
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

export async function encryptFile(file: File, password: string, convId: string): Promise<{ file: File; iv: string; origName: string; origMime: string }> {
  const buffer = await file.arrayBuffer();
  const key = await deriveFileKey(password, convId, ITER_V2);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buffer);
  const encFile = new File([encrypted], 'enc_' + Date.now() + '.bin', { type: 'application/octet-stream' });
  // Encrypt filename and mime type
  const nameEnc = await encryptMessage(file.name, password, convId);
  const mimeEnc = await encryptMessage(file.type || 'application/octet-stream', password, convId);
  return {
    file: encFile,
    iv: '2.' + b64encode(toArrayBuffer(iv)),
    origName: JSON.stringify(nameEnc),
    origMime: JSON.stringify(mimeEnc),
  };
}

// Track created blob URLs per conversation for cleanup
const blobUrlCache = new Map<string, string[]>();

export function revokeDecryptedUrls(convId: string) {
  const urls = blobUrlCache.get(convId) || [];
  for (const u of urls) { try { URL.revokeObjectURL(u); } catch {} }
  blobUrlCache.delete(convId);
}

export async function decryptFileFromUrl(url: string, iv: string, password: string, convId: string, origMime: string): Promise<string> {
  try {
    const response = await fetch(url);
    const encBuffer = await response.arrayBuffer();
    let iterations = ITER_V1, ivStr = iv;
    if (iv.startsWith('2.')) { iterations = ITER_V2; ivStr = iv.slice(2); }
    const key = await deriveFileKey(password, convId, iterations);
    const ivBytes = b64decode(ivStr);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(ivBytes) }, key, encBuffer);
    // Decrypt real mime type
    let realMime = 'application/octet-stream';
    try {
      const mimeObj = JSON.parse(origMime);
      if (mimeObj?.ciphertext && mimeObj?.iv) {
        realMime = await decryptMessage(mimeObj.ciphertext, mimeObj.iv, password, convId);
      }
    } catch {}
    const blob = new Blob([decrypted], { type: realMime });
    const blobUrl = URL.createObjectURL(blob);
    const list = blobUrlCache.get(convId) || [];
    list.push(blobUrl);
    blobUrlCache.set(convId, list);
    return blobUrl;
  } catch (e) {
    console.error('decryptFile error:', e);
    // Throw so caller can mark as error and re-prompt for password
    throw e;
  }
}

export async function decryptFilename(origName: string, password: string, convId: string): Promise<string> {
  let obj;
  try { obj = JSON.parse(origName); } catch { return 'encrypted_file'; }
  if (!obj?.ciphertext || !obj?.iv) return 'encrypted_file';
  // If this throws, let it propagate — means wrong password
  return await decryptMessage(obj.ciphertext, obj.iv, password, convId);
}
