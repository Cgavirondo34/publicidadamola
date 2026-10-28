import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

describe('datos iniciales de AMOLA', () => {
  it('carga empresa y las 4 líneas con sus colores del manual; no duplica ni revive líneas borradas', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 404 })); // sin archivos en Node
    const { db, INITIAL_BRANDS, ensureSeed } = await import('../src/lib/db');

    await ensureSeed();
    const settings = (await db.settings.get('company'))!;
    expect(settings.name).toBe('AMOLA Germinados');
    expect(settings.primaryColor).toBe('#4e8b3b'); // Verde Amola
    expect(settings.accentColor).toBe('#e3b84f'); // Mostaza
    expect(settings.phones).toEqual([]); // el manual no trae teléfonos: no se inventan
    const lines = await db.brands.toArray();
    expect(lines.map((b) => b.name).sort()).toEqual(INITIAL_BRANDS.map((b) => b.name).sort());
    expect(lines.find((b) => b.name === 'Lentejas germinadas')!.colors).toEqual(['#4673bb']);
    expect(lines.find((b) => b.name === 'Porotos negros germinados')!.colors).toEqual(['#bc5534']);

    // el usuario borra una línea: una nueva carga no la revive ni duplica las demás
    await db.brands.where('name').equals('Harinas germinadas').delete();
    await db.settings.put({ ...settings, brandCatalogVersion: undefined });
    vi.resetModules();
    const again = await import('../src/lib/db');
    await again.ensureSeed();
    const names = (await again.db.brands.toArray()).map((b) => b.name);
    expect(names).not.toContain('Harinas germinadas');
    expect(names.filter((n) => n === 'Lentejas germinadas')).toHaveLength(1);
  });
});
