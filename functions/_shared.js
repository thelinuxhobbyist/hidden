export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

export function withCorsHeaders(headers = new Headers()) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return headers;
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: withCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
  });
}

/** Canonical customer-facing site URL (custom domain), not the Pages *.pages.dev host. */
export function getPublicSiteUrl(env, request) {
  const configured = String(env?.PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;

  try {
    const origin = new URL(request.url).origin;
    if (origin && !origin.includes('.pages.dev')) {
      return origin;
    }
  } catch {
    // ignore invalid request URL
  }

  return 'https://hiddenlinux.com';
}
