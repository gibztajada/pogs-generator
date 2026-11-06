import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GATE_COOKIE, isValidGateCookie, safeNext } from '@/lib/gate';
import { UnlockGate } from './UnlockGate';

export const metadata: Metadata = { title: 'Unlock · POGS Generator' };

export default async function UnlockPage({ searchParams }: PageProps<'/unlock'>) {
  const raw = (await searchParams).next;
  const next = safeNext(typeof raw === 'string' ? raw : undefined);
  const passcode = process.env.APP_PASSCODE;
  if (passcode && (await isValidGateCookie((await cookies()).get(GATE_COOKIE)?.value, passcode))) redirect(next);
  return <UnlockGate next={next} configured={!!passcode} />;
}
