'use client';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { PogsForm } from '@/lib/schema';
import { emptyForm } from '@/lib/defaults';
import { loadDraft, saveDraft, safeStorage } from '@/lib/storage';
import { seedObHistory } from '@/lib/derive';
import { AllSheets } from '@/lib/sheets/Sheet';
import { APP_ASSETS } from '@/lib/sheets/assets';
import { FormEditor } from './form/FormEditor';
import { Preview } from './form/Preview';

export function PogsApp() {
  const { control, register, reset, getValues, setValue } = useForm<PogsForm>({ defaultValues: emptyForm() });
  const form = useWatch({ control }) as PogsForm;
  const [page, setPage] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [autosave, setAutosave] = useState(true);
  const loaded = useRef(false);

  useEffect(() => {
    // Storage exists only on the client; probing it after mount avoids a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!safeStorage()) { setAutosave(false); loaded.current = true; return; }
    const draft = loadDraft();
    if (draft) reset(draft);
    loaded.current = true;
  }, [reset]);

  useEffect(() => {
    if (!loaded.current || !autosave) return;
    const id = setTimeout(() => saveDraft(getValues()), 500);
    return () => clearTimeout(id);
  }, [form, autosave, getValues]);

  const g = form.page1?.obScore?.g ?? '';
  useEffect(() => {
    const rows = getValues('page1.obHistory');
    const seeded = seedObHistory(rows, g);
    if (seeded.length !== rows.length) setValue('page1.obHistory', seeded);
  }, [g, getValues, setValue]);

  return (
    <>
      <div className="no-print flex h-screen flex-col bg-white text-slate-900">
        {!autosave && <div className="bg-amber-100 px-4 py-1 text-xs text-amber-900">Autosave is off (browser storage unavailable). Use Save .json to keep your work.</div>}
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <h1 className="mr-4 font-semibold">POGS Generator</h1>
          {[1, 2, 3, 4, 5, 6].map((p) => (
            <button key={p} type="button" onClick={() => setPage(p)}
              className={`rounded px-3 py-1 text-sm ${p === page ? 'bg-sky-600 text-white' : 'bg-slate-100'}`}>Page {p}</button>
          ))}
          <button type="button" className="ml-auto rounded bg-slate-100 px-3 py-1 text-sm lg:hidden" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? 'Form' : 'Preview'}
          </button>
        </header>
        <main className="grid min-h-0 flex-1 lg:grid-cols-2">
          <div className={`overflow-y-auto p-4 ${showPreview ? 'hidden lg:block' : ''}`}>
            <FormEditor page={page} control={control} register={register} />
          </div>
          <div className={`overflow-y-auto bg-slate-200 p-4 ${showPreview ? '' : 'hidden lg:block'}`}>
            <Preview form={form} page={page} />
          </div>
        </main>
      </div>
      <div className="print-only"><AllSheets form={form} assets={APP_ASSETS} /></div>
    </>
  );
}
