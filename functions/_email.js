import { arrayBufferToBase64 } from './_shared.js';

export async function sendEbookEmail(env, email) {
  if (!email) {
    return { ok: false, error: 'Missing customer email' };
  }

  if (!env.RESEND_API_KEY) {
    return { ok: false, error: 'Resend is not configured' };
  }

  const obj = await env.BOOK_BUCKET.get('Hidden_Linux.pdf');
  if (!obj) {
    return { ok: false, error: 'PDF not found in storage' };
  }

  const arrayBuffer = await obj.arrayBuffer();
  const b64 = arrayBufferToBase64(arrayBuffer);

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
        <p>Your Hidden Linux ebook PDF is attached to this email.</p>
        <p>If you have any trouble opening it, reply to this email and we’ll help.</p>
      `,
      attachments: [
        {
          filename: 'Hidden_Linux.pdf',
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

export async function getCheckoutSession(env, sessionId) {
  const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
    }
  });

  return resp.json();
}
