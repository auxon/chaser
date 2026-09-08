-- Chaser schema (D1 / SQLite). Every state change is an event row.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  business_name TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'friendly',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Our billing: one row per user, mirrored from Stripe webhooks.
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  status TEXT NOT NULL, -- trialing | active | past_due | canceled
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Customer's Stripe account for THEIR collection links (RAK, encrypted).
CREATE TABLE IF NOT EXISTS stripe_accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  rak_enc TEXT NOT NULL,
  account_name TEXT NOT NULL DEFAULT '',
  validated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debtors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  debtor_id TEXT NOT NULL REFERENCES debtors(id),
  number TEXT NOT NULL,
  amount_pence INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  due_date TEXT NOT NULL,
  photo_r2_key TEXT, -- phase 1: stored, not parsed
  status TEXT NOT NULL DEFAULT 'chasing', -- chasing | paused | paid | paid_cash
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sequence_runs (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  step INTEGER NOT NULL DEFAULT 0, -- next step index to send
  halted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (invoice_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES sequence_runs(id),
  step INTEGER NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  checkout_session_id TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  stripe_session_id TEXT NOT NULL UNIQUE,
  amount_pence INTEGER NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
