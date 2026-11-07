import type { R2Bucket } from '@cloudflare/workers-types';
import { getClientGuideObjectKey } from '../../shared/clientGuides';
import { verifyClientGuidePlaybackToken } from '../_core/clientGuidePlayback';

export function parseClientGuideRange(value: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || size <= 0 || (!match[1] && !match[2])) return null;
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start < size && end >= start
    ? { start, end } : null;
}

export async function serveClientGuideMedia(request: Request, bucket: R2Bucket | undefined, corsHeaders: Headers) {
  const headers = new Headers(corsHeaders);
  headers.set('Allow', 'GET, HEAD, OPTIONS');
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Robots-Tag', 'noindex, noarchive, nosnippet');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, ETag');
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'range, if-range');
    return new Response(null, { status: 204, headers });
  }
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers });
  const url = new URL(request.url);
  const slug = /^\/api\/client-guides\/([a-z0-9-]+)\/stream$/.exec(url.pathname)?.[1] ?? '';
  const key = getClientGuideObjectKey(slug);
  if (!key) return new Response(null, { status: 404, headers });
  if (!await verifyClientGuidePlaybackToken(url.searchParams.get('token') ?? '', slug)) {
    return new Response(null, { status: 401, headers });
  }
  if (!bucket) return new Response(null, { status: 503, headers });
  const metadata = await bucket.head(key);
  if (!metadata) return new Response(null, { status: 404, headers });
  headers.set('Content-Type', 'video/mp4');
  headers.set('Content-Disposition', `inline; filename="${slug}.mp4"`);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('ETag', metadata.httpEtag);
  const rangeHeader = request.headers.get('range');
  const ifRange = request.headers.get('if-range');
  const useRange = rangeHeader && (!ifRange || ifRange === metadata.httpEtag);
  const range = useRange ? parseClientGuideRange(rangeHeader, metadata.size) : null;
  if (useRange && !range) {
    headers.set('Content-Range', `bytes */${metadata.size}`);
    return new Response(null, { status: 416, headers });
  }
  const length = range ? range.end - range.start + 1 : metadata.size;
  headers.set('Content-Length', String(length));
  if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${metadata.size}`);
  const status = range ? 206 : 200;
  if (request.method === 'HEAD') return new Response(null, { status, headers });
  const object = await bucket.get(key, range ? { range: { offset: range.start, length } } : undefined);
  if (!object || !('body' in object)) {
    headers.delete('Content-Length');
    headers.delete('Content-Range');
    return new Response(null, { status: 404, headers });
  }
  return new Response(object.body, { status, headers });
}
