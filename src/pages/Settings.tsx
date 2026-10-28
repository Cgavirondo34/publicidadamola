import { useEffect, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { db, DEFAULT_SETTINGS, newId } from '../lib/db';
import { saveAsset, useAssetUrl } from '../lib/assets';
import { contrastRatio } from '../lib/elements';
import { IVA_CONDITIONS, normalizeCuit } from '../lib/quotes';
import { Button, ColorInput, Field, FileButton, Input, Notice, PageHeader, Select, Textarea, toast } from '../components/ui';
import type { CompanySettings } from '../types';

const PHONE_RE = /^[0-9+()\-\s]{6,20}$/;

export default function Settings() {
  const [s, setS] = useState<CompanySettings | null>(null);
  const url = useAssetUrl(s?.logoAssetId);

  useEffect(() => {
    db.settings.get('company').then((x) => setS(x ?? DEFAULT_SETTINGS));
  }, []);
  if (!s) return null;

  const badPhones = s.phones.filter((p) => !PHONE_RE.test(p.number.trim()));
  const save = async () => {
    if (!s.name.trim()) return toast('El nombre comercial es obligatorio', 'error');
    if (badPhones.length) return toast('Revisá los teléfonos marcados en rojo', 'error');
    if (s.cuit?.trim() && !normalizeCuit(s.cuit).valid) return toast('El CUIT de la empresa no es válido', 'error');
    await db.settings.put({ ...s, cuit: s.cuit?.trim() ? normalizeCuit(s.cuit).value : '', phones: s.phones.map((p) => ({ ...p, label: p.label.trim(), number: p.number.trim() })) });
    toast('Datos comerciales guardados');
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <PageHeader
        title="Empresa"
        subtitle="Datos de AMOLA que alimentan todas las piezas nuevas. Los teléfonos se imprimen exactamente como los escribas acá."
        actions={<Button variant="primary" onClick={save}>Guardar cambios</Button>}
      />
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <Field label="Nombre comercial"><Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
          <Field label="Actividad"><Input value={s.activity} onChange={(e) => setS({ ...s, activity: e.target.value })} /></Field>
          <Field label="Logo de AMOLA (archivo original)" hint="PNG, SVG o WebP. Nunca se redibuja ni se modifica. El precargado es un recorte del packaging: reemplazalo por el archivo vectorial oficial cuando lo tengas.">
            <div className="flex items-center gap-3">
              <div className="flex h-24 w-44 items-center justify-center rounded-lg border border-stone-200 bg-[repeating-conic-gradient(#f5f5f4_0_25%,#fff_0_50%)] bg-[length:12px_12px] p-2">
                {url ? <img src={url} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-stone-400">sin logo</span>}
              </div>
              <FileButton
                accept="image/png,image/svg+xml,image/webp"
                onFiles={async ([f]) => {
                  try {
                    const a = await saveAsset(f, 'logo');
                    setS((x) => x && { ...x, logoAssetId: a.id });
                  } catch (e) {
                    toast((e as Error).message, 'error');
                  }
                }}
              >
                <Upload size={15} /> {url ? 'Reemplazar' : 'Subir logo'}
              </FileButton>
            </div>
          </Field>
        </section>

        <section className="card space-y-4 p-5">
          <div>
            <h2 className="font-display text-base font-extrabold">Datos para presupuestos</h2>
            <p className="text-xs text-stone-500">Aparecen en el encabezado de cada presupuesto, junto al logo y los teléfonos.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dirección"><Input value={s.address ?? ''} onChange={(e) => setS({ ...s, address: e.target.value })} placeholder="Calle y número" /></Field>
            <Field label="Localidad y provincia"><Input value={s.city ?? ''} onChange={(e) => setS({ ...s, city: e.target.value })} placeholder="Tandil, Buenos Aires" /></Field>
            <Field label="CUIT" hint={s.cuit?.trim() && !normalizeCuit(s.cuit).valid ? <span className="text-red-600">CUIT inválido</span> : undefined}>
              <Input value={s.cuit ?? ''} onChange={(e) => setS({ ...s, cuit: e.target.value })} inputMode="numeric" placeholder="20-12345678-9" />
            </Field>
            <Field label="Condición frente al IVA">
              <Select value={s.ivaCondition ?? 'Responsable Inscripto'} onChange={(e) => setS({ ...s, ivaCondition: e.target.value })}>
                {IVA_CONDITIONS.filter((c) => c !== 'Consumidor Final').map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Email"><Input type="email" value={s.email ?? ''} onChange={(e) => setS({ ...s, email: e.target.value })} /></Field>
            <Field label="Ubicación (link de Google Maps)" hint="En el PDF aparece como “Cómo llegar”, clicable." className="sm:col-span-2">
              <Input value={s.mapsUrl ?? ''} onChange={(e) => setS({ ...s, mapsUrl: e.target.value })} placeholder="https://www.google.com/maps?q=…" />
            </Field>
            <Field label="Próximo número de presupuesto" hint="Si usan la app en varias PCs, dale a cada una un rango distinto (ej.: 1 y 5001) para no repetir números.">
              <Input type="number" min={1} value={s.quoteNextNumber ?? 1} onChange={(e) => setS({ ...s, quoteNextNumber: Math.max(1, Math.floor(Number(e.target.value)) || 1) })} />
            </Field>
            <Field label="Validez por defecto (días)"><Input type="number" min={1} value={s.quoteValidDays ?? 7} onChange={(e) => setS({ ...s, quoteValidDays: Math.max(1, Number(e.target.value) || 1) })} /></Field>
            <Field label="Forma de pago por defecto"><Textarea rows={2} value={s.quotePaymentTerms ?? ''} onChange={(e) => setS({ ...s, quotePaymentTerms: e.target.value })} /></Field>
            <Field label="Plazo de entrega por defecto"><Textarea rows={2} value={s.quoteDeliveryTerms ?? ''} onChange={(e) => setS({ ...s, quoteDeliveryTerms: e.target.value })} /></Field>
            <Field label="Leyenda al pie" className="sm:col-span-2"><Input value={s.quoteFooter ?? ''} onChange={(e) => setS({ ...s, quoteFooter: e.target.value })} /></Field>
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-display text-base font-extrabold">Teléfonos comerciales</h2>
          {s.phones.map((p, i) => {
            const bad = !PHONE_RE.test(p.number.trim());
            const upd = (patch: Partial<typeof p>) => setS({ ...s, phones: s.phones.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={p.id} className="grid grid-cols-[1fr_1.3fr_auto_auto] items-center gap-2">
                <Input value={p.label} onChange={(e) => upd({ label: e.target.value })} placeholder="Pedidos" />
                <Input value={p.number} onChange={(e) => upd({ number: e.target.value })} placeholder="249-4123456" className={bad ? 'border-red-400 ring-2 ring-red-200' : ''} />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={p.whatsapp} onChange={(e) => upd({ whatsapp: e.target.checked })} /> WhatsApp</label>
                <button onClick={() => setS({ ...s, phones: s.phones.filter((_, j) => j !== i) })} className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Quitar"><Trash2 size={15} /></button>
              </div>
            );
          })}
          <Button size="sm" onClick={() => setS({ ...s, phones: [...s.phones, { id: newId(), label: '', number: '', whatsapp: false }] })}>
            <Plus size={14} /> Agregar teléfono
          </Button>
          <Notice tone="info">Los diseños ya creados conservan el número con el que se hicieron. Para actualizarlos, usá “Reemplazar por teléfono comercial” en el editor.</Notice>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-display text-base font-extrabold">Mensajes y colores</h2>
          <Field label="Mensaje de contacto por defecto"><Input value={s.contactMessage} onChange={(e) => setS({ ...s, contactMessage: e.target.value })} /></Field>
          <Field label="Sitio web (para el QR)" hint="Instagram: @amola.germinados (podés sumarlo en el mensaje de contacto)."><Input value={s.website} onChange={(e) => setS({ ...s, website: e.target.value })} placeholder="https://" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Color principal (Verde Amola)"><ColorInput value={s.primaryColor} onChange={(v) => setS({ ...s, primaryColor: v })} /></Field>
            <Field label="Color de acento (Mostaza)"><ColorInput value={s.accentColor} onChange={(v) => setS({ ...s, accentColor: v })} /></Field>
          </div>
          {contrastRatio(s.primaryColor, s.accentColor) < 2.5 && (
            <Notice tone="warn">El principal y el acento contrastan poco entre sí: los titulares de acento pueden leerse mal sobre el fondo principal.</Notice>
          )}
        </section>
      </div>
    </div>
  );
}
