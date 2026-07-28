import { withCorsHeaders } from '../../_shared.js';
import { sendEbookEmail } from '../../_email.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCorsHeaders() });
}

export async function onRequestPost({ request, env }) {
  const text = await request.text();
  let event;

  try {
    event = JSON.parse(text);
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: withCorsHeaders() });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email || session.customer_email;
    const result = await sendEbookEmail(env, email);

    if (!result.ok) {
      console.error('Webhook ebook delivery failed:', result);
      return new Response(JSON.stringify(result), {
        status: 500,
        headers: withCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
      });
    }
  }

  return new Response('ok', { status: 200, headers: withCorsHeaders() });
}
