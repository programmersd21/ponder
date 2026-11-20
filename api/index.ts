import type { IncomingMessage, ServerResponse } from 'node:http';

type VercelReq = IncomingMessage & { url?: string; method?: string };
type VercelRes = ServerResponse & {
  status: (code: number) => VercelRes;
  json: (body: unknown) => void;
};

function stageHandler(_req: VercelReq, res: VercelRes) {
  res.status?.(200);
  if (typeof res.json === 'function') res.json({ ok: true, stage: 'function' });
  else {
    res.setHeader?.('Content-Type', 'application/json');
    res.end?.(JSON.stringify({ ok: true, stage: 'function' }));
  }
}

async function makeApp() {
  if (process.env.PONDER_DIAG === 'function') {
    console.log('[ponder diag] stage=function');
    return stageHandler;
  }

  if (process.env.PONDER_DIAG === 'express') {
    const { default: express } = await import('express');
    const app = express();
    app.get('/api/health', (_req: unknown, res: { json: (b: unknown) => void }) => {
      (res as { json: (b: unknown) => void }).json({ ok: true, stage: 'express' });
    });
    console.log('[ponder diag] stage=express');
    return app;
  }

  const { createApp } = await import('../server.ts');
  const app = createApp();
  console.log('[ponder diag] stage=app');
  return app;
}

type Handler = (req: VercelReq, res: VercelRes) => unknown;

const appPromise: Promise<Handler> = makeApp().catch((err) => {
  const detail = {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  };
  console.error('[ponder] BOOT FAILED:', detail);
  return (() => {
    throw Object.assign(new Error('BOOT_FAILED'), { detail });
  }) as Handler;
});

export default async function vercelHandler(req: VercelReq, res: VercelRes) {
  let handler: Handler;
  try {
    handler = await appPromise;
  } catch (err) {
    const detail = (err as { detail?: unknown }).detail ?? {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    };
    res.status?.(500);
    if (typeof res.json === 'function') res.json({ error: 'BOOT_FAILED', detail });
    else {
      res.setHeader?.('Content-Type', 'application/json');
      res.end?.(JSON.stringify({ error: 'BOOT_FAILED', detail }));
    }
    return;
  }

  try {
    const result = handler(req, res);
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      await result;
    }
  } catch (err) {
    const detail = {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    };
    console.error('[ponder] REQUEST FAILED:', detail);
    if (!res.headersSent) {
      res.status?.(500);
      if (typeof res.json === 'function') res.json({ error: 'REQUEST_FAILED', detail });
      else {
        res.setHeader?.('Content-Type', 'application/json');
        res.end?.(JSON.stringify({ error: 'REQUEST_FAILED', detail }));
      }
    }
  }
}
