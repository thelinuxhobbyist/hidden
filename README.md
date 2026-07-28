# Hidden Linux landing page

## Run locally

```bash
npm install
node server.js
```

Open http://localhost:3000.

## Environment variables for Stripe + Resend

Set these before running the server in production:

```bash
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_...
export RESEND_API_KEY=re_...
```

The webhook handler is available at /api/webhook/stripe.
