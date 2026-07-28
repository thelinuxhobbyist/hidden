# Hidden Linux landing page

## Run locally

```bash
npm install
npm run dev:pages
```

Open the URL Wrangler prints (usually http://localhost:8788).

## My Library (lifetime access)

After purchase, customers can reopen `/library.html`, enter their checkout email, and receive a passwordless login link via Resend. Signed-in buyers download the latest `Hidden_Linux.pdf` from R2 through `/api/ebook`.

- Purchases + sessions are stored in D1 (`hidden-linux-db`).
- The ebook PDF stays in private R2; only authenticated buyers can download it.
- Uploading a newer `Hidden_Linux.pdf` automatically updates every buyer’s library download.
- Instant email attachment on purchase is unchanged.

### Preview vs full ebook

| Key in R2 | Endpoint | Access |
|-----------|----------|--------|
| `Hidden_Linux_preview.pdf` | `/api/preview` | Public sample (pages 6–end; first 5 skipped). Each click shows 3 random consecutive pages. |
| `Hidden_Linux.pdf` | `/api/ebook` | Buyers only (magic-link session required) |

Rebuild and upload the preview sample after updating the full ebook:

```bash
gs -sDEVICE=pdfwrite -dNOPAUSE -dBATCH -dQUIET -dFirstPage=6 \
  -sOutputFile=Hidden_Linux_preview.pdf Hidden_Linux.pdf
npx wrangler r2 object put hiddenlinux/Hidden_Linux_preview.pdf --file=./Hidden_Linux_preview.pdf --remote
```

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
- API: `functions/api/*` (checkout, webhook, library auth, gated ebook)
- R2 binding: `BOOK_BUCKET` → bucket `hiddenlinux` (see `wrangler.toml`)
- D1 binding: `DB` → database `hidden-linux-db` (purchases, magic links, sessions)

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

`https://hiddenlinux.com/api/webhook/stripe`

(You can also use `https://hidden-linux.pages.dev/api/webhook/stripe`; customer-facing links still use `https://hiddenlinux.com`.)

Optional override:

```bash
npx wrangler pages secret put PUBLIC_SITE_URL --project-name=hidden-linux
# value: https://hiddenlinux.com
```

## Local Node server env vars

```bash
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_...
export RESEND_API_KEY=re_...
```

The webhook handler is available at /api/webhook/stripe.
