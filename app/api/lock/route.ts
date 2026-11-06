import { NextResponse } from 'next/server';
import { GATE_COOKIE } from '@/lib/gate';

/** Log out: drops the passcode cookie so the next request lands on /unlock. */
export function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(GATE_COOKIE);
  return res;
}
