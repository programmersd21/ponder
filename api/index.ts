import { createApp } from '../server';

// Vercel serverless entrypoint. Reuses the same Express app (all /api/*
// routes) as the long-running dev/prod server. Mapped via vercel.json
// rewrites so every /api/* path (any depth) reaches this function.
const app = createApp();

export default app;
