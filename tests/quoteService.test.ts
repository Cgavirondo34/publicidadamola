import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, DEFAULT_SETTINGS } from '../src/lib/db';
import { createQuote, duplicateQuote } from '../src/lib/quoteService';

describe('numeración y duplicado de presupuestos (base local)', () => {
  beforeEach(async () => {
    await db.quotes.clear();
    await db.settings.put({ ...DEFAULT_SETTINGS });
  });

  it('numera correlativo desde 1', async () => {
    const a = await db.quotes.get(await createQuote());
    const b = await db.quotes.get(await createQuote());
    expect([a!.number, b!.number]).toEqual([1, 2]);
  });

  it('respeta el "próximo número" configurado en Empresa', async () => {
    await createQuote();
    await db.settings.put({ ...DEFAULT_SETTINGS, quoteNextNumber: 5001 });
    expect((await db.quotes.get(await createQuote()))!.number).toBe(5001);
    expect((await db.quotes.get(await createQuote()))!.number).toBe(5002);
  });

  it('duplicar crea otro presupuesto con id y número nuevos, en borrador', async () => {
    const orig = (await db.quotes.get(await createQuote({ status: 'aceptado', client: { name: 'Cliente X', cuit: '', ivaCondition: '', phone: '', email: '', address: '' } })))!;
    const copy = (await db.quotes.get(await duplicateQuote(orig)))!;
    expect(copy.id).not.toBe(orig.id);
    expect(copy.number).toBe(orig.number + 1);
    expect(copy.status).toBe('borrador');
    expect(copy.client.name).toBe('Cliente X');
    expect(copy.items[0].id).not.toBe(orig.items[0].id);
    expect(await db.quotes.count()).toBe(2);
  });
});

import { ensureSeed } from '../src/lib/db';
describe('actualización de instalaciones existentes', () => {
  it('completa los campos nuevos (localidad, condiciones) sin pisar lo que el usuario ya cargó', async () => {
    const { city: _c, quotePaymentTerms: _p, address: _a, ...old } = DEFAULT_SETTINGS;
    await db.settings.put({ ...old, contactMessage: 'Mensaje propio', phones: [{ id: 'x', label: 'Pedidos', number: '249-4000000', whatsapp: true }] });
    await ensureSeed();
    const s = (await db.settings.get('company'))!;
    expect(s.city).toBe('Tandil, Buenos Aires');
    expect(s.quotePaymentTerms).toBe(DEFAULT_SETTINGS.quotePaymentTerms);
    expect(s.contactMessage).toBe('Mensaje propio');
    expect(s.phones[0].number).toBe('249-4000000');
  });
});
