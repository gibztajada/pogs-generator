import { NextResponse } from 'next/server';
import { GATE_COOKIE, GATE_MAX_AGE, gateToken, safeEqual } from '@/lib/gate';

const WRONG_CODE_DELAY_MS = 600;

export async function POST(request: Request) {
  const code = process.env.APP_PASSCODE;
  if (!code) return NextResponse.json({ ok: false, error: 'Passcode not configured' }, { status: 503 });

  let passcode: unknown;
  try {
    passcode = (await request.json())?.passcode;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof passcode !== 'string') return NextResponse.json({ ok: false }, { status: 400 });

  if (!safeEqual(passcode, code)) {
    // Slows guessing; never log what was tried.
    await new Promise((r) => setTimeout(r, WRONG_CODE_DELAY_MS));
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, await gateToken(code), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: GATE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
