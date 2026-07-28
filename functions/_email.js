import { arrayBufferToBase64 } from './_shared.js';
import { PRODUCT_KEY } from './_library.js';

export async function sendEbookEmail(env, email, options = {}) {
  if (!email) {
    return { ok: false, error: 'Missing customer email' };
  }

  if (!env.RESEND_API_KEY) {
    return { ok: false, error: 'Resend is not configured' };
  }

  const obj = await env.BOOK_BUCKET.get(PRODUCT_KEY);
  if (!obj) {
    return { ok: false, error: 'PDF not found in storage' };
  }

  const arrayBuffer = await obj.arrayBuffer();
  const b64 = arrayBufferToBase64(arrayBuffer);
  const origin = options.origin || 'https://hidden-linux.pages.dev';
  const libraryUrl = `${origin}/library.html`;

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Hidden Linux <orders@hiddenlinux.com>',
      to: [email],
      subject: 'Your Hidden Linux ebook',
      html: `
        <p>Thanks for your purchase!</p>
        <p>Your <strong>Hidden Linux</strong> ebook PDF is attached to this email and ready to read.</p>
        <p>
          You also have <strong>lifetime access to this ebook and all future updates</strong>.
          Whenever a new version is released, you can download the latest edition from your personal library
          by signing in with the same email address you used for your purchase.
        </p>
        <p><strong>Access your library:</strong><br />
          <a href="${libraryUrl}">${libraryUrl}</a>
        </p>
        <p>If you have any questions or need assistance accessing your ebook, simply reply to this email and we'll be happy to help.</p>
        <p>Enjoy the ebook!</p>
      `,
      attachments: [
        {
          filename: PRODUCT_KEY,
          content: b64
        }
      ]
    })
  });

  if (!resendResp.ok) {
    const detail = await resendResp.text();
    console.error('Resend API error', detail);
    return { ok: false, error: 'Resend failed', detail };
  }

  return { ok: true };
}

export async function sendMagicLoginEmail(env, email, loginUrl) {
  if (!env.RESEND_API_KEY) {
    return { ok: false, error: 'Resend is not configured' };
  }

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Hidden Linux <orders@hiddenlinux.com>',
      to: [email],
      subject: 'Your Hidden Linux library login link',
      html: `
        <p>Use this secure link to open your Hidden Linux library and download the latest ebook:</p>
        <p><a href="${loginUrl}">${loginUrl}</a></p>
        <p>This link expires in 20 minutes and can only be used once.</p>
        <p>If you did not request this, you can ignore this email.</p>
      `
    })
  });

  if (!resendResp.ok) {
    const detail = await resendResp.text();
    console.error('Resend magic-link error', detail);
    return { ok: false, error: 'Resend failed', detail };
  }

  return { ok: true };
}

export async function getCheckoutSession(env, sessionId) {
  const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
    }
  });

  return resp.json();
}
