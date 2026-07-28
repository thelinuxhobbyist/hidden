import { consumeLoginToken, sessionCookieHeader } from '../../_library.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const result = await consumeLoginToken(env, token);

  if (!result.ok) {
    const failUrl = new URL('/library.html', url.origin);
    failUrl.searchParams.set('error', result.error || 'Login failed');
    return Response.redirect(failUrl.toString(), 302);
  }

  const successUrl = new URL('/library.html', url.origin);
  successUrl.searchParams.set('signed_in', '1');

  return new Response(null, {
    status: 302,
    headers: {
      Location: successUrl.toString(),
      'Set-Cookie': sessionCookieHeader(result.sessionToken, result.expiresAt, {
        secure: url.protocol === 'https:'
      })
    }
  });
}
