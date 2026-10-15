'use client';

export type ToastMsg = { text: string; action?: { label: string; run: () => void } };

export function Toast({ msg, onClose }: { msg: ToastMsg | null; onClose: () => void }) {
  if (!msg) return null;
  return (
    <div role="status" className="no-print fixed bottom-4 right-4 z-50 flex max-w-md items-center gap-3 rounded bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
      <span className="whitespace-pre-line">{msg.text}</span>
      {msg.action && (
        <button type="button" className="rounded bg-sky-500 px-2 py-1" onClick={() => { msg.action!.run(); onClose(); }}>{msg.action.label}</button>
      )}
      <button type="button" aria-label="Dismiss" onClick={onClose}>✕</button>
    </div>
  );
}
