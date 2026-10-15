'use client';
import type { PogsForm } from '@/lib/schema';
import { Sheet } from '@/lib/sheets/Sheet';
import { APP_ASSETS } from '@/lib/sheets/assets';

export function Preview({ form, page }: { form: PogsForm; page: number }) {
  return (
    <div className="mx-auto max-w-[820px] bg-white shadow" data-testid="preview">
      <Sheet page={page} form={form} assets={APP_ASSETS} fluid />
    </div>
  );
}
