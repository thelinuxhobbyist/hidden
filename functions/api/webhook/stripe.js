import { withCorsHeaders } from '../../_shared.js';
import { sendEbookEmail } from '../../_email.js';
import {
  markPurchaseEmailSent,
  recordPurchase,
  shouldSendPurchaseEmail
} from '../../_library.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCorsHeaders() });
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function verifyStripeSignature(payload, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  const pieces = signatureHeader.split(',').map((piece) => piece.trim());
  const timestamp = pieces.find((piece) => piece.startsWith('t='))?.slice(2);
  const candidates = pieces.filter((piece) => piece.startsWith('v1=')).map((piece) => piece.slice(3));
  if (!timestamp || !candidates.length) return false;

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const digest = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return candidates.some((expected) => timingSafeEqual(digest, expected));
}

export async function onRequestPost({ request, env }) {
  const text = await request.text();

  if (env.STRIPE_WEBHOOK_SECRET) {
    const signature = request.headers.get('stripe-signature');
    const valid = await verifyStripeSignature(text, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) {
      return new Response('Invalid signature', { status: 400, headers: withCorsHeaders() });
    }
  }

  let event;
  try {
    event = JSON.parse(text);
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: withCorsHeaders() });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email || session.customer_email;
    const origin = new URL(request.url).origin;

    const purchaseResult = await recordPurchase(env, {
      email,
      stripeSessionId: session.id,
      stripeCustomerId: session.customer || null,
      stripePaymentIntent: session.payment_intent || null
    });

    if (!purchaseResult.ok) {
      console.error('Failed to record purchase:', purchaseResult);
      return new Response(JSON.stringify(purchaseResult), {
        status: 500,
        headers: withCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
      });
    }

    if (await shouldSendPurchaseEmail(env, purchaseResult.purchase)) {
      const result = await sendEbookEmail(env, email, { origin });

      if (!result.ok) {
        console.error('Webhook ebook delivery failed:', result);
        return new Response(JSON.stringify(result), {
          status: 500,
          headers: withCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
        });
      }

      await markPurchaseEmailSent(env, purchaseResult.purchase);
    }
  }

  return new Response('ok', { status: 200, headers: withCorsHeaders() });
}
