export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  const authorization = request.headers.get('authorization');

  if (!authorization || !isValidAuth(authorization)) {
    return new Response('Authentication required to access internal tools.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Internal Tools"',
        'Content-Type': 'text/plain',
      },
    });
  }

  // Authenticated — serve the SPA index.html
  const url = new URL(request.url);
  const indexUrl = new URL('/index.html', url.origin);
  const response = await fetch(indexUrl);

  // Return with original headers but ensure HTML content type
  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function isValidAuth(auth: string): boolean {
  const [scheme, encoded] = auth.split(' ');
  if (scheme !== 'Basic' || !encoded) return false;

  try {
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) return false;

    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);

    return (
      user === process.env.INTERNAL_USER &&
      pass === process.env.INTERNAL_PASSWORD
    );
  } catch {
    return false;
  }
}
