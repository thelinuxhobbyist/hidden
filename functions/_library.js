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

function requireDb(env) {
  if (!env.DB) {
    throw new Error('D1 database binding DB is not configured');
  }
  return env.DB;
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

export async function recordPurchase(env, {
  email,
  stripeSessionId,
  stripeCustomerId = null,
  stripePaymentIntent = null,
  product = PRODUCT_KEY
}) {
  const db = requireDb(env);
  const normalized = normalizeEmail(email);
  if (!normalized || !stripeSessionId) {
    return { ok: false, error: 'Missing email or stripe session id' };
  }

  const existingBySession = await db
    .prepare('SELECT * FROM purchases WHERE stripe_session_id = ?')
    .bind(stripeSessionId)
    .first();

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

  await db
    .prepare(`
      INSERT INTO purchases (
        id, email, stripe_session_id, stripe_customer_id, stripe_payment_intent,
        product, purchased_at, created_at, last_email_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      purchase.id,
      purchase.email,
      purchase.stripe_session_id,
      purchase.stripe_customer_id,
      purchase.stripe_payment_intent,
      purchase.product,
      purchase.purchased_at,
      purchase.created_at,
      purchase.last_email_at
    )
    .run();

  return { ok: true, purchase, created: true };
}

export async function shouldSendPurchaseEmail(_env, purchase) {
  if (!purchase) return false;
  if (!purchase.last_email_at) return true;
  const last = new Date(purchase.last_email_at).getTime();
  return !Number.isFinite(last) || Date.now() - last > 10 * 60 * 1000;
}

export async function markPurchaseEmailSent(env, purchase) {
  if (!purchase?.stripe_session_id) return;
  const db = requireDb(env);
  const lastEmailAt = nowIso();
  await db
    .prepare('UPDATE purchases SET last_email_at = ? WHERE stripe_session_id = ?')
    .bind(lastEmailAt, purchase.stripe_session_id)
    .run();
  return { ...purchase, last_email_at: lastEmailAt };
}

export async function hasPurchase(env, email) {
  const purchase = await getPurchaseByEmail(env, email);
  return Boolean(purchase?.email);
}

export async function getPurchaseByEmail(env, email) {
  const db = requireDb(env);
  return db
    .prepare('SELECT * FROM purchases WHERE email = ? ORDER BY purchased_at DESC LIMIT 1')
    .bind(normalizeEmail(email))
    .first();
}

async function allowLoginRequest(env, email) {
  const db = requireDb(env);
  const normalized = normalizeEmail(email);
  const hourMs = 60 * 60 * 1000;
  const now = Date.now();
  const current = await db
    .prepare('SELECT count, window_started_at FROM login_rate_limits WHERE email = ?')
    .bind(normalized)
    .first();

  let count = current?.count || 0;
  let windowStartedAt = current?.window_started_at || now;

  if (now - windowStartedAt > hourMs) {
    count = 0;
    windowStartedAt = now;
  }

  if (count >= MAX_LOGIN_REQUESTS_PER_HOUR) {
    return false;
  }

  await db
    .prepare(`
      INSERT INTO login_rate_limits (email, count, window_started_at)
      VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        count = excluded.count,
        window_started_at = excluded.window_started_at
    `)
    .bind(normalized, count + 1, windowStartedAt)
    .run();

  return true;
}

export async function createLoginToken(env, email) {
  const db = requireDb(env);
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { ok: false, error: 'Invalid email' };
  }

  if (!(await allowLoginRequest(env, normalized))) {
    return { ok: false, error: 'Too many login requests. Try again later.' };
  }

  const purchased = await hasPurchase(env, normalized);
  if (!purchased) {
    return { ok: true, sent: false };
  }

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = addMinutes(LOGIN_TOKEN_MINUTES);
  const createdAt = nowIso();

  await db
    .prepare(`
      INSERT INTO login_tokens (token_hash, email, expires_at, created_at, used_at)
      VALUES (?, ?, ?, ?, NULL)
    `)
    .bind(tokenHash, normalized, expiresAt, createdAt)
    .run();

  return { ok: true, sent: true, token, email: normalized, expiresAt };
}

export async function consumeLoginToken(env, token) {
  const db = requireDb(env);
  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'Missing token' };
  }

  const tokenHash = await sha256Hex(token);
  const record = await db
    .prepare('SELECT * FROM login_tokens WHERE token_hash = ?')
    .bind(tokenHash)
    .first();

  if (!record) {
    return { ok: false, error: 'Invalid or expired link' };
  }

  if (record.used_at) {
    return { ok: false, error: 'This login link was already used' };
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    await db.prepare('DELETE FROM login_tokens WHERE token_hash = ?').bind(tokenHash).run();
    return { ok: false, error: 'This login link has expired' };
  }

  await db
    .prepare('UPDATE login_tokens SET used_at = ? WHERE token_hash = ?')
    .bind(nowIso(), tokenHash)
    .run();

  const sessionToken = randomToken(32);
  const sessionHash = await sha256Hex(sessionToken);
  const expiresAt = addDays(SESSION_DAYS);
  const createdAt = nowIso();

  await db
    .prepare(`
      INSERT INTO sessions (token_hash, email, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `)
    .bind(sessionHash, record.email, expiresAt, createdAt)
    .run();

  return { ok: true, sessionToken, email: record.email, expiresAt };
}

export async function getSessionFromRequest(env, request) {
  const db = requireDb(env);
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  const sessionToken = match ? decodeURIComponent(match[1]) : null;
  if (!sessionToken) return null;

  const sessionHash = await sha256Hex(sessionToken);
  const session = await db
    .prepare('SELECT * FROM sessions WHERE token_hash = ?')
    .bind(sessionHash)
    .first();

  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(sessionHash).run();
    return null;
  }

  return { ...session, sessionToken, sessionHash };
}

export async function clearSession(env, request) {
  const session = await getSessionFromRequest(env, request);
  if (session?.sessionHash) {
    await requireDb(env)
      .prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(session.sessionHash)
      .run();
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
