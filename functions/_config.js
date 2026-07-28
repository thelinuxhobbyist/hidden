const CONFIG_KEY = 'site-config.json';

export const DEFAULT_CONFIG = {
  priceCents: 1900,
  currency: 'usd',
  productName: 'Hidden Linux Ebook',
  productDescription: 'Instant PDF delivery via email'
};

export function normalizeConfig(input = {}) {
  const priceCents = Number(input.priceCents);

  return {
    priceCents: Number.isFinite(priceCents) && priceCents >= 50 ? Math.round(priceCents) : DEFAULT_CONFIG.priceCents,
    currency: typeof input.currency === 'string' && input.currency.trim()
      ? input.currency.trim().toLowerCase()
      : DEFAULT_CONFIG.currency,
    productName: typeof input.productName === 'string' && input.productName.trim()
      ? input.productName.trim()
      : DEFAULT_CONFIG.productName,
    productDescription: typeof input.productDescription === 'string' && input.productDescription.trim()
      ? input.productDescription.trim()
      : DEFAULT_CONFIG.productDescription
  };
}

export async function getSiteConfig(env) {
  try {
    const obj = await env.BOOK_BUCKET.get(CONFIG_KEY);
    if (!obj) return { ...DEFAULT_CONFIG };

    const parsed = await obj.json();
    return normalizeConfig(parsed);
  } catch (error) {
    console.error('Failed to read site config:', error);
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveSiteConfig(env, config) {
  const next = normalizeConfig(config);
  await env.BOOK_BUCKET.put(CONFIG_KEY, JSON.stringify(next, null, 2), {
    httpMetadata: { contentType: 'application/json' }
  });
  return next;
}

export function formatMoney(priceCents, currency = 'usd') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(priceCents / 100);
  } catch {
    return `$${(priceCents / 100).toFixed(2)}`;
  }
}

export function isAdminAuthorized(request, env) {
  const expectedPassword = env.ADMIN_PASSWORD;
  const expectedEmail = (env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!expectedPassword || !expectedEmail) return false;

  const header = request.headers.get('Authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const password = bearer || request.headers.get('X-Admin-Password') || '';
  const email = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();

  return email === expectedEmail && password === expectedPassword;
}

