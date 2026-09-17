export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND = 'https://br-lucky-haze-b5pb8wxa-looposapi.compute.c-7.us-east-2.aws.neon.tech';

async function proxy(request, { params }) {
  const segments = (await params).path || [];
  const target = `${BACKEND}/${segments.map(encodeURIComponent).join('/')}`;
  const headers = new Headers();
  headers.set('content-type', request.headers.get('content-type') || 'application/json');
  const session = request.headers.get('x-loopos-session');
  if (session) headers.set('x-loopos-session', session);

  const init = {
    method: request.method,
    headers,
    cache: 'no-store',
    redirect: 'follow',
  };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.text();

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.arrayBuffer();
    const response = new Response(body, { status: upstream.status });
    response.headers.set('content-type', upstream.headers.get('content-type') || 'application/json');
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch (error) {
    console.error('Neon Function proxy failed', { name: error?.name || null, message: error?.message || null });
    return Response.json({ detail: 'Backend unavailable', error_code: 'BACKEND_UNAVAILABLE' }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
