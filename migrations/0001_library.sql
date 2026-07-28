-- Purchases and auth for Hidden Linux library access

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  stripe_payment_intent TEXT,
  product TEXT NOT NULL DEFAULT 'Hidden_Linux.pdf',
  purchased_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_email_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_purchases_email ON purchases(email);

CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_tokens_email ON login_tokens(email);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);

CREATE TABLE IF NOT EXISTS login_rate_limits (
  email TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL
);
