import { createApp } from '../server';

// Vercel serverless entrypoint. It reuses the exact same Express app (all
// /api/* routes) that the long-running dev/prod server uses, so behaviour is
// identical locally and on Vercel.
const app = createApp();

export default app;