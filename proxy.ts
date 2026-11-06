import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { GATE_COOKIE, gateDecision, isValidGateCookie } from '@/lib/gate';

/** Every page and API route needs the team-passcode cookie; see lib/gate.ts for what stays public. */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const unlocked = await isValidGateCookie(request.cookies.get(GATE_COOKIE)?.value, process.env.APP_PASSCODE);
  switch (gateDecision(pathname, unlocked)) {
    case 'redirect':
      return NextResponse.redirect(new URL('/unlock?next=' + encodeURIComponent(pathname + search), request.url));
    case 'deny':
      return NextResponse.json({ error: 'Locked' }, { status: 401 });
    default:
      return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
