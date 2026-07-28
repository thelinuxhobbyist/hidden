# Hidden Linux landing page

## Run locally

```bash
npm install
node server.js
```

Open http://localhost:3000.

## Admin panel (edit price easily)

Open: `https://hidden-linux.pages.dev/admin.html`

Set email + password once:

```bash
npx wrangler pages secret put ADMIN_EMAIL --project-name=hidden-linux
npx wrangler pages secret put ADMIN_PASSWORD --project-name=hidden-linux
npm run deploy:pages
```

Then change price, currency, and product text. Checkout picks them up automatically.

### Keep normal visitors out

- Nobody can change settings without your email + password (the API rejects them).
- Don’t link to `/admin.html` anywhere on the public site.
- To block the page entirely: Cloudflare Zero Trust → Access → Applications → protect  
  `hidden-linux.pages.dev/admin.html` and `hidden-linux.pages.dev/api/admin/*`,  
  allow only your Google account.

## Cloudflare Pages

Static site + API live together on Pages:

- Static files: `public/`
- API: `functions/api/*` (`/api/ebook`, `/api/checkout`, `/api/webhook/stripe`)
- R2 binding: `BOOK_BUCKET` → bucket `hiddenlinux` (see `wrangler.toml`)

### Deploy

```bash
npm run deploy:pages
# or: npx wrangler pages deploy public --project-name=hidden-linux --branch=main
```

### Secrets (Pages project — separate from Worker secrets)

Worker secrets do **not** apply to Pages. Set these on the Pages project:

```bash
npx wrangler pages secret put STRIPE_SECRET_KEY --project-name=hidden-linux
npx wrangler pages secret put RESEND_API_KEY --project-name=hidden-linux
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name=hidden-linux
```

For preview deployments, also set them with `--env preview`.

Point your Stripe webhook to:

`https://hidden-linux.pages.dev/api/webhook/stripe`

## Local Node server env vars

```bash
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_...
export RESEND_API_KEY=re_...
```

The webhook handler is available at /api/webhook/stripe.
