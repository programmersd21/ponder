import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import cookieParser from 'cookie-parser';
import {
  generateSessionId,
  isAccountStorageAvailable,
  readAccountCredential,
  readSessionCredential,
  removeAccountCredential,
  removeSessionCredential,
  storeAccountCredential,
  storeSessionCredential,
  validateGeminiCredential,
  validateSerperCredential,
  verifyFirebaseIdToken,
  storeSessionSerperCredential,
  readSessionSerperCredential,
  removeSessionSerperCredential,
  storeAccountSerperCredential,
  readAccountSerperCredential,
  removeAccountSerperCredential,
  encryptSecret,
  decryptSecret,
} from './src/server/credentials.ts';
import { MODEL_REGISTRY, streamExplanationFromGemini } from './src/server/gemini.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ExplainRequestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(2, 'Please ask a slightly longer question.')
    .max(1000, 'Please keep your question under 1,000 characters.'),
  depth: z.enum(['quick', 'standard', 'deep']).optional().default('standard'),
  researchMode: z.enum(['auto', 'always', 'off']).optional().default('auto'),
  model: z.string().trim().max(64).optional(),
  history: z
    .array(
      z.object({
        question: z.string().max(1000),
        title: z.string().max(160),
        shortAnswer: z.string().max(1200),
        visualisationType: z.string().max(64).nullable().optional(),
      })
    )
    .max(6)
    .optional()
    .default([]),
});

// Per-client in-flight concurrency limiter and duplicate-request prevention
const activeRequestsByClient = new Map<string, Set<string>>();
const MAX_CONCURRENT_PER_CLIENT = 2;

// Anonymous credentials are stored server-side keyed by a session id for local
// development, and mirrored into an httpOnly cookie so they survive the
// stateless, ephemeral serverless instances used on Vercel.
const SESSION_COOKIE = 'ponder_session';
const GEMINI_COOKIE = 'ponder_gemini';
const SERPER_COOKIE = 'ponder_serper';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
  };
}

function getClientKey(req: express.Request): string {
  const uidHeader = req.header('x-ponder-uid');
  if (uidHeader && /^[a-zA-Z0-9_-]{4,128}$/.test(uidHeader)) {
    return `uid:${uidHeader}`;
  }
  const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return `ip:${forwarded || req.ip || 'unknown'}`;
}

// We trust the Firebase ID token when present and fall back to a session
// cookie for anonymous users. Frontend-supplied UIDs are never trusted.
async function resolveIdentity(req: express.Request): Promise<{ uid: string | null; sessionId: string }> {
  const authHeader = req.header('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    const uid = await verifyFirebaseIdToken(token);
    if (uid) return { uid, sessionId: '' };
  }
  let sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!sessionId || !/^[a-f0-9]{48}$/.test(sessionId)) {
    sessionId = generateSessionId();
  }
  return { uid: null, sessionId };
}

function readCookieCredential(req: express.Request, cookieName: string): string | null {
  const raw = req.cookies?.[cookieName] as string | undefined;
  if (!raw) return null;
  try {
    return decryptSecret(raw);
  } catch {
    return null;
  }
}

async function getCredential(req: express.Request): Promise<string | null> {
  const { uid, sessionId } = await resolveIdentity(req);
  if (uid) {
    const acct = await readAccountCredential(uid);
    if (acct) return acct;
  } else {
    const fromCookie = readCookieCredential(req, GEMINI_COOKIE);
    if (fromCookie) return fromCookie;
    const sess = readSessionCredential(sessionId);
    if (sess) return sess;
  }
  const envKey = (process.env.GEMINI_API_KEY || '').trim();
  if (envKey && envKey !== 'MY_GEMINI_API_KEY') return envKey;
  return null;
}

