import { withCorsHeaders } from '../_shared.js';

const PREVIEW_KEY = 'Hidden_Linux_preview.pdf';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCorsHeaders() });
}

export async function onRequestGet({ env }) {
  const obj = await env.BOOK_BUCKET.get(PREVIEW_KEY);
  if (!obj) {
    return new Response(
      'Preview PDF not found. Upload Hidden_Linux_preview.pdf to R2 (sample pages only).',
      { status: 404, headers: withCorsHeaders() }
    );
  }

  const headers = withCorsHeaders(new Headers());
  headers.set('Content-Type', 'application/pdf');
  headers.set('Content-Disposition', 'inline; filename="Hidden_Linux_preview.pdf"');
  headers.set('Cache-Control', 'public, max-age=300');
  return new Response(obj.body, { headers });
}
