'use client';
import { Controller, useFieldArray, type Control, type UseFormRegister } from 'react-hook-form';
import type { PogsForm } from '@/lib/schema';
import type { FieldDef } from './config';
import { emptyLaborRow, emptyMonitoringRow, emptyObRow } from '@/lib/defaults';

type Props = { def: FieldDef; control: Control<PogsForm>; register: UseFormRegister<PogsForm> };
const input = 'w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none';
const ROW_FACTORY: Record<string, () => Record<string, string>> = {
  'page1.obHistory': emptyObRow, 'page4.laborTable': emptyLaborRow, 'page6.monitoring': emptyMonitoringRow,
};

export function FieldWidget({ def, control, register }: Props) {
  // Config paths are checked against emptyForm() by tests/unit/config.test.ts.
  const name = def.path as never;
  switch (def.kind) {
    case 'text':
      return <label className={def.wide ? 'col-span-2' : ''}><span className="text-xs text-slate-600">{def.label}</span><input className={input} {...register(name)} /></label>;
    case 'textarea':
      return <label className="col-span-2"><span className="text-xs text-slate-600">{def.label}</span><textarea className={input} rows={def.rows} {...register(name)} /></label>;
    case 'bool':
      return <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" {...register(name)} />{def.label}</label>;
    case 'single':
    case 'multi':
      return (
        <fieldset className="col-span-2">
          <legend className="text-xs text-slate-600">{def.label}</legend>
          <Controller control={control} name={name} render={({ field }) => {
            const value = field.value as unknown;
            const on = (o: string) => (def.kind === 'multi' ? (value as string[]).includes(o) : value === o);
            const toggle = (o: string) => {
              if (def.kind === 'multi') {
                const cur = value as string[];
                field.onChange(cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]);
              } else field.onChange(value === o ? '' : o);
            };
            return (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {def.options.map((o) => (
                  <label key={o} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={on(o)} onChange={() => toggle(o)} />{o}
                  </label>
                ))}
              </div>
            );
          }} />
        </fieldset>
      );
    case 'table':
      return <TableWidget def={def} control={control} register={register} />;
  }
}

function TableWidget({ def, control, register }: {
  def: Extract<FieldDef, { kind: 'table' }>; control: Control<PogsForm>; register: UseFormRegister<PogsForm>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: def.path as never });
  return (
    <div className="col-span-2 overflow-x-auto">
      <div className="text-xs text-slate-600">{def.label}</div>
      <table className="text-xs">
        <thead><tr>{def.rowLabel && <th />}{def.columns.map((c) => <th key={c.key} className="px-1 text-left font-medium">{c.label}</th>)}<th /></tr></thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={f.id}>
              {def.rowLabel && <td className="pr-1 text-slate-500">{def.rowLabel(i)}</td>}
              {def.columns.map((c) => (
                <td key={c.key}><input aria-label={`${c.label} ${i + 1}`} className="w-24 rounded border border-slate-300 px-1 py-0.5" {...register(`${def.path}.${i}.${c.key}` as never)} /></td>
              ))}
              <td>{!def.fixedRows && <button type="button" className="px-1 text-red-600" onClick={() => remove(i)} aria-label="Remove row">✕</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!def.fixedRows && fields.length < def.maxRows && (
        <button type="button" className="mt-1 text-xs text-sky-700" onClick={() => append(ROW_FACTORY[def.path]() as never)}>+ Add row</button>
      )}
    </div>
  );
}
