import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildQuotePdf, type PdfImage } from '../src/lib/quotePdf';
import { DEFAULT_SETTINGS } from '../src/lib/db';
import type { Quote } from '../src/lib/quotes';

function png(path: string): PdfImage {
  const buf = readFileSync(path);
  return { data: `data:image/png;base64,${buf.toString('base64')}`, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// 10 × 4.500.000 − 5 % = 42.750.000 + IVA 10,5 % (4.488.750) + 2 × 350.000 + IVA 21 % (147.000)
const TOTAL = '$ 48.085.750,00';

const company = {
  ...DEFAULT_SETTINGS,
  address: 'Av. Ejemplo 1234',
  city: 'Localidad, Santa Fe',
  cuit: '20172543597',
  email: 'pedidos@ejemplo.com',
  mapsUrl: 'https://www.google.com/maps?q=-37.3217,-59.1332',
  phones: [
    { id: 'p', label: 'Pedidos', number: '249-4123456', whatsapp: true },
    { id: 'm', label: 'Mayoristas', number: '249-4654321', whatsapp: false },
    { id: 'a', label: 'Atención', number: '249-4000000', whatsapp: false },
  ],
};

export const sampleQuote = (over: Partial<Quote> = {}): Quote => ({
  id: 'q1', number: 12, status: 'borrador', date: '2026-10-15', validDays: 7, currency: 'ARS',
  client: { name: 'Dietética Los Álamos S.R.L.', cuit: '30-50001091-2', ivaCondition: 'Responsable Inscripto', phone: '249-4555555', email: '', address: 'Av. España 1234, Tandil' },
  items: [
    { id: 'a', description: 'Lentejas germinadas 250 g', detail: 'Caja x 12', brandId: 'lentejas', quantity: 10, unitPrice: 4_500_000, discountPct: 5, ivaRate: 10.5 },
    { id: 'b', description: 'Exhibidor de mostrador', detail: '', quantity: 2, unitPrice: 350_000, discountPct: 0, ivaRate: 21 },
  ],
  showIva: true, paymentTerms: 'Transferencia', deliveryTerms: 'Inmediata', notes: '', seller: 'Sofi',
  createdAt: 0, updatedAt: 0, ...over,
});

describe('PDF del presupuesto', () => {
  const build = (q: Quote, compress = false) =>
    buildQuotePdf({
      quote: q, company, compress,
      logo: png('public/seed/amola-logo.png'),
      brandLogos: [{ ...png('public/seed/amola-logo.png'), name: 'Lentejas germinadas' }],
      brandNames: { lentejas: 'Lentejas germinadas' },
    });

  it('incluye datos de la empresa, cliente, teléfonos exactos y total', () => {
    const raw = build(sampleQuote()).output();
    for (const s of ['Av. Ejemplo 1234', 'CUIT 20-17254359-7', '249-4123456', '249-4654321', '249-4000000', 'PRESUPUESTO', '00012', 'S.R.L.', 'Lentejas germinadas 250 g', 'IVA 10,5 %', 'IVA 21 %'])
      expect(raw, s).toContain(s);
    expect(raw).toContain(TOTAL);
    expect(raw).toContain('https://www.google.com/maps?q=-37.3217,-59.1332');
    expect(raw).toContain('/Subtype /Link');
  });

  it('modo precios finales: no discrimina IVA y el total no cambia', () => {
    const raw = build(sampleQuote({ showIva: false })).output();
    expect(raw).not.toContain('IVA 10,5 %');
    expect(raw).toContain(TOTAL);
    expect(raw).toContain('IVA incluido');
  });

  it('muchos ítems: pagina y numera las páginas', () => {
    const many = sampleQuote({ items: Array.from({ length: 45 }, (_, i) => ({ id: String(i), description: `Producto ${i + 1}`, detail: 'Caja x 12', quantity: 1, unitPrice: 1000, discountPct: 0, ivaRate: 21 as const })) });
    const doc = build(many);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(doc.output()).toContain(`Página ${doc.getNumberOfPages()} de ${doc.getNumberOfPages()}`);
  });

  it('genera archivos de muestra para revisión visual', () => {
    if (!process.env.PDF_OUT) return;
    writeFileSync(`${process.env.PDF_OUT}/presupuesto.pdf`, Buffer.from(build(sampleQuote(), true).output('arraybuffer')));
  });
});
