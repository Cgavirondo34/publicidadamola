import { BRAND_SWATCHES } from '../lib/brand';
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useEffect } from 'react';
import { X } from 'lucide-react';
import { create } from 'zustand';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-amola-800 text-white hover:bg-amola-700 disabled:bg-amola-800/40',
  gold: 'bg-mostaza-500 text-tierra-900 hover:bg-mostaza-400 disabled:opacity-50',
  secondary: 'bg-white text-tierra-900 border border-stone-300 hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50',
  ghost: 'text-stone-700 hover:bg-stone-100 disabled:opacity-40',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'h-8 px-2.5 text-xs gap-1.5' : size === 'lg' ? 'h-12 px-5 text-base gap-2' : 'h-10 px-4 text-sm gap-2';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:cursor-not-allowed ${s} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-tierra-900 outline-none transition focus:border-amola-500 focus:ring-2 focus:ring-amola-500/20';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="h-9 w-11 cursor-pointer rounded border border-stone-300 bg-white p-0.5" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 font-mono text-xs" />
      <div className="flex w-full flex-wrap gap-1" aria-label="Colores AMOLA">
        {BRAND_SWATCHES.map(([name, c]) => (
          <button
            key={c}
            type="button"
            title={`${name} ${c}`}
            aria-label={name}
            onClick={() => onChange(c)}
            className={`h-5 w-5 rounded-full border ${value.toLowerCase() === c ? 'border-tierra-900 ring-2 ring-amola-500/40' : 'border-black/10'}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

export function Slider({
  label, value, min, max, step = 1, onChange, format,
}: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs font-semibold uppercase tracking-wide text-stone-600">
        {label}
        <span className="font-mono normal-case text-stone-500">{format ? format(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-amola-700" />
    </label>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3">
          <h2 className="font-display text-lg font-bold text-tierra-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode }) {
  const t = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[tone];
  return <div className={`rounded-lg border px-3 py-2 text-sm ${t}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-tierra-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// ── Avisos flotantes ──
interface ToastState {
  items: { id: number; text: string; tone: 'ok' | 'error' | 'info' }[];
  push: (text: string, tone?: 'ok' | 'error' | 'info') => void;
}
export const useToast = create<ToastState>((set, get) => ({
  items: [],
  push: (text, tone = 'ok') => {
    const id = Date.now() + Math.random();
    set({ items: [...get().items, { id, text, tone }] });
    setTimeout(() => set({ items: get().items.filter((i) => i.id !== id) }), 4200);
  },
}));
export const toast = (text: string, tone?: 'ok' | 'error' | 'info') => useToast.getState().push(text, tone);

export function Toasts() {
  const items = useToast((s) => s.items);
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 lg:bottom-6">
      {items.map((i) => (
        <div
          key={i.id}
          className={`pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${
            i.tone === 'error' ? 'bg-red-600 text-white' : i.tone === 'info' ? 'bg-tierra-800 text-white' : 'bg-amola-800 text-white'
          }`}
        >
          {i.text}
        </div>
      ))}
    </div>
  );
}

export function FileButton({
  accept, onFiles, children, multiple, variant = 'secondary', size, className,
}: { accept: string; onFiles: (f: File[]) => void; children: ReactNode; multiple?: boolean; variant?: Variant; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = size === 'sm' ? 'h-8 px-2.5 text-xs gap-1.5' : size === 'lg' ? 'h-12 px-5 text-base gap-2' : 'h-10 px-4 text-sm gap-2';
  return (
    <label className={`inline-flex cursor-pointer items-center justify-center rounded-lg font-semibold transition-colors ${s} ${VARIANTS[variant]} ${className ?? ''}`}>
      {children}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}

export function AssetThumb({ url, className = '', alt = '' }: { url?: string; className?: string; alt?: string }) {
  return url ? (
    <img src={url} alt={alt} className={`object-contain ${className}`} />
  ) : (
    <div className={`flex items-center justify-center bg-stone-100 text-[10px] text-stone-400 ${className}`}>sin imagen</div>
  );
}
