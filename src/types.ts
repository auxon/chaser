export interface Env {
  DB: D1Database;
  APP_URL: string;
  PRICE_MONTHLY: string;
  TRIAL_DAYS?: string;
  OUR_STRIPE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string; // OURS billing webhook
  THEIR_WEBHOOK_SECRET: string; // collection webhook on THEIR account (one shared endpoint secret per user ideally; MVP single)
  RAK_MASTER_KEY: string; // 32-byte hex
  RESEND_API_KEY: string;
  SESSION_SALT: string;
}
