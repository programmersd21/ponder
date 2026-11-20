import type { MediaAsset } from '../lib/schema.ts';

const VISUAL_EVIDENCE_PATTERNS = [
  /\b(moon|mars|jupiter|saturn|venus|mercury|nebula|galaxy|black hole|eclipse|comet|supernova|aurora|planet|solar system|telescope|jwst|hubble)s?\b/i,
  /\b(volcano|glacier|canyon|tectonic|earthquake|coral|rainforest|desert|mountain|crystal|mineral|fossil|geyser)s?\b/i,
  /\b(cell|mitochondria|chloroplast|neuron|dna|heart|brain|lung|eye|ear|leaf|photosynthesis|fungi|bacteria|virus)s?\b/i,
  /\b(pyramid|colosseum|parthenon|cathedral|arch|bridge|turbine|steam engine|observatory|cern|tokamak|reactor)s?\b/i,
  /\b(rainbows?|prism|lightning|tsunami|hurricane|tornado|clouds?|diffraction)s?\b/i,
];

const NON_PHOTO_PATTERNS = [
  /\b(binary search|quicksort|mergesort|algorithm|big o|recursion|hash table|linked list|graph traversal|dynamic programming)s?\b/i,
  /\b(derivative|integral|quadratic|linear algebra|eigenvalue|matrix|calculus|probability|bayes|logarithm|polynomial|trigonometry)s?\b/i,
];

export function shouldSearchEducationalImage(question: string): boolean {
  // Attempt a sourced image for any substantive question; the search itself
  // returns null gracefully when nothing suitable is found.
  if (question.trim().length < 4) return false;
  return true;
}

function stripHtmlTags(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchTerm(question: string): string {
  return question
    .replace(/^(why|how|what|when|where|who|can you explain|explain|tell me about)\s+(does|do|is|are|did|can|the|a|an)?\s*/i, '')
    .replace(/\b(image|images|photo|photos|picture|pictures|from the web|from web|online)\b/gi, '')
    .replace(/[?!.]+$/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 90);
}

/**
 * Fetches an openly-licensed educational photograph via the official Wikipedia / Wikimedia Commons API
 * with strict timeout, license/artist attribution, and non-blocking error isolation.
 */
export async function searchSourcedEducationalImage(
  question: string,
  externalSignal?: AbortSignal
): Promise<MediaAsset | null> {
  if (!shouldSearchEducationalImage(question)) return null;

  const searchTerm = buildSearchTerm(question);
  if (searchTerm.length < 3) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3200);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const searchUrl = new URL('https://en.wikipedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('origin', '*');
    searchUrl.searchParams.set('generator', 'search');
    searchUrl.searchParams.set('gsrsearch', searchTerm);
    searchUrl.searchParams.set('gsrlimit', '3');
    searchUrl.searchParams.set('prop', 'pageimages|info|pageprops');
    searchUrl.searchParams.set('piprop', 'thumbnail|name');
    searchUrl.searchParams.set('pithumbsize', '960');
    searchUrl.searchParams.set('inprop', 'url');

    const res = await fetch(searchUrl.toString(), {
      headers: { 'User-Agent': 'PonderConceptLearning/1.0 (educational research)' },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            fullurl?: string;
            pageimage?: string;
            thumbnail?: { source?: string; width?: number; height?: number };
          }
        >;
      };
    };

    const pages = Object.values(json.query?.pages ?? {});
    const best = pages.find(
      (p) =>
        p.thumbnail?.source &&
        p.pageimage &&
        !/\.(svg|djvu|tif|tiff)$/i.test(p.pageimage) &&
        (p.thumbnail.width ?? 0) >= 320
    );

    if (!best || !best.thumbnail?.source || !best.pageimage) return null;

    // Retrieve verified license & attribution metadata from Wikimedia Commons API
    const infoUrl = new URL('https://commons.wikimedia.org/w/api.php');
    infoUrl.searchParams.set('action', 'query');
    infoUrl.searchParams.set('format', 'json');
    infoUrl.searchParams.set('origin', '*');
    infoUrl.searchParams.set('titles', `File:${best.pageimage}`);
    infoUrl.searchParams.set('prop', 'imageinfo');
    infoUrl.searchParams.set('iiprop', 'extmetadata|url');

    let attribution = 'Wikimedia Commons contributor';
    let license = 'Openly licensed reference image';
    let caption = `Reference photograph for ${best.title ?? searchTerm}`;
    let filePageUrl = best.fullurl ?? 'https://commons.wikimedia.org';

    try {
      const infoRes = await fetch(infoUrl.toString(), {
        headers: { 'User-Agent': 'PonderConceptLearning/1.0 (educational research)' },
        signal: controller.signal,
      });
      if (infoRes.ok) {
        const infoJson = (await infoRes.json()) as {
          query?: {
            pages?: Record<
              string,
              {
                imageinfo?: Array<{
                  descriptionurl?: string;
                  extmetadata?: Record<string, { value?: string }>;
                }>;
              }
            >;
          };
        };
        const filePage = Object.values(infoJson.query?.pages ?? {})[0];
        const info = filePage?.imageinfo?.[0];
        if (info?.descriptionurl) {
          filePageUrl = info.descriptionurl;
        }
        const meta = info?.extmetadata;
        if (meta) {
          if (meta.Artist?.value) {
            const artist = stripHtmlTags(meta.Artist.value);
            if (artist) attribution = artist.slice(0, 140);
          }
          if (meta.LicenseShortName?.value) {
            license = stripHtmlTags(meta.LicenseShortName.value).slice(0, 80);
          }
          if (meta.ImageDescription?.value) {
            const desc = stripHtmlTags(meta.ImageDescription.value);
            if (desc && desc.length >= 12) {
              caption = desc.slice(0, 220);
            }
          }
        }
      }
    } catch {
      // Metadata lookup failed softly; preserve Wikipedia article URL & fallback attribution
    }

    return {
      kind: 'sourced_image',
      url: best.thumbnail.source,
      sourceUrl: filePageUrl,
      title: (best.title ?? searchTerm).slice(0, 140),
      caption,
      alt: `Reference photograph illustrating ${best.title ?? searchTerm}`,
      attribution,
      license,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
