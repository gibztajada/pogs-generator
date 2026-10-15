import fs from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { Sheet } from '@/lib/sheets/Sheet';
import { APP_ASSETS } from '@/lib/sheets/assets';
import { emptyForm, sampleForm } from '@/lib/defaults';
import { coerceForm } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default async function DevSheet({ params, searchParams }: {
  params: Promise<{ page: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { page } = await params;
  const sp = await searchParams;
  const n = Number(page);
  if (!(n >= 1 && n <= 6)) notFound();
  const file = path.join(process.cwd(), 'fixtures', 'sostino.json');
  const form = sp.sample ? sampleForm()
    : sp.empty || !fs.existsSync(file) ? emptyForm()
    : coerceForm(JSON.parse(fs.readFileSync(file, 'utf8'))).form;
  return <div style={{ background: '#fff', width: 'fit-content' }}><Sheet page={n} form={form} assets={APP_ASSETS} /></div>;
}
