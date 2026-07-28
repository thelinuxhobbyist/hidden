import { jsonResponse, withCorsHeaders } from '../_shared.js';
import { formatMoney, getSiteConfig } from '../_config.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCorsHeaders() });
}

export async function onRequestGet({ env }) {
  const config = await getSiteConfig(env);
  const headers = withCorsHeaders(new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, max-age=0'
  }));

  return new Response(JSON.stringify({
    priceCents: config.priceCents,
    currency: config.currency,
    productName: config.productName,
    productDescription: config.productDescription,
    priceLabel: formatMoney(config.priceCents, config.currency)
  }), { status: 200, headers });
}
