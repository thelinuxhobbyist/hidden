import { jsonResponse, withCorsHeaders } from '../_shared.js';
import { getPurchaseByEmail, getSessionFromRequest } from '../_library.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCorsHeaders() });
}

export async function onRequestGet({ request, env }) {
  const session = await getSessionFromRequest(env, request);
  if (!session) {
    return jsonResponse({ authenticated: false }, 401);
  }

  const purchase = await getPurchaseByEmail(env, session.email);
  if (!purchase) {
    return jsonResponse({
      authenticated: true,
      email: session.email,
      hasPurchase: false
    });
  }

  return jsonResponse({
    authenticated: true,
    email: session.email,
    hasPurchase: true,
    product: purchase.product,
    purchasedAt: purchase.purchased_at
  });
}
