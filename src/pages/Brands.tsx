import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { db, newId } from '../lib/db';
import { saveAsset, useAssetUrl } from '../lib/assets';
import { Button, ColorInput, Field, FileButton, Input, Modal, PageHeader, Textarea, toast } from '../components/ui';
import { readableOn } from '../lib/elements';
import type { Brand } from '../types';

export default function Brands() {
  const brands = useLiveQuery(() => db.brands.orderBy('name').toArray(), []);
  const [editing, setEditing] = useState<Brand | null>(null);

  const remove = async (b: Brand) => {
    const used = await db.projects.filter((p) => p.input.brandId === b.id).count();
    const msg = used
      ? `¿Eliminar ${b.name}? Hay ${used} diseño(s) que la usan: se conservan, pero no se podrán regenerar con esta línea.`
      : `¿Eliminar ${b.name}?`;
    if (!confirm(msg)) return;
    await db.brands.delete(b.id);
    toast(`${b.name} eliminada`);
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <PageHeader
        title="Líneas de producto"
        subtitle="Cada línea tiene su color dominante, como en el packaging. El color de la línea tiñe las piezas; el sello es opcional."
        actions={
          <Button variant="primary" onClick={() => setEditing({ id: '', name: '', colors: [], categories: [], info: '', createdAt: Date.now() })}>
            <Plus size={16} /> Nueva línea
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {brands?.map((b) => <BrandCard key={b.id} brand={b} onEdit={() => setEditing(b)} onDelete={() => remove(b)} />)}
      </div>
      {editing && <BrandForm brand={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BrandCard({ brand, onEdit, onDelete }: { brand: Brand; onEdit: () => void; onDelete: () => void }) {
  const url = useAssetUrl(brand.logoAssetId);
  return (
    <div className="card flex flex-col overflow-hidden">
      <button onClick={onEdit} className="relative flex h-28 items-center justify-center overflow-hidden p-4" style={{ background: brand.colors[0] ?? '#4e8b3b' }}>
        <span className="pointer-events-none absolute -right-6 -top-4 h-12 w-32 rotate-[28deg] rounded-full bg-white/20" />
        {url ? (
          <img src={url} alt={brand.name} className="relative max-h-full max-w-full rounded-lg bg-white object-contain p-1" />
        ) : (
          <span className="relative text-center font-serif text-lg leading-tight" style={{ color: readableOn(brand.colors[0] ?? '#4e8b3b') }}>{brand.name}</span>
        )}
      </button>
      <div className="flex items-center gap-2 border-t border-stone-100 p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{brand.name}</div>
          <div className="mt-1 flex gap-1">
            {brand.colors.map((c) => <span key={c} className="h-3 w-3 rounded-full border border-black/10" style={{ background: c }} />)}
            {brand.categories.length > 0 && <span className="truncate text-[11px] text-stone-500">{brand.categories.join(', ')}</span>}
          </div>
        </div>
        <button onClick={onEdit} className="rounded p-1.5 text-stone-500 hover:bg-stone-100" aria-label="Editar"><Pencil size={15} /></button>
        <button onClick={onDelete} className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Eliminar"><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

function BrandForm({ brand, onClose }: { brand: Brand; onClose: () => void }) {
  const [b, setB] = useState<Brand>(brand);
  const [cats, setCats] = useState(brand.categories.join(', '));
  const url = useAssetUrl(b.logoAssetId);

  const save = async () => {
    const name = b.name.trim();
    if (!name) return toast('El nombre es obligatorio', 'error');
    const dup = await db.brands.filter((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== b.id).count();
    if (dup) return toast('Ya existe una línea con ese nombre', 'error');
    const colors = b.colors.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
    await db.brands.put({ ...b, id: b.id || newId(), name, colors, categories: cats.split(',').map((s) => s.trim()).filter(Boolean) });
    toast('Línea guardada');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={brand.id ? `Editar ${brand.name}` : 'Nueva línea'}>
      <div className="space-y-4">
        <Field label="Nombre"><Input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} autoFocus /></Field>
        <Field label="Sello o logo de la línea (opcional)" hint="PNG, SVG o WebP (máx. 5 MB). Se usa tal cual, sin modificarlo. Ej.: sello “Sin gluten” oficial o isotipo de la línea.">
          <div className="flex items-center gap-3">
            <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-stone-200 bg-[repeating-conic-gradient(#f5f5f4_0_25%,#fff_0_50%)] bg-[length:12px_12px] p-2">
              {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-stone-400">sin logo</span>}
            </div>
            <FileButton
              accept="image/png,image/svg+xml,image/webp"
              onFiles={async ([f]) => {
                try {
                  const a = await saveAsset(f, 'logo');
                  setB((x) => ({ ...x, logoAssetId: a.id }));
                } catch (e) {
                  toast((e as Error).message, 'error');
                }
              }}
            >
              <Upload size={15} /> {url ? 'Reemplazar' : 'Subir'}
            </FileButton>
          </div>
        </Field>
        <Field label="Color de la línea" hint="El primero tiñe las piezas (estilos Paisaje y Promo). Usá los colores del manual.">
          <div className="space-y-2">
            {b.colors.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <ColorInput value={c} onChange={(v) => setB({ ...b, colors: b.colors.map((x, j) => (j === i ? v : x)) })} />
                <button onClick={() => setB({ ...b, colors: b.colors.filter((_, j) => j !== i) })} className="rounded p-1 text-stone-500 hover:bg-stone-100" aria-label="Quitar color"><X size={16} /></button>
              </div>
            ))}
            {b.colors.length < 5 && <Button size="sm" onClick={() => setB({ ...b, colors: [...b.colors, '#4e8b3b'] })}><Plus size={14} /> Color</Button>}
          </div>
        </Field>
        <Field label="Categorías" hint="Separadas por coma. Ej.: Legumbres, Harinas">
          <Input value={cats} onChange={(e) => setCats(e.target.value)} />
        </Field>
        <Field label="Presentaciones e información" hint="Se muestra como ayuda al crear una pieza. Solo datos de las fichas técnicas."><Textarea rows={3} value={b.info} onChange={(e) => setB({ ...b, info: e.target.value })} /></Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save}>Guardar</Button>
        </div>
      </div>
    </Modal>
  );
}
