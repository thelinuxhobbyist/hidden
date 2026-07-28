import { withCorsHeaders } from '../_shared.js';
import { getPurchaseByEmail, getSessionFromRequest, PRODUCT_KEY } from '../_library.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCorsHeaders() });
}

export async function onRequestGet({ request, env }) {
  const session = await getSessionFromRequest(env, request);
  if (!session) {
    return new Response('Sign in required', {
      status: 401,
      headers: withCorsHeaders(new Headers({ 'Content-Type': 'text/plain' }))
    });
  }

  const purchase = await getPurchaseByEmail(env, session.email);
  if (!purchase) {
    return new Response('No purchase found for this account', {
      status: 403,
      headers: withCorsHeaders(new Headers({ 'Content-Type': 'text/plain' }))
    });
  }

  const obj = await env.BOOK_BUCKET.get(PRODUCT_KEY);
  if (!obj) {
    return new Response('PDF not found', { status: 404, headers: withCorsHeaders() });
  }

  const headers = withCorsHeaders(new Headers());
  headers.set('Content-Type', 'application/pdf');
  headers.set('Content-Disposition', `attachment; filename="${PRODUCT_KEY}"`);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(obj.body, { headers });
}
