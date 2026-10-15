import fs from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { Sheet } from '@/lib/sheets/Sheet';
import { APP_ASSETS } from '@/lib/sheets/assets';
import { emptyForm, sampleForm } from '@/lib/defaults';
import { coerceForm } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** Dev-only reference fixture (real patient data). The path is assembled at runtime from an env-overridable
 *  value so output file tracing cannot resolve it, and it is never read in a production build. */
function readDevFixture(): unknown | null {
  if (process.env.NODE_ENV === 'production') return null;
  const rel = process.env.POGS_DEV_FIXTURE || ['fixtures', 'reference.json'].join('/');
  const file = path.resolve(process.cwd(), rel);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

export default async function DevSheet({ params, searchParams }: {
  params: Promise<{ page: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { page } = await params;
  const sp = await searchParams;
  const n = Number(page);
  if (!(n >= 1 && n <= 6)) notFound();
  const fixture = sp.sample || sp.empty ? null : readDevFixture();
  const form = sp.sample ? sampleForm() : fixture ? coerceForm(fixture).form : emptyForm();
  return <div style={{ background: '#fff', width: 'fit-content' }}><Sheet page={n} form={form} assets={APP_ASSETS} /></div>;
}
