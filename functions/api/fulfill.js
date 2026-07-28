import { jsonResponse, withCorsHeaders } from '../_shared.js';
import { getCheckoutSession, sendEbookEmail } from '../_email.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCorsHeaders() });
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse({ error: 'Stripe is not configured' }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = body.session_id;

  if (!sessionId || typeof sessionId !== 'string') {
    return jsonResponse({ error: 'Missing session_id' }, 400);
  }

  const session = await getCheckoutSession(env, sessionId);

  if (session.error) {
    return jsonResponse({ error: 'Invalid checkout session', detail: session.error }, 400);
  }

  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return jsonResponse({ error: 'Payment not completed yet' }, 402);
  }

  const email = session.customer_details?.email || session.customer_email;
  const result = await sendEbookEmail(env, email);

  if (!result.ok) {
    return jsonResponse({ error: result.error, detail: result.detail }, 500);
  }

  return jsonResponse({
    ok: true,
    email,
    message: 'Ebook delivery started. Check your inbox (and spam folder).'
  });
}