async function getSerperCredential(req: express.Request): Promise<string | null> {
  const { uid, sessionId } = await resolveIdentity(req);
  if (uid) {
    const acct = await readAccountSerperCredential(uid);
    if (acct) return acct;
  } else {
    const fromCookie = readCookieCredential(req, SERPER_COOKIE);
    if (fromCookie) return fromCookie;
    const sess = readSessionSerperCredential(sessionId);
    if (sess) return sess;
  }
  const envKey = (process.env.SERPER_API_KEY || '').trim();
  if (envKey) return envKey;
  return null;
}

// Builds the Express application with all /api/* routes. Exported so it can be
// mounted either by the long-running dev/prod server (startServer) or by a
// Vercel serverless function (api/[...path].ts).
export function createApp(): express.Express {
  const app = express();

  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      geminiConfigured: true,
      models: MODEL_REGISTRY,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/gemini/status', async (req, res) => {
    const { uid, sessionId } = await resolveIdentity(req);
    let stored: string | null = null;
    if (uid) {
      stored = await readAccountCredential(uid);
    } else {
      stored = readCookieCredential(req, GEMINI_COOKIE) || readSessionCredential(sessionId);
    }
    const envKey = (process.env.GEMINI_API_KEY || '').trim();
    const key = stored || (envKey && envKey !== 'MY_GEMINI_API_KEY' ? envKey : null);
    // Ensure session cookie is set for anonymous users
    if (!uid && sessionId) {
      res.cookie(SESSION_COOKIE, sessionId, cookieOptions());
    }
    res.json({ configured: Boolean(key), accountStorage: isAccountStorageAvailable(), signedIn: Boolean(uid) });
  });

  app.post('/api/gemini/configure', async (req, res) => {
    const schema = z.object({ apiKey: z.string().trim().min(1).max(512), idToken: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ category: 'INVALID_REQUEST', error: 'Invalid credential payload.' });
      return;
    }
    const { apiKey, idToken } = parsed.data;
    const validation = await validateGeminiCredential(apiKey);
    if (!validation.ok) {
      const status = validation.category === 'INVALID_CREDENTIAL' ? 401 : validation.category === 'QUOTA_EXCEEDED' ? 429 : 503;
      res.status(status).json({ category: validation.category, error: validation.message, valid: false });
      return;
    }

    let uid: string | null = null;
    if (idToken) uid = await verifyFirebaseIdToken(idToken);

    if (uid) {
      await storeAccountCredential(uid, apiKey);
    } else {
      const { sessionId } = await resolveIdentity(req);
      storeSessionCredential(sessionId, apiKey);
      res.cookie(SESSION_COOKIE, sessionId, cookieOptions());
      res.cookie(GEMINI_COOKIE, encryptSecret(apiKey), cookieOptions());
    }
    res.json({ ok: true, valid: true, message: validation.message, persisted: Boolean(uid) });
  });

  // Promote a guest ("temp") session's API credentials into the signed-in
  // account. Called right after Google sign-in so keys entered before signing
  // in keep working on the real account. Never overwrites an existing account
  // credential — the user's saved key always wins.
  app.post('/api/account/migrate-credentials', async (req, res) => {
    const schema = z.object({ idToken: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid migration payload.' });
      return;
    }
    let uid: string | null = null;
    try {
      uid = await verifyFirebaseIdToken(parsed.data.idToken);
    } catch {
      uid = null;
    }
    if (!uid) {
      res.status(401).json({ ok: false, error: 'Sign-in could not be verified.' });
      return;
    }

    const { sessionId } = await resolveIdentity(req);
    const migrated: { gemini: boolean; serper: boolean } = { gemini: false, serper: false };

    try {
      // Gemini: account storage takes priority; skip if the account already has one.
      const existingGemini = await readAccountCredential(uid);
      if (!existingGemini) {
        const guestGemini =
          readCookieCredential(req, GEMINI_COOKIE) || readSessionCredential(sessionId);
        if (guestGemini) {
          await storeAccountCredential(uid, guestGemini);
          migrated.gemini = true;
        }
      }

      // Serper: same rule.
      const existingSerper = await readAccountSerperCredential(uid);
      if (!existingSerper) {
        const guestSerper =
          readCookieCredential(req, SERPER_COOKIE) || readSessionSerperCredential(sessionId);
        if (guestSerper) {
          await storeAccountSerperCredential(uid, guestSerper);
          migrated.serper = true;
        }
      }
    } catch (err) {
      console.error('[ponder] credential migration failed:', err instanceof Error ? err.message : String(err));
    }

    // Clear the guest credential cookies so they aren't reused by another account.
    res.clearCookie(GEMINI_COOKIE, cookieOptions());
    res.clearCookie(SERPER_COOKIE, cookieOptions());
    res.json({ ok: true, migrated });
  });

  app.post('/api/gemini/disconnect', async (req, res) => {
    const schema = z.object({ idToken: z.string().optional() });
    const parsed = schema.safeParse(req.body ?? {});
    const idToken = parsed.success ? parsed.data.idToken : undefined;
    let uid: string | null = null;
    if (idToken) uid = await verifyFirebaseIdToken(idToken);
    if (uid) {
      await removeAccountCredential(uid);
    } else {
      const { sessionId } = await resolveIdentity(req);
      removeSessionCredential(sessionId);
    }
    res.clearCookie(GEMINI_COOKIE, cookieOptions());
    res.json({ ok: true });
  });

  app.post('/api/gemini/test', async (req, res) => {
    const key = await getCredential(req);
    if (!key) {
      res.status(401).json({ category: 'NOT_CONFIGURED', error: 'Gemini is not configured.' });
      return;
    }
    const validation = await validateGeminiCredential(key);
    if (!validation.ok) {
      res.status(401).json({ category: validation.category, error: validation.message, valid: false });
      return;
    }
    res.json({ ok: true, valid: true, message: validation.message });
  });

  app.get('/api/serper/status', async (req, res) => {
    const { uid, sessionId } = await resolveIdentity(req);
    let key: string | null = null;
    if (uid) {
      key = await readAccountSerperCredential(uid);
    } else {
      key = readCookieCredential(req, SERPER_COOKIE) || readSessionSerperCredential(sessionId);
    }
    const envKey = (process.env.SERPER_API_KEY || '').trim();
    if (!uid && sessionId) {
      res.cookie(SESSION_COOKIE, sessionId, cookieOptions());
    }
    res.json({ configured: Boolean(key || envKey) });
  });

  app.post('/api/serper/configure', async (req, res) => {
    const schema = z.object({ apiKey: z.string().trim().min(1).max(256), idToken: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ category: 'INVALID_REQUEST', error: 'Invalid payload.' }); return; }
    const validation = await validateSerperCredential(parsed.data.apiKey);
    if (!validation.ok) {
      const status = validation.category === 'INVALID_CREDENTIAL' ? 401 : validation.category === 'QUOTA_EXCEEDED' ? 429 : 503;
      res.status(status).json({ category: validation.category, error: validation.message, valid: false });
      return;
    }
    let uid: string | null = null;
    if (parsed.data.idToken) uid = await verifyFirebaseIdToken(parsed.data.idToken);
    if (uid) {
      await storeAccountSerperCredential(uid, parsed.data.apiKey);
    } else {
      const { sessionId } = await resolveIdentity(req);
      storeSessionSerperCredential(sessionId, parsed.data.apiKey);
      res.cookie(SESSION_COOKIE, sessionId, cookieOptions());
      res.cookie(SERPER_COOKIE, encryptSecret(parsed.data.apiKey), cookieOptions());
    }
    res.json({ ok: true, valid: true, message: validation.message });
  });

  app.post('/api/serper/disconnect', async (req, res) => {
    const schema = z.object({ idToken: z.string().optional() });
    const parsed = schema.safeParse(req.body ?? {});
    const idToken = parsed.success ? parsed.data.idToken : undefined;
    let uid: string | null = null;
    if (idToken) uid = await verifyFirebaseIdToken(idToken);
    if (uid) await removeAccountSerperCredential(uid);
    else { const { sessionId } = await resolveIdentity(req); removeSessionSerperCredential(sessionId); }
    res.clearCookie(SERPER_COOKIE, cookieOptions());
    res.json({ ok: true });
  });

  app.post('/api/serper/test', async (req, res) => {
    const key = await getSerperCredential(req);
    if (!key) { res.status(401).json({ category: 'NOT_CONFIGURED', error: 'Serper is not configured.' }); return; }
    const validation = await validateSerperCredential(key);
    if (!validation.ok) { res.status(401).json({ category: validation.category, error: validation.message, valid: false }); return; }
    res.json({ ok: true, valid: true, message: validation.message });
  });

  app.post('/api/explain', async (req, res) => {
    const requestId = crypto.randomBytes(6).toString('hex');
    const parsed = ExplainRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        category: 'INVALID_REQUEST',
        error: parsed.error.issues[0]?.message ?? 'Invalid question format.',
      });
      return;
    }

    const { question, history, depth, researchMode, model } = parsed.data;
    const credential = await getCredential(req);
    const serperCredential = await getSerperCredential(req);
    if (!credential) {
      res.status(401).json({ category: 'NOT_CONFIGURED', error: 'Gemini is not configured. Add your own API key to continue.' });
      return;
    }
    const clientKey = getClientKey(req);
    const dedupKey = `${depth}:${researchMode}:${question.toLowerCase()}`;

    let activeSet = activeRequestsByClient.get(clientKey);
    if (!activeSet) {
      activeSet = new Set();
      activeRequestsByClient.set(clientKey, activeSet);
    }

    if (activeSet.has(dedupKey)) {
      res.status(429).json({
        category: 'RATE_LIMITED',
        error: 'This exact question is already generating. Please wait a moment.',
      });
      return;
    }

    if (activeSet.size >= MAX_CONCURRENT_PER_CLIENT) {
      res.status(429).json({
        category: 'RATE_LIMITED',
        error: 'An exploration is already running. Cancel it or wait for it to finish before starting another.',
      });
      return;
    }

    activeSet.add(dedupKey);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-ponder-Request-Id', requestId);
    res.flushHeaders?.();

    const abortController = new AbortController();
    let closed = false;

    const cleanupTracking = () => {
      activeSet?.delete(dedupKey);
      if (activeSet && activeSet.size === 0) {
        activeRequestsByClient.delete(clientKey);
      }
    };

    res.on('close', () => {
      if (!res.writableEnded) {
        closed = true;
        abortController.abort();
        cleanupTracking();
      }
    });

    const sendEvent = (event: string, data: unknown) => {
      if (closed || res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await streamExplanationFromGemini(
        question,
        history,
        {
          depth,
          researchMode,
          clientSignal: abortController.signal,
          apiKey: credential,
          model,
        },
        {
          onStatus: (stage, detail) => sendEvent('status', { stage, detail }),
          onPartial: (partial) => sendEvent('partial', partial),
          onComplete: (explanation) => {
            sendEvent('complete', { explanation });
            cleanupTracking();
            if (!res.writableEnded) res.end();
          },
          onError: (err) => {
            console.warn(
              `[server] request=${requestId} explain failed category=${err.category} status=${err.statusCode}`
            );
            sendEvent('error', {
              category: err.category,
              message: err.message,
              statusCode: err.statusCode,
              retryable: err.retryable,
            });
            cleanupTracking();
            if (!res.writableEnded) res.end();
          },
        }
      );
    } catch (err) {
      console.error(`[server] request=${requestId} unexpected error:`, err);
      sendEvent('error', {
        category: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while generating the explanation.',
        statusCode: 500,
        retryable: true,
      });
      cleanupTracking();
      if (!res.writableEnded) res.end();
    }
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`ponder server listening on http://localhost:${port}`);
  });
}

const isDirectRun = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  startServer().catch((err) => {
    console.error('Failed to start ponder server:', err);
    process.exit(1);
  });
}