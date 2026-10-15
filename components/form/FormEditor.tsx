'use client';
import type { Control, UseFormRegister } from 'react-hook-form';
import type { PogsForm } from '@/lib/schema';
import { PAGES } from './config';
import { FieldWidget } from './fields';

export function FormEditor({ page, control, register }: { page: number; control: Control<PogsForm>; register: UseFormRegister<PogsForm> }) {
  return (
    <div className="space-y-6">
      {PAGES[page - 1].sections.map((s) => (
        <section key={s.title}>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">{s.title}</h3>
          <div className="grid grid-cols-2 gap-3">
            {s.fields.map((d) => <FieldWidget key={d.path} def={d} control={control} register={register} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
