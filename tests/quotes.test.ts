import { describe, expect, it } from 'vitest';
import {
  addDays, parseAmount, waNumber, formatDate, formatMoney, formatNumber, lineTotals, normalizeCuit, quoteProblems, quoteTotals,
  type Quote, type QuoteItem,
} from '../src/lib/quotes';

const item = (p: Partial<QuoteItem>): QuoteItem => ({
  id: Math.random().toString(36), description: 'Ítem', detail: '', quantity: 1, unitPrice: 0, discountPct: 0, ivaRate: 21, ...p,
});

describe('cálculo de presupuestos', () => {
  it('línea con descuento e IVA 10,5 %', () => {
    const l = lineTotals(item({ quantity: 1, unitPrice: 45_000_000, discountPct: 5, ivaRate: 10.5 }));
    expect(l.gross).toBe(4_500_000_000);
    expect(l.discount).toBe(225_000_000);
    expect(l.net).toBe(4_275_000_000);
    expect(l.iva).toBe(448_875_000);
    expect(l.total).toBe(4_723_875_000);
  });

  it('IVA mixto: 10,5 % + 21 %, separado por alícuota', () => {
    const t = quoteTotals([
      item({ unitPrice: 1000, ivaRate: 10.5 }),
      item({ quantity: 3, unitPrice: 50, ivaRate: 21 }),
      item({ unitPrice: 200, ivaRate: 0 }),
    ]);
    expect(t.net).toBe(135_000);
    expect(t.ivaByRate).toEqual([
      { rate: 10.5, base: 100_000, iva: 10_500 },
      { rate: 21, base: 15_000, iva: 3_150 },
    ]);
    expect(t.iva).toBe(13_650);
    expect(t.total).toBe(148_650);
  });

  it('el total es exactamente la suma de las líneas (sin errores de coma flotante)', () => {
    const items = Array.from({ length: 7 }, (_, i) => item({ quantity: i + 1, unitPrice: 0.1 * (i + 1) + 0.07, discountPct: 3.3, ivaRate: 21 }));
    const t = quoteTotals(items);
    expect(t.total).toBe(t.lines.reduce((a, l) => a + l.total, 0));
    expect(Number.isInteger(t.total)).toBe(true);
  });

  it('valores inválidos no rompen el cálculo', () => {
    const l = lineTotals(item({ quantity: NaN, unitPrice: NaN, discountPct: 150 }));
    expect(l.total).toBe(0);
    expect(lineTotals(item({ unitPrice: 100, discountPct: 150 })).net).toBe(0);
  });

  it('formatos argentinos', () => {
    expect(formatMoney(4_723_875_000, 'ARS')).toBe('$ 47.238.750,00');
    expect(formatMoney(123_456, 'USD')).toBe('US$ 1.234,56');
    expect(formatNumber(7)).toBe('00007');
    expect(formatDate('2026-10-15')).toBe('15/10/2026');
    expect(addDays('2026-10-28', 7)).toBe('2026-11-04');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('CUIT: valida dígito verificador y da formato', () => {
    expect(normalizeCuit('20-17254359-7')).toEqual({ value: '20-17254359-7', valid: true });
    expect(normalizeCuit('20172543597')).toEqual({ value: '20-17254359-7', valid: true });
    expect(normalizeCuit('20-17254359-8').valid).toBe(false);
    expect(normalizeCuit('123').valid).toBe(false);
    expect(normalizeCuit('').valid).toBe(true);
  });

  it('detecta presupuestos incompletos antes de emitirlos', () => {
    const q = { client: { name: '', cuit: '1', ivaCondition: '', phone: '', email: '', address: '' }, items: [item({ description: '', unitPrice: 5 })] } as unknown as Quote;
    const p = quoteProblems(q);
    expect(p).toContain('Falta el nombre del cliente.');
    expect(p).toContain('Agregá al menos un ítem con descripción.');
    expect(p).toContain('El CUIT del cliente no es válido.');
  });
});

describe('ingreso de importes en formato argentino', () => {
  it.each([
    ['45.000.000', 45_000_000], ['45.000.000,50', 45_000_000.5], ['45000000.5', 45_000_000.5], ['350.000', 350_000],
    ['1.234,5', 1234.5], ['12,75', 12.75], ['$ 1.000', 1000], ['', 0], ['abc', 0], ['0,99', 0.99],
  ])('%s → %d', (raw, n) => expect(parseAmount(raw as string)).toBeCloseTo(n as number, 6));
});

describe('WhatsApp', () => {
  it.each([
    ['3482-555555', '5493482555555'], ['03482 555555', '5493482555555'], ['+54 9 3482 555555', '5493482555555'],
    ['+54 3482 555555', '5493482555555'], ['555555', null], ['', null],
  ])('%s → %s', (raw, out) => expect(waNumber(raw as string)).toBe(out));
});
