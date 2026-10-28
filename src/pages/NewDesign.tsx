import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Leaf, Loader2, Lock, Plus, ShieldAlert, Sparkles, Star, Trash2, Upload, Wand2 } from 'lucide-react';
import { db, SAMPLE_PHOTO_FILE } from '../lib/db';
import { saveAsset, useAssetUrl } from '../lib/assets';
import { CUSTOM_FORMAT_ID, FORMATS, getFormat, MAX_CUSTOM, MIN_CUSTOM } from '../lib/formats';
import { STYLE_INFO } from '../lib/layout';
import { generateProposal, projectName, saveProposalAsProject, type Proposal } from '../lib/generate';
import { DesignCanvas } from '../components/editor/DesignCanvas';
import { Button, Field, FileButton, Input, Notice, PageHeader, Select, Textarea, toast } from '../components/ui';
import { ALLOWED_CLAIMS, checkClaims, HEADLINE_SUGGESTIONS } from '../lib/claims';
import type { DesignInput, StyleId } from '../types';

/** Presentaciones frecuentes (etiqueta chica arriba del producto). */
const PRESENTATIONS = ['Paquete 250 g', 'Paquete 500 g', 'Bolsa 1 kg', 'Caja para comercios', 'Lanzamiento', 'Receta'];

const EMPTY: DesignInput = {
  photoAssetIds: [],
  brandId: undefined,
  machineType: '',
  model: '',
  headline: '',
  features: [],
  promo: '',
  phoneIds: [],
  highlightPhoneId: undefined,
  showWhatsApp: true,
  whatsappPhoneId: undefined,
  qrUrl: '',
  contactMessage: '',
  includeCompanyLogo: true,
  includeBrandLogo: false,
};

const STYLE_ORDER: StyleId[] = ['campana', 'premium', 'impacto', 'catalogo', 'redes', 'ia'];

