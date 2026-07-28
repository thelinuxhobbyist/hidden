import { jsonResponse, withCorsHeaders } from '../../_shared.js';
import {
  formatMoney,
  getSiteConfig,
  isAdminAuthorized,
  saveSiteConfig
} from '../../_config.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCorsHeaders() });
}

function unauthorized() {
  return jsonResponse({ error: 'Unauthorized' }, 401);
}

export async function onRequestGet({ request, env }) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_EMAIL) {
    return jsonResponse({
      error: 'Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD on Pages.'
    }, 500);
  }

  if (!isAdminAuthorized(request, env)) {
    return unauthorized();
  }

  const config = await getSiteConfig(env);
  return jsonResponse({
    ...config,
    priceLabel: formatMoney(config.priceCents, config.currency)
  });
}

export async function onRequestPut({ request, env }) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_EMAIL) {
    return jsonResponse({
      error: 'Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD on Pages.'
    }, 500);
  }

  if (!isAdminAuthorized(request, env)) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const priceCents = Number(body.priceCents);
  if (!Number.isFinite(priceCents) || priceCents < 50) {
    return jsonResponse({ error: 'priceCents must be at least 50 (Stripe USD minimum is $0.50)' }, 400);
  }

  const saved = await saveSiteConfig(env, {
    priceCents,
    currency: body.currency,
    productName: body.productName,
    productDescription: body.productDescription
  });

  return jsonResponse({
    ...saved,
    priceLabel: formatMoney(saved.priceCents, saved.currency)
  });
}
