import type { PogsForm } from '@/lib/schema';
import { buildView } from '@/lib/derive';
import { TemplatePage } from './TemplatePage';
import { LaborChart } from './LaborChart';
import { PAGE_NUMBERS, TEMPLATES } from './templates';
import type { SheetAssets } from './template';

export function Sheet({ page, form, assets, fluid }: { page: number; form: PogsForm; assets: SheetAssets; fluid?: boolean }) {
  const t = TEMPLATES[page];
  return (
    <TemplatePage template={t} view={buildView(form)} assets={assets} fluid={fluid}>
      {t.chart ? <LaborChart chart={t.chart} table={form.page4.laborTable} /> : null}
    </TemplatePage>
  );
}

export function AllSheets({ form, assets }: { form: PogsForm; assets: SheetAssets }) {
  return <>{PAGE_NUMBERS.map((p) => <Sheet key={p} page={p} form={form} assets={assets} />)}</>;
}
