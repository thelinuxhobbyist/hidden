import { jsonResponse, withCorsHeaders, getPublicSiteUrl } from '../_shared.js';
import { getCheckoutSession, sendEbookEmail } from '../_email.js';
import {
  markPurchaseEmailSent,
  recordPurchase,
  shouldSendPurchaseEmail
} from '../_library.js';

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
  const origin = getPublicSiteUrl(env, request);

  const purchaseResult = await recordPurchase(env, {
    email,
    stripeSessionId: session.id,
    stripeCustomerId: session.customer || null,
    stripePaymentIntent: session.payment_intent || null
  });

  if (!purchaseResult.ok) {
    return jsonResponse({ error: purchaseResult.error || 'Could not record purchase' }, 500);
  }

  let emailed = false;
  if (await shouldSendPurchaseEmail(env, purchaseResult.purchase)) {
    const result = await sendEbookEmail(env, email, { origin });

    if (!result.ok) {
      return jsonResponse({ error: result.error, detail: result.detail }, 500);
    }

    await markPurchaseEmailSent(env, purchaseResult.purchase);
    emailed = true;
  }

  return jsonResponse({
    ok: true,
    email,
    emailed,
    message: emailed
      ? 'Ebook delivery started. Check your inbox (and spam folder). You can also access updates anytime from My Library.'
      : 'Purchase confirmed. Check your inbox for the ebook, or open My Library anytime for the latest version.'
  });
}
