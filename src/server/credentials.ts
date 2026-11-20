import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';

export type CredentialStatus = 'not_configured' | 'configured' | 'invalid' | 'temporarily_unavailable';

export type ValidationResult = {
  ok: boolean;
  category:
    | 'VALID'
    | 'INVALID_CREDENTIAL'
    | 'QUOTA_EXCEEDED'
    | 'MODEL_UNAVAILABLE'
    | 'NETWORK_ERROR'
    | 'UNKNOWN';
  message: string;
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let encryptionKey: Buffer;
const ephemeral = !process.env.PONDER_ENCRYPTION_KEY;
if (process.env.PONDER_ENCRYPTION_KEY) {
  const raw = process.env.PONDER_ENCRYPTION_KEY.trim();
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    encryptionKey = Buffer.from(raw, 'hex');
  } else {
    encryptionKey = crypto.createHash('sha256').update(raw).digest();
  }
} else {
  encryptionKey = crypto.randomBytes(32);
  console.warn(
    '[ponder] PONDER_ENCRYPTION_KEY is not set. Using an ephemeral key; stored credentials will not survive server restarts.'
  );
}

// We encrypt with AES-256-GCM and pack iv + auth tag + ciphertext into one
// base64 blob so callers can store a single opaque string.
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

// We validate by listing models rather than generating text, so the check
// doesn't depend on a specific model being available and stays cheap.
export async function validateGeminiCredential(apiKey: string): Promise<ValidationResult> {
  const trimmed = apiKey.trim();
  if (trimmed.length < 20) {
    return { ok: false, category: 'INVALID_CREDENTIAL', message: 'Credential format looks incomplete.' };
  }

  const ai = new GoogleGenAI({ apiKey: trimmed });
  try {
    // Minimal authenticated request that does not depend on a specific model.
    await ai.models.list();
    return { ok: true, category: 'VALID', message: 'Gemini credential verified.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    if (lower.includes('api_key') || lower.includes('unauthenticated') || lower.includes('401') || lower.includes('403') || lower.includes('permission')) {
      return { ok: false, category: 'INVALID_CREDENTIAL', message: 'Gemini rejected this credential. Check that it is correct and active.' };
    }
    if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
      return { ok: false, category: 'QUOTA_EXCEEDED', message: 'This credential is valid, but its quota or billing limit has been reached.' };
    }
    if (lower.includes('unavailable') || lower.includes('503') || lower.includes('overloaded')) {
      return { ok: false, category: 'MODEL_UNAVAILABLE', message: 'Gemini is temporarily unavailable. Try again shortly.' };
    }
    if (lower.includes('fetch') || lower.includes('network') || lower.includes('econn') || lower.includes('timeout')) {
      return { ok: false, category: 'NETWORK_ERROR', message: 'Could not reach Gemini. Check your network connection.' };
    }
    return { ok: false, category: 'UNKNOWN', message: 'Could not verify this credential right now. Try again.' };
  }
}

export async function validateSerperCredential(apiKey: string): Promise<ValidationResult> {
  const trimmed = apiKey.trim();
  if (trimmed.length < 10) {
    return { ok: false, category: 'INVALID_CREDENTIAL', message: 'Credential format looks incomplete.' };
  }
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': trimmed, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'test', num: 1 }),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, category: 'INVALID_CREDENTIAL', message: 'Serper rejected this credential.' };
    }
    if (res.status === 429) {
      return { ok: false, category: 'QUOTA_EXCEEDED', message: 'Serper quota reached for this key.' };
    }
    if (!res.ok) {
      return { ok: false, category: 'UNKNOWN', message: 'Could not verify Serper credential.' };
    }
    return { ok: true, category: 'VALID', message: 'Serper credential verified.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) {
      return { ok: false, category: 'NETWORK_ERROR', message: 'Could not reach Serper.' };
    }
    return { ok: false, category: 'UNKNOWN', message: 'Could not verify Serper credential.' };
  }
}

// --- Storage ---

// Anonymous, session-scoped in-memory store.
const SESSION_STORE_PATH = process.env.PONDER_SESSION_STORE || path.resolve(process.cwd(), '.ponder-sessions.json');

function loadSessionStore(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    if (fs.existsSync(SESSION_STORE_PATH)) {
      const raw = fs.readFileSync(SESSION_STORE_PATH, 'utf8');
      const obj = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') map.set(k, v);
      }
    }
  } catch (err) {
    console.warn('[ponder] could not load session store:', err instanceof Error ? err.message : String(err));
  }
  return map;
}

