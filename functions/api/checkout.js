import { jsonResponse, withCorsHeaders } from '../_shared.js';
import { getSiteConfig } from '../_config.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCorsHeaders() });
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse({ error: 'Stripe is not configured' }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const email = body.email;
  const url = new URL(request.url);
  const config = await getSiteConfig(env);

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', `${url.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${url.origin}/cancelled.html`);
  params.append('line_items[0][price_data][currency]', config.currency);
  params.append('line_items[0][price_data][product_data][name]', config.productName);
  params.append('line_items[0][price_data][product_data][description]', config.productDescription);
  params.append('line_items[0][price_data][unit_amount]', String(config.priceCents));
  params.append('line_items[0][quantity]', '1');
  if (email) params.append('customer_email', email);

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  const data = await resp.json();
  if (data.url) {
    return jsonResponse({ url: data.url });
  }

  return jsonResponse({ error: 'Could not create session', detail: data }, 500);
}
