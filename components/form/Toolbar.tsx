'use client';
import { useRef, useState } from 'react';
import type { PogsForm } from '@/lib/schema';
import { emptyForm, sampleForm } from '@/lib/defaults';
import { parseFormFile, serializeForm } from '@/lib/storage';
import type { ToastMsg } from '../Toast';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fileBase = (f: PogsForm) => (f.patient.lastName.trim() || 'patient').replace(/[^\w .-]/g, '_');
const btn = 'rounded bg-slate-100 px-3 py-1 text-sm hover:bg-slate-200 disabled:opacity-50';

export function Toolbar({ getValues, reset, notify, onDownload }: {
  getValues: () => PogsForm; reset: (f: PogsForm) => void; notify: (m: ToastMsg) => void; onDownload: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function load(file: File) {
    try {
      const { form, skipped } = parseFormFile(await file.text());
      reset(form);
      notify({ text: skipped.length ? `Loaded with ${skipped.length} skipped field(s):\n${skipped.slice(0, 8).join(', ')}` : 'Loaded.' });
    } catch (e) {
      notify({ text: (e as Error).message });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="rounded bg-sky-600 px-3 py-1 text-sm text-white disabled:opacity-50" disabled={busy}
        onClick={async () => { setBusy(true); try { await onDownload(); } finally { setBusy(false); } }}>
        {busy ? 'Generating…' : 'Download PDF'}
      </button>
      <button type="button" className={btn} onClick={() => window.print()}>Print</button>
      <button type="button" className={btn}
        onClick={() => downloadBlob(new Blob([serializeForm(getValues())], { type: 'application/json' }), `${fileBase(getValues())} POGS.json`)}>
        Save .json
      </button>
      <button type="button" className={btn} onClick={() => fileRef.current?.click()}>Load .json</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="load-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ''; }} />
      <button type="button" className={btn} onClick={() => { if (confirm('Clear all fields for a new patient?')) reset(emptyForm()); }}>New patient</button>
      <button type="button" className={btn} onClick={() => { if (confirm('Replace all fields with the sample patient?')) reset(sampleForm()); }}>Load sample</button>
    </div>
  );
}
