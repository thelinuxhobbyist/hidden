Cloudflare Worker + R2 deployment notes

1) Install Wrangler (Cloudflare CLI) and login:

```bash
npm install -g wrangler
wrangler login
```

2) Create a R2 bucket named `hidden-linux-ebooks` (or pick a name) and upload `Hidden_Linux.pdf`:

```bash
wrangler r2 bucket create hidden-linux-ebooks
wrangler r2 object put Hidden_Linux.pdf --bucket hidden-linux-ebooks
```

3) Configure secrets for your Worker (set your real keys):

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
```

4) Deploy the Worker (this template expects static assets handled by Pages or a separate hosting step):

```bash
wrangler publish
```

Notes:
- This Worker streams the PDF from the `BOOK_BUCKET` R2 binding at `/api/ebook`.
- The `/api/checkout` route calls Stripe REST API to create a Checkout Session. It requires `STRIPE_SECRET_KEY` set.
- The webhook at `/api/webhook/stripe` receives Stripe events and uses Resend to attach and send the PDF (requires `RESEND_API_KEY`).
- For production security: enable signature verification for Stripe webhooks using `STRIPE_WEBHOOK_SECRET` and verify the `Stripe-Signature` header.

If you want, I can:
- move the static site into Cloudflare Pages and connect the Worker as a Functions/Worker route for `/api/*` endpoints, or
- convert this Worker into a Pages Functions-compatible script and help deploy both static site and APIs together.
