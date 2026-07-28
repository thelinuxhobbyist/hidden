const PRODUCT_KEY = 'Hidden_Linux.pdf';
const SESSION_COOKIE = 'hl_session';
const SESSION_DAYS = 30;
const LOGIN_TOKEN_MINUTES = 20;
const MAX_LOGIN_REQUESTS_PER_HOUR = 5;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function nowIso() {
  return new Date().toISOString();
}

function addMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function addDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function purchaseEmailKey(email) {
  return `purchases/by-email/${normalizeEmail(email)}.json`;
}

function purchaseSessionKey(sessionId) {
  return `purchases/by-session/${sessionId}.json`;
}

function loginTokenKey(tokenHash) {
  return `auth/login-tokens/${tokenHash}.json`;
}

function sessionKey(tokenHash) {
  return `auth/sessions/${tokenHash}.json`;
}

function loginRateKey(email) {
  return `auth/rate-limit/${normalizeEmail(email)}.json`;
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function putJson(env, key, value) {
  await env.BOOK_BUCKET.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: 'application/json' }
  });
}

async function getJson(env, key) {
  const obj = await env.BOOK_BUCKET.get(key);
  if (!obj) return null;
  try {
    return await obj.json();
  } catch {
    return null;
  }
}

async function deleteKey(env, key) {
  try {
    await env.BOOK_BUCKET.delete(key);
  } catch {
    // ignore missing keys
  }
}

export async function recordPurchase(env, {
  email,
  stripeSessionId,
  stripeCustomerId = null,
  stripePaymentIntent = null,
  product = PRODUCT_KEY
}) {
  const normalized = normalizeEmail(email);
  if (!normalized || !stripeSessionId) {
    return { ok: false, error: 'Missing email or stripe session id' };
  }

  const existingBySession = await getJson(env, purchaseSessionKey(stripeSessionId));
  if (existingBySession) {
    return { ok: true, purchase: existingBySession, created: false };
  }

  const purchase = {
    id: randomToken(16),
    email: normalized,
    stripe_session_id: stripeSessionId,
    stripe_customer_id: stripeCustomerId || null,
    stripe_payment_intent: stripePaymentIntent || null,
    product,
    purchased_at: nowIso(),
    created_at: nowIso(),
    last_email_at: null
  };

  await putJson(env, purchaseSessionKey(stripeSessionId), purchase);

  const existingByEmail = await getJson(env, purchaseEmailKey(normalized));
  if (!existingByEmail || existingByEmail.purchased_at < purchase.purchased_at) {
    await putJson(env, purchaseEmailKey(normalized), purchase);
  }

  return { ok: true, purchase, created: true };
}

export async function shouldSendPurchaseEmail(env, purchase) {
  if (!purchase) return false;
  if (!purchase.last_email_at) return true;
  const last = new Date(purchase.last_email_at).getTime();
  return !Number.isFinite(last) || Date.now() - last > 10 * 60 * 1000;
}

export async function markPurchaseEmailSent(env, purchase) {
  if (!purchase?.stripe_session_id || !purchase?.email) return;
  const updated = { ...purchase, last_email_at: nowIso() };
  await putJson(env, purchaseSessionKey(purchase.stripe_session_id), updated);
  await putJson(env, purchaseEmailKey(purchase.email), updated);
  return updated;
}

export async function hasPurchase(env, email) {
  const purchase = await getJson(env, purchaseEmailKey(email));
  return Boolean(purchase?.email);
}

export async function getPurchaseByEmail(env, email) {
  return getJson(env, purchaseEmailKey(email));
}

async function allowLoginRequest(env, email) {
  const key = loginRateKey(email);
  const current = (await getJson(env, key)) || { count: 0, window: Date.now() };
  const hourMs = 60 * 60 * 1000;

  if (Date.now() - current.window > hourMs) {
    current.count = 0;
    current.window = Date.now();
  }

  if (current.count >= MAX_LOGIN_REQUESTS_PER_HOUR) {
    return false;
  }

  current.count += 1;
  await putJson(env, key, current);
  return true;
}

export async function createLoginToken(env, email) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { ok: false, error: 'Invalid email' };
  }

  if (!(await allowLoginRequest(env, normalized))) {
    return { ok: false, error: 'Too many login requests. Try again later.' };
  }

  const purchased = await hasPurchase(env, normalized);
  if (!purchased) {
    // Do not reveal whether the email owns a purchase.
    return { ok: true, sent: false };
  }

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const record = {
    email: normalized,
    expires_at: addMinutes(LOGIN_TOKEN_MINUTES),
    created_at: nowIso(),
    used_at: null
  };

  await putJson(env, loginTokenKey(tokenHash), record);
  return { ok: true, sent: true, token, email: normalized, expiresAt: record.expires_at };
}

export async function consumeLoginToken(env, token) {
  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'Missing token' };
  }

  const tokenHash = await sha256Hex(token);
  const record = await getJson(env, loginTokenKey(tokenHash));
  if (!record) {
    return { ok: false, error: 'Invalid or expired link' };
  }

  if (record.used_at) {
    return { ok: false, error: 'This login link was already used' };
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    await deleteKey(env, loginTokenKey(tokenHash));
    return { ok: false, error: 'This login link has expired' };
  }

  record.used_at = nowIso();
  await putJson(env, loginTokenKey(tokenHash), record);

  const sessionToken = randomToken(32);
  const sessionHash = await sha256Hex(sessionToken);
  const session = {
    email: record.email,
    expires_at: addDays(SESSION_DAYS),
    created_at: nowIso()
  };
  await putJson(env, sessionKey(sessionHash), session);

  return { ok: true, sessionToken, email: record.email, expiresAt: session.expires_at };
}

export async function getSessionFromRequest(env, request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  const sessionToken = match ? decodeURIComponent(match[1]) : null;
  if (!sessionToken) return null;

  const sessionHash = await sha256Hex(sessionToken);
  const session = await getJson(env, sessionKey(sessionHash));
  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await deleteKey(env, sessionKey(sessionHash));
    return null;
  }

  return { ...session, sessionToken, sessionHash };
}

export async function clearSession(env, request) {
  const session = await getSessionFromRequest(env, request);
  if (session?.sessionHash) {
    await deleteKey(env, sessionKey(session.sessionHash));
  }
}

export function sessionCookieHeader(sessionToken, expiresAt, { secure = true } = {}) {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const securePart = secure ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly${securePart}; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookieHeader({ secure = true } = {}) {
  const securePart = secure ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly${securePart}; SameSite=Lax; Max-Age=0`;
}

export {
  PRODUCT_KEY,
  SESSION_COOKIE,
  normalizeEmail,
  isValidEmail
};
