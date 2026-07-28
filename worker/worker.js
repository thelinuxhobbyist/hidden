import { encode } from 'base64-arraybuffer';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve API endpoints
    if (url.pathname === '/api/ebook') {
      // Stream the PDF from R2 binding `BOOK_BUCKET`
      const obj = await env.BOOK_BUCKET.get('Hidden_Linux.pdf');
      if (!obj) return new Response('PDF not found', { status: 404 });

      const headers = new Headers();
      headers.set('Content-Type', 'application/pdf');
      headers.set('Content-Disposition', 'inline; filename="Hidden_Linux.pdf"');
      return new Response(obj.body, { headers });
    }

    if (url.pathname === '/api/checkout' && request.method === 'POST') {
      // Create a Stripe Checkout Session via Stripe REST API
      const body = await request.json().catch(() => ({}));
      const email = body.email;

      const params = new URLSearchParams();
      params.append('mode', 'payment');
      params.append('success_url', `${url.origin}/?checkout=success`);
      params.append('cancel_url', `${url.origin}/?checkout=cancelled`);
      params.append('line_items[0][price_data][currency]', 'usd');
      params.append('line_items[0][price_data][product_data][name]', 'Hidden Linux Ebook');
      params.append('line_items[0][price_data][product_data][description]', 'Instant PDF delivery via email');
      params.append('line_items[0][price_data][unit_amount]', '1900');
      params.append('line_items[0][quantity]', '1');
      if (email) params.append('customer_email', email);

      const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const data = await resp.json();
      if (data.url) return new Response(JSON.stringify({ url: data.url }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ error: 'Could not create session', detail: data }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/webhook/stripe' && request.method === 'POST') {
      // NOTE: For security, verify Stripe signature using the webhook secret.
      // This example accepts the payload as-is (not recommended for production).
      const text = await request.text();
      let event;
      try {
        event = JSON.parse(text);
      } catch (e) {
        return new Response('Invalid JSON', { status: 400 });
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const email = session.customer_details?.email || session.customer_email;
        if (email && env.RESEND_API_KEY) {
          try {
            // Fetch PDF from R2
            const obj = await env.BOOK_BUCKET.get('Hidden_Linux.pdf');
            if (obj) {
              const arrayBuffer = await obj.arrayBuffer();
              const b64 = encode(arrayBuffer);

              // Send via Resend REST API
              const resendResp = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  from: 'Hidden Linux <onboarding@resend.dev>',
                  to: [email],
                  subject: 'Your Hidden Linux ebook',
                  html: `<p>Thanks for your purchase — your ebook is attached.</p>`,
                  attachments: [
                    {
                      filename: 'Hidden_Linux.pdf',
                      data: b64,
                      type: 'application/pdf'
                    }
                  ]
                })
              });

              if (!resendResp.ok) console.error('Resend API error', await resendResp.text());
            }
          } catch (err) {
            console.error('Delivery error:', err);
          }
        }
      }

      return new Response('ok', { status: 200 });
    }

    // Fall back to fetching static site assets via Worker Sites (if configured)
    // Let Wrangler/Pages handle static routing; otherwise return index.html for SPA
    if (request.method === 'GET') {
      // Try to fetch from the static assets binding (if using kv or site)
      // Otherwise proxy to origin or return a helpful message.
      return fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
