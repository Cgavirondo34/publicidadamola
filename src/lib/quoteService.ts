import { db, getSettings, newId } from './db';
import { loadAssetImage } from './assets';
import { buildQuotePdf, imageToPng, quoteFileName, type PdfImage } from './quotePdf';
import { todayISO, type Quote, type QuoteItem } from './quotes';

export const emptyItem = (): QuoteItem => ({
  id: newId(), description: '', detail: '', quantity: 1, unitPrice: 0, discountPct: 0, ivaRate: 21,
});

/** Correlativo: el mayor entre "último + 1" y el "próximo número" configurado en Empresa. */
async function nextNumber(min: number): Promise<number> {
  const last = await db.quotes.orderBy('number').last();
  return Math.max((last?.number ?? 0) + 1, min);
}

export async function createQuote(base?: Partial<Quote>): Promise<string> {
  const s = await getSettings();
  const now = Date.now();
  const id = newId();
  await db.transaction('rw', db.quotes, async () => {
    const number = await nextNumber(s.quoteNextNumber ?? 1);
    await db.quotes.add({
      status: 'borrador',
      date: todayISO(),
      validDays: s.quoteValidDays ?? 7,
      currency: 'ARS',
      client: { name: '', cuit: '', ivaCondition: 'Responsable Inscripto', phone: '', email: '', address: '' },
      items: [emptyItem()],
      showIva: true,
      paymentTerms: s.quotePaymentTerms ?? '',
      deliveryTerms: s.quoteDeliveryTerms ?? '',
      notes: '',
      seller: '',
      ...base,
      // siempre al final: un duplicado nunca hereda id, número ni fechas del original
      id,
      number,
      createdAt: now,
      updatedAt: now,
    });
  });
  return id;
}

export async function duplicateQuote(q: Quote): Promise<string> {
  const { id: _id, number: _n, createdAt: _c, updatedAt: _u, ...rest } = q;
  return createQuote({ ...rest, status: 'borrador', date: todayISO(), items: q.items.map((i) => ({ ...i, id: newId() })) });
}

async function png(assetId?: string): Promise<PdfImage | undefined> {
  if (!assetId) return undefined;
  try {
    return await imageToPng(await loadAssetImage(assetId));
  } catch {
    return undefined;
  }
}

/** Genera el PDF con el logo de AMOLA y los sellos de las líneas cotizadas (si tienen archivo). */
export async function renderQuotePdf(q: Quote): Promise<{ blob: Blob; fileName: string }> {
  const company = await getSettings();
  const brands = await db.brands.toArray();
  const brandNames = Object.fromEntries(brands.map((b) => [b.id, b.name]));
  const used = [...new Set(q.items.filter((i) => i.description.trim() && i.brandId).map((i) => i.brandId!))];
  const brandLogos = (
    await Promise.all(
      used.map(async (id) => {
        const b = brands.find((x) => x.id === id);
        const img = await png(b?.logoAssetId);
        return img && b ? { ...img, name: b.name } : null;
      }),
    )
  ).filter((x): x is PdfImage & { name: string } => !!x);
  const doc = buildQuotePdf({ quote: q, company, logo: await png(company.logoAssetId), brandLogos, brandNames });
  return { blob: doc.output('blob'), fileName: quoteFileName(q) };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
