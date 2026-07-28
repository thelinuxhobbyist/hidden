import { jsonResponse, withCorsHeaders } from '../_shared.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCorsHeaders() });
}

export async function onRequestGet({ env }) {
  let pdfFound = false;
  let previewFound = false;

  try {
    const obj = await env.BOOK_BUCKET?.head('Hidden_Linux.pdf');
    pdfFound = Boolean(obj);
  } catch {
    pdfFound = false;
  }

  try {
    const preview = await env.BOOK_BUCKET?.head('Hidden_Linux_preview.pdf');
    previewFound = Boolean(preview);
  } catch {
    previewFound = false;
  }

  return jsonResponse({
    ok: true,
    stripeConfigured: Boolean(env.STRIPE_SECRET_KEY),
    resendConfigured: Boolean(env.RESEND_API_KEY),
    webhookSecretConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
    pdfFound,
    previewFound,
    libraryEnabled: true
  });
}
