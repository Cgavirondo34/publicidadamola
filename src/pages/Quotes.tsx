import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, ArrowUp, Copy, Download, Eye, FileText, Loader2, Plus, Search, Share2, Trash2,
} from 'lucide-react';
import { db } from '../lib/db';
import {
  formatDate, formatMoney, formatNumber, IVA_CONDITIONS, IVA_RATES, normalizeCuit, parseAmount, quoteProblems,
  quoteTotals, STATUS_INFO, waNumber, type Quote, type QuoteClient, type QuoteItem, type QuoteStatus,
} from '../lib/quotes';
import { createQuote, downloadBlob, duplicateQuote, emptyItem, renderQuotePdf } from '../lib/quoteService';
import { Button, Field, Input, Notice, PageHeader, Select, Textarea, toast } from '../components/ui';

// ───────────────────────── Listado ─────────────────────────
export function QuotesList() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<QuoteStatus | ''>('');
  const quotes = useLiveQuery(() => db.quotes.orderBy('number').reverse().toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('company'));
  const list = (quotes ?? []).filter(
    (x) =>
      (!status || x.status === status) &&
      (`${formatNumber(x.number)} ${x.client.name} ${x.items.map((i) => i.description).join(' ')}`).toLowerCase().includes(q.toLowerCase()),
  );
  const missingCompany = settings && !settings.address?.trim();

  const nuevo = async () => navigate(`/presupuestos/${await createQuote()}`);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <PageHeader
        title="Presupuestos"
        subtitle="Presupuestos con el logo y los datos de la empresa, listos para enviar en PDF."
        actions={<Button variant="primary" onClick={nuevo}><Plus size={16} /> Nuevo presupuesto</Button>}
      />
      {missingCompany && (
        <div className="mb-4">
          <Notice tone="warn">
            Falta la dirección de la empresa para el encabezado. <Link to="/configuracion" className="font-semibold underline">Completala en Empresa</Link>.
          </Notice>
        </div>
      )}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, cliente o producto…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus | '')} className="sm:w-48">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      {quotes && list.length === 0 && (
        <div className="card p-10 text-center">
          <FileText className="mx-auto text-stone-300" size={40} />
          <p className="mt-3 text-sm text-stone-600">{quotes.length ? 'No hay presupuestos con ese filtro.' : 'Todavía no hay presupuestos.'}</p>
          {!quotes.length && <Button variant="primary" className="mt-4" onClick={nuevo}><Plus size={16} /> Crear el primero</Button>}
        </div>
      )}

      {list.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="hidden bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500 sm:table-header-group">
              <tr>
                <th className="px-4 py-2.5">Nº</th>
                <th className="px-4 py-2.5">Cliente</th>
                <th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {list.map((x) => (
                <tr key={x.id} onClick={() => navigate(`/presupuestos/${x.id}`)} className="cursor-pointer hover:bg-stone-50">
                  <td className="px-4 py-3 font-mono font-semibold text-stone-700">{formatNumber(x.number)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{x.client.name || <span className="text-stone-400">Sin cliente</span>}</div>
                    <div className="truncate text-xs text-stone-500 sm:hidden">{formatDate(x.date)} · {STATUS_INFO[x.status].label}</div>
                    <div className="max-w-xs truncate text-xs text-stone-500">{x.items.map((i) => i.description).filter(Boolean).join(', ')}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-stone-600 sm:table-cell">{formatDate(x.date)}</td>
                  <td className="hidden px-4 py-3 sm:table-cell"><StatusBadge s={x.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatMoney(quoteTotals(x.items).total, x.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ s }: { s: QuoteStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_INFO[s].cls}`}>{STATUS_INFO[s].label}</span>;
}

// ───────────────────────── Editor ─────────────────────────
export function QuoteEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState<Quote | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saved, setSaved] = useState(true);
  const [pdfUrl, setPdfUrl] = useState('');
  const [rendering, setRendering] = useState(false);
  const [busy, setBusy] = useState(false);
  const brands = useLiveQuery(() => db.brands.orderBy('name').toArray(), []);
  const pastClients = useLiveQuery(async () => {
    const all = await db.quotes.toArray();
    const map = new Map<string, QuoteClient>();
    all.sort((a, b) => a.updatedAt - b.updatedAt).forEach((x) => x.client.name.trim() && map.set(x.client.name.trim(), x.client));
    return map;
  }, []);
  const first = useRef(true);

  useEffect(() => {
    if (!id) return;
    db.quotes.get(id).then((x) => (x ? setQ(x) : setNotFound(true)));
  }, [id]);

  // guardado automático
  useEffect(() => {
    if (!q) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setSaved(false);
    const t = setTimeout(async () => {
      await db.quotes.put({ ...q, updatedAt: Date.now() });
      setSaved(true);
    }, 600);
    return () => clearTimeout(t);
  }, [q]);

  // vista previa del PDF (pantallas grandes)
  useEffect(() => {
    if (!q || window.innerWidth < 1024) return;
    let alive = true;
    const t = setTimeout(async () => {
      setRendering(true);
      try {
        const { blob } = await renderQuotePdf(q);
        if (!alive) return;
        setPdfUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
      } finally {
        if (alive) setRendering(false);
      }
    }, 700);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const totals = useMemo(() => (q ? quoteTotals(q.items) : null), [q]);
  const problems = useMemo(() => (q ? quoteProblems(q) : []), [q]);

  if (notFound) return <div className="p-8">No se encontró el presupuesto. <Link to="/presupuestos" className="underline">Volver</Link></div>;
  if (!q || !totals) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const set = (patch: Partial<Quote>) => setQ((x) => (x ? { ...x, ...patch } : x));
  const setClient = (patch: Partial<QuoteClient>) => setQ((x) => (x ? { ...x, client: { ...x.client, ...patch } } : x));
  const setItem = (itemId: string, patch: Partial<QuoteItem>) =>
    setQ((x) => (x ? { ...x, items: x.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } : x));
  const moveItem = (idx: number, dir: -1 | 1) =>
    setQ((x) => {
      if (!x) return x;
      const items = [...x.items];
      const j = idx + dir;
      if (j < 0 || j >= items.length) return x;
      [items[idx], items[j]] = [items[j], items[idx]];
      return { ...x, items };
    });
  const money = (c: number) => formatMoney(c, q.currency);

  const getPdf = async () => {
    if (problems.length) {
      toast(problems[0], 'error');
      return null;
    }
    await db.quotes.put({ ...q, updatedAt: Date.now() });
    return renderQuotePdf(q);
  };

  const download = async () => {
    setBusy(true);
    try {
      const r = await getPdf();
      if (!r) return;
      downloadBlob(r.blob, r.fileName);
      if (q.status === 'borrador') set({ status: 'enviado' });
      toast('PDF descargado');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const r = await getPdf();
      if (!r) return;
      const file = new File([r.blob], r.fileName, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: r.fileName, text: `Presupuesto ${formatNumber(q.number)}` }).catch(() => undefined);
        if (q.status === 'borrador') set({ status: 'enviado' });
      } else {
        // computadora: se descarga el PDF y se abre WhatsApp Web con el número del cliente
        downloadBlob(r.blob, r.fileName);
        const phone = waNumber(q.client.phone);
        const msg = encodeURIComponent(`Hola ${q.client.name}, te envío el presupuesto Nº ${formatNumber(q.number)} por ${money(totals.total)}. Adjunto el PDF.`);
        window.open(phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
        toast('Se descargó el PDF: adjuntalo en el chat de WhatsApp', 'info');
      }
    } finally {
      setBusy(false);
    }
  };

  const openPdf = async () => {
    const r = await renderQuotePdf(q);
    window.open(URL.createObjectURL(r.blob), '_blank');
  };

  const remove = async () => {
    if (!confirm(`¿Eliminar el presupuesto Nº ${formatNumber(q.number)}? No se puede deshacer.`)) return;
    await db.quotes.delete(q.id);
    navigate('/presupuestos');
  };

  const dup = async () => navigate(`/presupuestos/${await duplicateQuote(q)}`);

  const cuitState = normalizeCuit(q.client.cuit);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-3 py-2 sm:px-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/presupuestos')} aria-label="Volver"><ArrowLeft size={16} /></Button>
        <div className="mr-2">
          <div className="font-display text-lg font-extrabold leading-tight">Presupuesto Nº {formatNumber(q.number)}</div>
          <div className="text-xs text-stone-500">{saved ? 'Guardado' : 'Guardando…'}</div>
        </div>
        <div className="w-36">
          <Select value={q.status} onChange={(e) => set({ status: e.target.value as QuoteStatus })} className="h-8 py-1 text-xs" aria-label="Estado">
            {Object.entries(STATUS_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={dup} title="Duplicar"><Copy size={15} /><span className="hidden sm:inline">Duplicar</span></Button>
          <Button size="sm" variant="ghost" onClick={remove} title="Eliminar"><Trash2 size={15} /></Button>
          <Button size="sm" className="lg:hidden" onClick={openPdf}><Eye size={15} /> Ver</Button>
          <Button size="sm" onClick={share} disabled={busy}><Share2 size={15} /> WhatsApp</Button>
          <Button size="sm" variant="gold" onClick={download} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} PDF
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-4 pb-24 sm:p-6 lg:pb-6">
          <div className="mx-auto max-w-3xl space-y-5">
            {/* Datos generales */}
            <section className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              <Field label="Fecha"><Input type="date" value={q.date} onChange={(e) => e.target.value && set({ date: e.target.value })} /></Field>
              <Field label="Validez (días)"><Input type="number" min={1} max={365} value={q.validDays} onChange={(e) => set({ validDays: Math.max(1, Number(e.target.value) || 1) })} /></Field>
              <Field label="Moneda">
                <Select value={q.currency} onChange={(e) => set({ currency: e.target.value as Quote['currency'] })}>
                  <option value="ARS">Pesos ($)</option>
                  <option value="USD">Dólares (US$)</option>
                </Select>
              </Field>
              <Field label="Precios">
                <Select value={q.showIva ? 'iva' : 'final'} onChange={(e) => set({ showIva: e.target.value === 'iva' })}>
                  <option value="iva">Discriminar IVA</option>
                  <option value="final">IVA incluido</option>
                </Select>
              </Field>
            </section>

            {/* Cliente */}
            <section className="card space-y-3 p-4">
              <h2 className="font-display font-extrabold">Cliente</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre o razón social">
                  <Input
                    list="clientes"
                    value={q.client.name}
                    onChange={(e) => {
                      const prev = pastClients?.get(e.target.value.trim());
                      setClient(prev && !q.client.cuit && !q.client.phone ? { ...prev } : { name: e.target.value });
                    }}
                    placeholder="Dietética …"
                  />
                  <datalist id="clientes">{[...(pastClients?.keys() ?? [])].map((n) => <option key={n} value={n} />)}</datalist>
                </Field>
                <Field label="CUIT" hint={!cuitState.valid ? <span className="text-red-600">CUIT inválido</span> : undefined}>
                  <Input value={q.client.cuit} onChange={(e) => setClient({ cuit: e.target.value })} onBlur={() => cuitState.valid && q.client.cuit && setClient({ cuit: cuitState.value })} placeholder="30-12345678-9" inputMode="numeric" />
                </Field>
                <Field label="Condición frente al IVA">
                  <Select value={q.client.ivaCondition} onChange={(e) => setClient({ ivaCondition: e.target.value })}>
                    {IVA_CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Teléfono"><Input value={q.client.phone} onChange={(e) => setClient({ phone: e.target.value })} inputMode="tel" placeholder="249-4123456" /></Field>
                <Field label="Domicilio"><Input value={q.client.address} onChange={(e) => setClient({ address: e.target.value })} /></Field>
                <Field label="Email"><Input type="email" value={q.client.email} onChange={(e) => setClient({ email: e.target.value })} /></Field>
              </div>
            </section>

            {/* Ítems */}
            <section className="card space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-extrabold">Ítems</h2>
                <span className="text-xs text-stone-500">Precios {q.showIva ? 'netos, sin IVA' : 'sin IVA (el PDF los muestra con IVA incluido)'}</span>
              </div>
              {q.items.map((it, idx) => {
                const lt = totals.lines[idx];
                return (
                  <div key={it.id} className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amola-800 text-xs font-bold text-white">{idx + 1}</span>
                      <Input value={it.description} onChange={(e) => setItem(it.id, { description: e.target.value })} placeholder="Descripción (ej.: Lentejas germinadas 250 g · caja x 12)" className="font-semibold" aria-label={`Descripción ítem ${idx + 1}`} />
                      <div className="flex shrink-0">
                        <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="rounded p-1.5 text-stone-500 hover:bg-white disabled:opacity-30" aria-label="Subir"><ArrowUp size={15} /></button>
                        <button onClick={() => moveItem(idx, 1)} disabled={idx === q.items.length - 1} className="rounded p-1.5 text-stone-500 hover:bg-white disabled:opacity-30" aria-label="Bajar"><ArrowDown size={15} /></button>
                        <button onClick={() => set({ items: q.items.length > 1 ? q.items.filter((x) => x.id !== it.id) : [emptyItem()] })} className="rounded p-1.5 text-red-600 hover:bg-white" aria-label="Quitar ítem"><Trash2 size={15} /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                      <div className="col-span-2 sm:col-span-4">
                        <Input value={it.detail} onChange={(e) => setItem(it.id, { detail: e.target.value })} placeholder="Detalle (opcional): presentación, unidades por caja, vencimiento…" className="text-xs" />
                      </div>
                      <div className="col-span-2">
                        <Select value={it.brandId ?? ''} onChange={(e) => setItem(it.id, { brandId: e.target.value || undefined })} className="text-xs" aria-label="Línea">
                          <option value="">Sin línea</option>
                          {brands?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </Select>
                      </div>
                      <Field label="Cantidad"><Input type="number" min={0} step="any" value={it.quantity} onChange={(e) => setItem(it.id, { quantity: Number(e.target.value) })} /></Field>
                      <Field label="Precio unitario" className="col-span-1 sm:col-span-2"><MoneyInput value={it.unitPrice} onChange={(v) => setItem(it.id, { unitPrice: v })} /></Field>
                      <Field label="Bonif. %" className="sm:col-span-1"><Input type="number" min={0} max={100} step="any" value={it.discountPct} onChange={(e) => setItem(it.id, { discountPct: Number(e.target.value) })} /></Field>
                      <Field label="IVA">
                        <Select value={it.ivaRate} onChange={(e) => setItem(it.id, { ivaRate: Number(e.target.value) as QuoteItem['ivaRate'] })}>
                          {IVA_RATES.map((r) => <option key={r} value={r}>{String(r).replace('.', ',')} %</option>)}
                        </Select>
                      </Field>
                      <div className="col-span-2 flex items-baseline justify-end gap-2 border-t border-stone-200 pt-2 sm:col-span-6">
                        <span className="text-[11px] font-semibold uppercase text-stone-500">Subtotal{q.showIva ? ' neto' : ''}</span>
                        <span className="font-semibold">{money(q.showIva ? lt.net : lt.total)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <Button size="sm" onClick={() => set({ items: [...q.items, emptyItem()] })}><Plus size={14} /> Agregar ítem</Button>

              <div className="ml-auto max-w-xs space-y-1 border-t border-stone-200 pt-3 text-sm">
                {q.showIva && (
                  <>
                    {totals.discount > 0 && <Row k="Bonificaciones" v={`- ${money(totals.discount)}`} />}
                    <Row k="Neto" v={money(totals.net)} />
                    {totals.ivaByRate.map((r) => <Row key={r.rate} k={`IVA ${String(r.rate).replace('.', ',')} %`} v={money(r.iva)} />)}
                  </>
                )}
                <div className="flex justify-between rounded-lg bg-amola-100 px-3 py-2 font-display text-lg font-black text-amola-900">
                  <span>Total</span>
                  <span>{money(totals.total)}</span>
                </div>
              </div>
            </section>

            {/* Condiciones */}
            <section className="card grid gap-3 p-4 sm:grid-cols-2">
              <h2 className="font-display font-extrabold sm:col-span-2">Condiciones</h2>
              <Field label="Forma de pago"><Textarea rows={2} value={q.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} /></Field>
              <Field label="Plazo de entrega"><Textarea rows={2} value={q.deliveryTerms} onChange={(e) => set({ deliveryTerms: e.target.value })} /></Field>
              <Field label="Observaciones" className="sm:col-span-2"><Textarea rows={3} value={q.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
              <Field label="Atendido por"><Input value={q.seller} onChange={(e) => set({ seller: e.target.value })} placeholder="Nombre del vendedor" /></Field>
            </section>

            {problems.length > 0 && (
              <Notice tone="warn">
                <b>Para emitir el PDF falta:</b>
                <ul className="mt-1 list-inside list-disc">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
              </Notice>
            )}
          </div>
        </div>

        {/* Vista previa */}
        <aside className="hidden w-[46%] max-w-[720px] flex-col border-l border-stone-200 bg-stone-300 lg:flex">
          <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold text-stone-700">
            Vista previa del PDF {rendering && <Loader2 size={14} className="animate-spin" />}
          </div>
          {pdfUrl ? (
            <iframe title="Vista previa del presupuesto" src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} className="min-h-0 flex-1 bg-white" />
          ) : (
            <div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin text-stone-500" /></div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-stone-600">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

/** Acepta "45.000.000,50" (formato argentino) y lo muestra formateado al salir del campo. */
function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const fmt = (n: number) => (n ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n) : '');
  const [raw, setRaw] = useState(fmt(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setRaw(fmt(value));
  }, [value, focus]);
  return (
    <Input
      inputMode="decimal"
      value={raw}
      placeholder="0"
      onFocus={() => setFocus(true)}
      onBlur={() => {
        setFocus(false);
        setRaw(fmt(value));
      }}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(parseAmount(e.target.value));
      }}
      className="text-right"
    />
  );
}
