import { jsonResponse, withCorsHeaders } from '../../_shared.js';
import { createLoginToken, isValidEmail, normalizeEmail } from '../../_library.js';
import { sendMagicLoginEmail } from '../../_email.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCorsHeaders() });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);

  if (!isValidEmail(email)) {
    return jsonResponse({ error: 'Enter a valid email address' }, 400);
  }

  if (!env.RESEND_API_KEY) {
    return jsonResponse({ error: 'Email delivery is not configured' }, 500);
  }

  const result = await createLoginToken(env, email);
  if (!result.ok) {
    return jsonResponse({ error: result.error || 'Could not start login' }, 429);
  }

  if (result.sent) {
    const origin = new URL(request.url).origin;
    const loginUrl = `${origin}/api/auth/verify?token=${encodeURIComponent(result.token)}`;
    const emailResult = await sendMagicLoginEmail(env, result.email, loginUrl);
    if (!emailResult.ok) {
      return jsonResponse({ error: 'Could not send login email' }, 500);
    }
  }

  return jsonResponse({
    ok: true,
    message: 'If that email has a purchase, we sent a login link. Check your inbox and spam folder.'
  });
}
