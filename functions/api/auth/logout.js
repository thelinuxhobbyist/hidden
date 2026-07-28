import { withCorsHeaders } from '../../_shared.js';
import { clearSession, clearSessionCookieHeader } from '../../_library.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCorsHeaders() });
}

export async function onRequestPost({ request, env }) {
  await clearSession(env, request);
  const secure = new URL(request.url).protocol === 'https:';
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: withCorsHeaders(new Headers({
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookieHeader({ secure })
    }))
  });
}
