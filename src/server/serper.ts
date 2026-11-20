export type SerperResult = {
  title: string;
  link: string;
  snippet: string;
};

export async function searchSerper(apiKey: string, query: string, signal: AbortSignal): Promise<SerperResult[]> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 6 }),
    signal,
  });
  if (!res.ok) throw new Error(`serper ${res.status}`);
  const data = (await res.json()) as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (data.organic ?? []).slice(0, 6).map((r) => ({
    title: (r.title ?? '').slice(0, 180),
    link: (r.link ?? '').slice(0, 580),
    snippet: (r.snippet ?? '').slice(0, 400),
  }));
}

export type SerperImage = {
  title: string;
  imageUrl: string;
  link: string;
  source: string;
};

export async function searchSerperImages(apiKey: string, query: string, signal: AbortSignal): Promise<SerperImage[]> {
  const res = await fetch('https://google.serper.dev/images', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 4 }),
    signal,
  });
  if (!res.ok) throw new Error(`serper images ${res.status}`);
  const data = (await res.json()) as { images?: Array<{ title?: string; imageUrl?: string; link?: string; source?: string }> };
  return (data.images ?? []).slice(0, 4).map((r) => ({
    title: (r.title ?? '').slice(0, 180),
    imageUrl: (r.imageUrl ?? '').slice(0, 800),
    link: (r.link ?? '').slice(0, 580),
    source: (r.source ?? '').slice(0, 120),
  }));
}
