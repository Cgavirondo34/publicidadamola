// ─────────────────────────────────────────────────────────────
// Presupuestos: modelo y cálculos. Funciones puras, sin DOM.
// Todos los importes se calculan en CENTAVOS enteros para que los
// totales del PDF coincidan siempre con la suma de las líneas.
// ─────────────────────────────────────────────────────────────

export type Currency = 'ARS' | 'USD';
export type QuoteStatus = 'borrador' | 'enviado' | 'aceptado' | 'rechazado';

/** Alícuotas de IVA disponibles por línea. Confirmar con el contador la que corresponde a cada producto. */
export const IVA_RATES = [10.5, 21, 0] as const;
export type IvaRate = (typeof IVA_RATES)[number];

export interface QuoteItem {
  id: string;
  description: string;
  detail: string; // texto secundario: modelo, características, etc.
  /** línea de producto (en el código: brand) */
  brandId?: string;
  quantity: number;
  unitPrice: number; // en la moneda del presupuesto, SIN IVA
  discountPct: number; // 0..100
  ivaRate: IvaRate;
}

export interface QuoteClient {
  name: string;
  cuit: string;
  ivaCondition: string;
  phone: string;
  email: string;
  address: string;
}

export interface Quote {
  id: string;
  number: number;
  status: QuoteStatus;
  date: string; // YYYY-MM-DD
  validDays: number;
  currency: Currency;
  client: QuoteClient;
  items: QuoteItem[];
  /** true: el PDF discrimina IVA (para Responsables Inscriptos). false: muestra precios finales. */
  showIva: boolean;
  paymentTerms: string;
  deliveryTerms: string;
  notes: string;
  seller: string;
  createdAt: number;
  updatedAt: number;
}

export const STATUS_INFO: Record<QuoteStatus, { label: string; cls: string }> = {
  borrador: { label: 'Borrador', cls: 'bg-stone-200 text-stone-700' },
  enviado: { label: 'Enviado', cls: 'bg-sky-100 text-sky-800' },
  aceptado: { label: 'Aceptado', cls: 'bg-emerald-100 text-emerald-800' },
  rechazado: { label: 'Rechazado', cls: 'bg-red-100 text-red-700' },
};

export const IVA_CONDITIONS = ['Responsable Inscripto', 'Monotributista', 'Exento', 'Consumidor Final'];

// ── Cálculos ────────────────────────────────────────────────
const toCents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : 0));

export interface LineTotals {
  gross: number; // cantidad × precio, centavos
  discount: number; // centavos
  net: number; // centavos, sin IVA
  iva: number; // centavos
  total: number; // centavos, con IVA
}

export function lineTotals(it: QuoteItem): LineTotals {
  const qty = Math.max(0, Number.isFinite(it.quantity) ? it.quantity : 0);
  const gross = Math.round(qty * toCents(it.unitPrice));
  const discount = Math.round((gross * clamp(it.discountPct, 0, 100)) / 100);
  const net = gross - discount;
  const iva = Math.round((net * it.ivaRate) / 100);
  return { gross, discount, net, iva, total: net + iva };
}

export interface QuoteTotals {
  lines: LineTotals[];
  gross: number;
  discount: number;
  net: number;
  ivaByRate: { rate: IvaRate; base: number; iva: number }[];
  iva: number;
  total: number;
}

export function quoteTotals(items: QuoteItem[]): QuoteTotals {
  const lines = items.map(lineTotals);
  const sum = (k: keyof LineTotals) => lines.reduce((a, l) => a + l[k], 0);
  const ivaByRate = IVA_RATES.map((rate) => {
    const ls = lines.filter((_, i) => items[i].ivaRate === rate);
    return { rate, base: ls.reduce((a, l) => a + l.net, 0), iva: ls.reduce((a, l) => a + l.iva, 0) };
  }).filter((r) => r.base !== 0 && r.rate !== 0);
  return { lines, gross: sum('gross'), discount: sum('discount'), net: sum('net'), ivaByRate, iva: sum('iva'), total: sum('total') };
}

// ── Formato ─────────────────────────────────────────────────
export function formatMoney(cents: number, currency: Currency): string {
  const n = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
  return `${currency === 'USD' ? 'US$' : '$'} ${n}`;
}

export function formatQty(q: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(q);
}

export const formatNumber = (n: number) => String(n).padStart(5, '0');

/** "2026-10-15" → "15/10/2026" sin desfasajes de zona horaria. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function todayISO(now = new Date()): string {
  const off = now.getTimezoneOffset();
  return new Date(now.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** Valida y normaliza un CUIT/CUIL argentino (11 dígitos con dígito verificador). */
export function normalizeCuit(raw: string): { value: string; valid: boolean } {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 11) return { value: raw.trim(), valid: raw.trim() === '' };
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const s = w.reduce((a, x, i) => a + x * Number(d[i]), 0);
  let check = 11 - (s % 11);
  if (check === 11) check = 0;
  if (check === 10) check = 9; // caso especial AFIP
  return { value: `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`, valid: check === Number(d[10]) };
}

/** Problemas que impiden emitir el presupuesto (se muestran antes de descargar). */
export function quoteProblems(q: Quote): string[] {
  const p: string[] = [];
  if (!q.client.name.trim()) p.push('Falta el nombre del cliente.');
  const items = q.items.filter((i) => i.description.trim());
  if (!items.length) p.push('Agregá al menos un ítem con descripción.');
  q.items.forEach((it, i) => {
    if (!it.description.trim() && (it.unitPrice || it.quantity !== 1)) p.push(`El ítem ${i + 1} no tiene descripción.`);
    if (it.description.trim() && !(it.quantity > 0)) p.push(`El ítem ${i + 1} tiene cantidad 0.`);
    if (it.unitPrice < 0) p.push(`El ítem ${i + 1} tiene precio negativo.`);
  });
  if (q.client.cuit.trim() && !normalizeCuit(q.client.cuit).valid) p.push('El CUIT del cliente no es válido.');
  return p;
}

/** "45.000.000,50" o "45000000.5" → 45000000.5 */
export function parseAmount(raw: string): number {
  const s = raw.replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma > -1 && lastComma > lastDot) normalized = s.replace(/\./g, '').replace(',', '.');
  else if (lastDot > -1 && (s.match(/\./g) ?? []).length > 1) normalized = s.replace(/\./g, '');
  else if (lastDot > -1 && s.length - lastDot - 1 === 3 && lastComma === -1) normalized = s.replace(/\./g, ''); // "45.000" = 45 mil
  else normalized = s.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** Número argentino → formato internacional de WhatsApp (549 + área + número). null si no es claro. */
export function waNumber(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('549')) d = d.slice(3);
  else if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.length === 10 ? `549${d}` : null;
}
