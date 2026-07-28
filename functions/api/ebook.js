import { withCorsHeaders } from '../_shared.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCorsHeaders() });
}

export async function onRequestGet({ env }) {
  const obj = await env.BOOK_BUCKET.get('Hidden_Linux.pdf');
  if (!obj) {
    return new Response('PDF not found', { status: 404, headers: withCorsHeaders() });
  }

  const headers = withCorsHeaders(new Headers());
  headers.set('Content-Type', 'application/pdf');
  headers.set('Content-Disposition', 'inline; filename="Hidden_Linux.pdf"');
  return new Response(obj.body, { headers });
}