function persistSessionStore(map: Map<string, string>): void {
  try {
    const obj: Record<string, string> = {};
    for (const [k, v] of map.entries()) obj[k] = v;
    fs.writeFileSync(SESSION_STORE_PATH, JSON.stringify(obj), 'utf8');
  } catch (err) {
    console.warn('[ponder] could not persist session store:', err instanceof Error ? err.message : String(err));
  }
}

const sessionStore = loadSessionStore();
const serperSessionStore = new Map<string, string>();
function loadSerperSessionStore(): Map<string, string> { return new Map(); }
const _serperLoaded = loadSerperSessionStore();

export function storeSessionCredential(sessionId: string, apiKey: string): void {
  sessionStore.set(sessionId, encryptSecret(apiKey));
  persistSessionStore(sessionStore);
}

export function readSessionCredential(sessionId: string): string | null {
  const enc = sessionStore.get(sessionId);
  if (!enc) return null;
  try {
    return decryptSecret(enc);
  } catch {
    sessionStore.delete(sessionId);
    return null;
  }
}

export function removeSessionCredential(sessionId: string): void {
  sessionStore.delete(sessionId);
  persistSessionStore(sessionStore);
}

export function storeSessionSerperCredential(sessionId: string, apiKey: string): void {
  serperSessionStore.set(sessionId, encryptSecret(apiKey));
}

export function readSessionSerperCredential(sessionId: string): string | null {
  const enc = serperSessionStore.get(sessionId);
  if (!enc) return null;
  try { return decryptSecret(enc); } catch { serperSessionStore.delete(sessionId); return null; }
}

export function removeSessionSerperCredential(sessionId: string): void {
  serperSessionStore.delete(sessionId);
}

// Firebase Admin (optional) for signed-in users.
let adminApp: unknown = null;
let adminFirestore: unknown = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin: any = await import('firebase-admin');
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    adminApp = admin.default.initializeApp({ credential: admin.default.credential.cert(sa) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    adminApp = admin.default.initializeApp({ credential: admin.default.credential.applicationDefault() });
  }
  if (adminApp) {
    adminFirestore = admin.default.firestore(adminApp as never);
  }
} catch (err) {
  console.warn('[ponder] Firebase Admin not configured; account-scoped credential persistence disabled.', err instanceof Error ? err.message : String(err));
}

export async function verifyFirebaseIdToken(idToken: string): Promise<string | null> {
  if (!adminApp) return null;
  try {
    const admin: any = await import('firebase-admin');
    const decoded = await admin.default.auth(adminApp as never).verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function storeAccountCredential(uid: string, apiKey: string): Promise<void> {
  if (!adminFirestore) throw new Error('Account credential storage is not configured.');
  const admin: any = await import('firebase-admin');
  const db = adminFirestore as any;
  await db.collection('userCredentials').doc(uid).set({
    uid,
    encryptedKey: encryptSecret(apiKey),
    updatedAt: admin.default.firestore.FieldValue.serverTimestamp(),
  });
}

export async function readAccountCredential(uid: string): Promise<string | null> {
  if (!adminFirestore) return null;
  const admin: any = await import('firebase-admin');
  const db = adminFirestore as any;
  const snap = await db.collection('userCredentials').doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as { encryptedKey?: string };
  if (!data?.encryptedKey) return null;
  try {
    return decryptSecret(data.encryptedKey);
  } catch {
    return null;
  }
}

export async function removeAccountCredential(uid: string): Promise<void> {
  if (!adminFirestore) return;
  const db = adminFirestore as any;
  await db.collection('userCredentials').doc(uid).delete();
}

export async function storeAccountSerperCredential(uid: string, apiKey: string): Promise<void> {
  if (!adminFirestore) throw new Error('Account credential storage is not configured.');
  const admin: any = await import('firebase-admin');
  const db = adminFirestore as any;
  await db.collection('userSerperCredentials').doc(uid).set({
    uid,
    encryptedKey: encryptSecret(apiKey),
    updatedAt: admin.default.firestore.FieldValue.serverTimestamp(),
  });
}

export async function readAccountSerperCredential(uid: string): Promise<string | null> {
  if (!adminFirestore) return null;
  const db = adminFirestore as any;
  const snap = await db.collection('userSerperCredentials').doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as { encryptedKey?: string };
  if (!data?.encryptedKey) return null;
  try { return decryptSecret(data.encryptedKey); } catch { return null; }
}

export async function removeAccountSerperCredential(uid: string): Promise<void> {
  if (!adminFirestore) return;
  const db = adminFirestore as any;
  await db.collection('userSerperCredentials').doc(uid).delete();
}

export function isAccountStorageAvailable(): boolean {
  return Boolean(adminFirestore);
}

export function generateSessionId(): string {
  return crypto.randomBytes(24).toString('hex');
}