export default function NewDesign() {
  const navigate = useNavigate();
  const brands = useLiveQuery(() => db.brands.orderBy('name').toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('company'));
  const [input, setInput] = useState<DesignInput>(EMPTY);
  const [featuresText, setFeaturesText] = useState('');
  const [formatId, setFormatId] = useState('ig-portrait');
  const [custom, setCustom] = useState({ w: 1080, h: 1080 });
  const [styleId, setStyleId] = useState<Exclude<StyleId, 'ia'>>('campana');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState('');

  // al cargar la configuración: mensaje de contacto y teléfono principal por defecto
  useEffect(() => {
    if (!settings) return;
    setInput((i) => {
      const first = settings.phones[0];
      const wa = settings.phones.find((p) => p.whatsapp);
      return {
        ...i,
        contactMessage: i.contactMessage || settings.contactMessage,
        phoneIds: i.phoneIds.length || !first ? i.phoneIds : [first.id],
        highlightPhoneId: i.highlightPhoneId ?? first?.id,
        whatsappPhoneId: i.whatsappPhoneId ?? wa?.id,
      };
    });
  }, [settings]);

  const claimIssues = useMemo(
    () =>
      checkClaims([
        ['Titular', input.headline],
        ['Producto', input.model],
        ['Promoción', input.promo],
        ['Bajada', input.subheadline ?? ''],
        ['Mensaje de contacto', input.contactMessage],
        ...featuresText.split('\n').map((f, i): [string, string] => [`Beneficio ${i + 1}`, f]),
      ]),
    [input.headline, input.model, input.promo, input.subheadline, input.contactMessage, featuresText],
  );
  const addFeature = (f: string) => {
    const list = featuresText.split('\n').map((x) => x.trim()).filter(Boolean);
    if (list.some((x) => x.toLowerCase() === f.toLowerCase())) return;
    setFeaturesText([...list, f].join('\n'));
    setProposals([]);
  };
  const chooseLine = (id: string) => {
    const next = brands?.find((b) => b.id === id);
    // el nombre de la línea completa el producto si estaba vacío o era el de la línea anterior
    const autoName = !input.model.trim() || input.model === brand?.name;
    set({ brandId: id || undefined, ...(autoName ? { model: next?.name ?? '' } : {}) });
  };

  const brand = brands?.find((b) => b.id === input.brandId);
  const fmt = getFormat(formatId, custom.w, custom.h);
  const set = (p: Partial<DesignInput>) => {
    setInput((i) => ({ ...i, ...p }));
    setProposals([]);
  };

  const addPhotos = async (files: File[]) => {
    setUploading(true);
    setError('');
    const ids: string[] = [];
    for (const f of files.slice(0, 8)) {
      try {
        ids.push((await saveAsset(f, 'photo')).id);
      } catch (e) {
        toast(`${f.name}: ${(e as Error).message}`, 'error');
      }
    }
    setUploading(false);
    if (ids.length) set({ photoAssetIds: [...input.photoAssetIds, ...ids] });
  };

  const loadSample = async () => {
    const res = await fetch(`/seed/${SAMPLE_PHOTO_FILE}`);
    const blob = await res.blob();
    await addPhotos([new File([blob], SAMPLE_PHOTO_FILE, { type: 'image/jpeg' })]);
    set({ machineType: 'Paquete 250 g', model: 'Legumbres germinadas', headline: 'Legumbres veloces, ¡listas para cocinar!' });
    setFeaturesText('Libre de gluten\n100% natural, sin aditivos\nMás fácil de digerir');
  };

  const customValid = formatId !== CUSTOM_FORMAT_ID || (custom.w >= MIN_CUSTOM && custom.h >= MIN_CUSTOM && custom.w <= MAX_CUSTOM && custom.h <= MAX_CUSTOM);
  const canGenerate = input.photoAssetIds.length > 0 && (input.model.trim() || input.headline.trim()) && customValid;

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const features = featuresText.split('\n').map((s) => s.trim()).filter(Boolean);
      const finalInput = { ...input, features };
      setInput(finalInput);
      const list = await Promise.all(
        [0, 1, 2].map((v) => generateProposal(finalInput, styleId, v, fmt.id, fmt.width, fmt.height)),
      );
      setProposals(list);
      setTimeout(() => document.getElementById('propuestas')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const choose = async (p: Proposal) => {
    const id = await saveProposalAsProject(p, input, projectName(input, brand?.name));
    navigate(`/editor/${id}`);
  };

  const previewBox = useMemo(() => {
    const max = 320;
    const s = Math.min(max / fmt.width, max / fmt.height);
    return { w: Math.round(fmt.width * s), h: Math.round(fmt.height * s) };
  }, [fmt.width, fmt.height]);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <PageHeader title="Crear publicidad" subtitle="Completá los datos confirmados. El sistema arma tres propuestas con la identidad AMOLA, listas para editar." />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* 1. Fotos */}
          <Section n={1} title="Fotografías del producto">
            <div className="flex flex-wrap gap-2">
              <FileButton accept="image/jpeg,image/png,image/webp" multiple onFiles={addPhotos} variant="primary">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Subir fotos
              </FileButton>
              {input.photoAssetIds.length === 0 && (
                <Button onClick={loadSample}>Probar con la foto de legumbres AMOLA</Button>
              )}
            </div>
            <p className="mt-2 text-xs text-stone-500">JPG, PNG o WebP · hasta 15 MB · mínimo 400 px. La foto se usa tal cual: no se altera el producto. Funcionan bien las fotos sobre fondo blanco y las escenas naturales cálidas.</p>
            {input.photoAssetIds.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {input.photoAssetIds.map((id, i) => (
                  <PhotoCard
                    key={id}
                    assetId={id}
                    main={i === 0}
                    onMain={() => set({ photoAssetIds: [id, ...input.photoAssetIds.filter((x) => x !== id)] })}
                    onRemove={() => set({ photoAssetIds: input.photoAssetIds.filter((x) => x !== id) })}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* 2. Línea y producto */}
          <Section n={2} title="Línea, producto y presentación">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Línea de producto" hint="Define el color de la pieza.">
                <Select value={input.brandId ?? ''} onChange={(e) => chooseLine(e.target.value)}>
                  <option value="">Sin línea (colores AMOLA)</option>
                  {brands?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Producto">
                <Input value={input.model} onChange={(e) => set({ model: e.target.value })} placeholder="Lentejas germinadas" maxLength={60} />
              </Field>
              <Field label="Presentación (opcional)">
                <Input list="presentations" value={input.machineType} onChange={(e) => set({ machineType: e.target.value })} placeholder="Paquete 250 g" maxLength={40} />
                <datalist id="presentations">
                  {PRESENTATIONS.map((t) => <option key={t} value={t} />)}
                </datalist>
              </Field>
            </div>
            {brand && (
              <p className="mt-2 flex items-center gap-2 text-xs text-stone-500">
                {brand.colors.map((c) => <span key={c} className="h-3 w-3 rounded-full border border-black/10" style={{ background: c }} />)}
                {brand.info}
              </p>
            )}
          </Section>

          {/* 3. Mensaje */}
          <Section n={3} title="Mensaje">
            <Field label="Titular" hint="Beneficio simple y humano antes que el proceso técnico.">
              <Input value={input.headline} onChange={(e) => set({ headline: e.target.value })} placeholder="Legumbres veloces, ¡listas para cocinar!" maxLength={80} />
            </Field>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {HEADLINE_SUGGESTIONS.map((h) => (
                <button key={h} onClick={() => set({ headline: h })} className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:border-amola-500 hover:text-amola-800">
                  {h}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Field label="Beneficios" hint="Uno por línea. Solo claims respaldados por el manual o las fichas técnicas.">
                  <Textarea rows={4} value={featuresText} onChange={(e) => { setFeaturesText(e.target.value); setProposals([]); }} placeholder={'Libre de gluten\n100% natural, sin aditivos'} />
                </Field>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ALLOWED_CLAIMS.map((c) => (
                    <button key={c} onClick={() => addFeature(c)} className="flex items-center gap-1 rounded-full bg-amola-50 px-2.5 py-1 text-[11px] font-semibold text-amola-800 hover:bg-amola-100">
                      <Plus size={11} /> {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Field label="Promoción (opcional)" hint={styleId === 'campana' ? 'En Paisaje AMOLA es la 2ª línea del titular.' : undefined}>
                  <Input value={input.promo} onChange={(e) => set({ promo: e.target.value })} placeholder={styleId === 'campana' ? 'Nuevas en tu dietética' : 'Pedí la tuya en tu dietética'} maxLength={60} />
                </Field>
                <Field label="Bajada (opcional)" hint="Frase corta bajo el titular. Se usa en Paisaje AMOLA.">
                  <Input value={input.subheadline ?? ''} onChange={(e) => set({ subheadline: e.target.value })} placeholder="Germinadas durante 7 días, del grano a tu cocina" maxLength={90} />
                </Field>
                <Field label="Mensaje de contacto">
                  <Input value={input.contactMessage} onChange={(e) => set({ contactMessage: e.target.value })} maxLength={70} />
                </Field>
              </div>
            </div>
            {claimIssues.length > 0 && <ClaimsNotice issues={claimIssues} />}
          </Section>

          {/* 4. Contacto */}
          <Section n={4} title="Contacto y logos">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="panel-title block">Teléfonos a mostrar</span>
                {settings && settings.phones.length === 0 && (
                  <Notice tone="info">
                    Todavía no hay teléfonos cargados. <Link to="/configuracion" className="font-semibold underline">Cargalos en Empresa</Link> para mostrarlos en las piezas.
                  </Notice>
                )}
                <div className="space-y-1.5">
                  {settings?.phones.map((p) => {
                    const on = input.phoneIds.includes(p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            set({
                              phoneIds: e.target.checked ? [...input.phoneIds, p.id] : input.phoneIds.filter((x) => x !== p.id),
                              highlightPhoneId: !e.target.checked && input.highlightPhoneId === p.id ? undefined : input.highlightPhoneId,
                            })
                          }
                        />
                        <span className="flex-1"><b>{p.label}</b> {p.number}</span>
                        <label className={`flex items-center gap-1 text-xs ${on ? 'text-stone-700' : 'text-stone-300'}`}>
                          <input type="radio" name="hl" disabled={!on} checked={input.highlightPhoneId === p.id} onChange={() => set({ highlightPhoneId: p.id })} /> destacar
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={input.showWhatsApp} onChange={(e) => set({ showWhatsApp: e.target.checked })} /> Botón visual de WhatsApp
                </label>
                {input.showWhatsApp && settings && !settings.phones.some((p) => p.whatsapp) && (
                  <p className="text-xs text-stone-500">Marcá un teléfono como WhatsApp en Empresa para mostrar el botón.</p>
                )}
                {input.showWhatsApp && settings?.phones.some((p) => p.whatsapp) && (
                  <Select value={input.whatsappPhoneId ?? ''} onChange={(e) => set({ whatsappPhoneId: e.target.value })}>
                    {settings?.phones.filter((p) => p.whatsapp).map((p) => <option key={p.id} value={p.id}>{p.label}: {p.number}</option>)}
                  </Select>
                )}
                <Field label="Código QR (opcional)" hint="Enlace completo: la web, una receta o el catálogo para comercios.">
                  <Input value={input.qrUrl} onChange={(e) => set({ qrUrl: e.target.value })} placeholder="https://" />
                </Field>
                {settings?.website && !input.qrUrl && (
                  <button onClick={() => set({ qrUrl: settings.website })} className="text-xs font-semibold text-amola-700 hover:underline">
                    Usar {settings.website}
                  </button>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={input.includeCompanyLogo} onChange={(e) => set({ includeCompanyLogo: e.target.checked })} /> Logo AMOLA
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={input.includeBrandLogo} onChange={(e) => set({ includeBrandLogo: e.target.checked })} /> Sello de la línea (si tiene archivo cargado)
                </label>
              </div>
            </div>
          </Section>
        </div>

        {/* columna derecha: formato + estilo */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Section n={5} title="Formato">
            <Select value={formatId} onChange={(e) => { setFormatId(e.target.value); setProposals([]); }}>
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label} · {f.width}×{f.height}</option>)}
              <option value={CUSTOM_FORMAT_ID}>Personalizado…</option>
            </Select>
            {formatId === CUSTOM_FORMAT_ID && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="Ancho px"><Input type="number" value={custom.w} onChange={(e) => setCustom({ ...custom, w: Number(e.target.value) })} /></Field>
                <Field label="Alto px"><Input type="number" value={custom.h} onChange={(e) => setCustom({ ...custom, h: Number(e.target.value) })} /></Field>
                {!customValid && <p className="col-span-2 text-xs text-red-600">Entre {MIN_CUSTOM} y {MAX_CUSTOM} px por lado.</p>}
              </div>
            )}
          </Section>

          <Section n={6} title="Estilo">
            <div className="space-y-2">
              {STYLE_ORDER.map((s) => {
                const info = STYLE_INFO[s];
                const disabled = s === 'ia';
                const active = s === styleId;
                return (
                  <button
                    key={s}
                    disabled={disabled}
                    onClick={() => { setStyleId(s as Exclude<StyleId, 'ia'>); setProposals([]); }}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      active ? 'border-amola-600 bg-amola-50 ring-2 ring-amola-600/20' : 'border-stone-200 bg-white hover:border-stone-300'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <div className="flex items-center gap-2 text-sm font-bold">
                      {disabled ? <Lock size={14} /> : active ? <Check size={14} className="text-amola-700" /> : <Sparkles size={14} className="text-stone-400" />}
                      {info.name}
                      {disabled && <span className="ml-auto rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold uppercase">Fase 2</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-stone-600">{info.description}</p>
                  </button>
                );
              })}
            </div>
          </Section>

          <Button variant="gold" size="lg" className="w-full" disabled={!canGenerate || busy} onClick={generate}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />} Generar 3 propuestas
          </Button>
          {!canGenerate && <p className="text-center text-xs text-stone-500">Necesitás al menos una foto y el producto o un titular.</p>}
          {claimIssues.length > 0 && (
            <p className="flex items-center justify-center gap-1 text-center text-xs font-semibold text-amber-700">
              <ShieldAlert size={14} /> {claimIssues.length} texto{claimIssues.length > 1 ? 's' : ''} para revisar antes de publicar
            </p>
          )}
          {error && <Notice tone="error">{error}</Notice>}
        </aside>
      </div>

      {proposals.length > 0 && (
        <section id="propuestas" className="mt-10">
          <h2 className="mb-1 font-display text-xl font-extrabold">Propuestas · {STYLE_INFO[styleId].name}</h2>
          <p className="mb-4 text-sm text-stone-600">Elegí tu favorita para ajustarla en el editor. Todo queda en capas editables.</p>
          <div className="grid gap-5 md:grid-cols-3">
            {proposals.map((p) => (
              <div key={p.variant} className="card flex flex-col overflow-hidden">
                <div className="flex items-center justify-center bg-stone-200 p-4">
                  <DesignCanvas width={p.width} height={p.height} elements={p.elements} fixedSize={previewBox} />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="font-semibold">{STYLE_INFO[styleId].variants[p.variant]}</div>
                  {p.warnings.length > 0 && (
                    <ul className="space-y-1 text-xs text-amber-800">
                      {p.warnings.map((w) => <li key={w}>• {w}</li>)}
                    </ul>
                  )}
                  <Button variant="primary" className="mt-auto" onClick={() => choose(p)}>
                    Usar y editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ClaimsNotice({ issues }: { issues: ReturnType<typeof checkClaims> }) {
  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <div className="mb-1 flex items-center gap-1.5 font-bold">
        <ShieldAlert size={16} /> Revisar antes de publicar
      </div>
      <ul className="space-y-1 text-xs">
        {issues.map((it, i) => (
          <li key={i}>
            <b>{it.field}:</b> “{it.match}” — {it.message}
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-800">
        <Leaf size={12} /> Ante la duda, el manual pide señalar el dato faltante antes de publicar.
      </p>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-extrabold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amola-800 text-xs text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function PhotoCard({ assetId, main, onMain, onRemove }: { assetId: string; main: boolean; onMain: () => void; onRemove: () => void }) {
  const url = useAssetUrl(assetId);
  return (
    <div className={`group relative aspect-square overflow-hidden rounded-xl border-2 ${main ? 'border-mostaza-500' : 'border-transparent'} bg-stone-200`}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      {main && <span className="absolute left-1 top-1 rounded bg-mostaza-500 px-1.5 py-0.5 text-[10px] font-bold text-tierra-900">PRINCIPAL</span>}
      <div className="absolute bottom-1 right-1 flex gap-1">
        {!main && (
          <button onClick={onMain} title="Usar como principal" className="rounded-md bg-white/90 p-1 text-stone-700 hover:bg-white"><Star size={14} /></button>
        )}
        <button onClick={onRemove} title="Quitar" className="rounded-md bg-white/90 p-1 text-red-600 hover:bg-white"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
