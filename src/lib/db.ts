import Dexie, { type Table } from 'dexie';
import { nanoid } from 'nanoid';
import type { Asset, Brand, CompanySettings, Project } from '../types';
import type { Quote } from './quotes';

/**
 * Persistencia local (IndexedDB). En la Fase 4 esta capa se reemplaza por
 * Supabase manteniendo las mismas funciones públicas de este módulo.
 */
class AmolaDB extends Dexie {
  assets!: Table<Asset, string>;
  brands!: Table<Brand, string>;
  settings!: Table<CompanySettings, string>;
  projects!: Table<Project, string>;
  quotes!: Table<Quote, string>;

  constructor() {
    super('amola-estudio');
    this.version(1).stores({
      assets: 'id, kind, createdAt',
      brands: 'id, name, createdAt',
      settings: 'id',
      projects: 'id, updatedAt, createdAt',
    });
    // v2: presupuestos. Dexie migra solo: los datos existentes se conservan.
    this.version(2).stores({
      quotes: 'id, &number, status, updatedAt, createdAt',
    });
  }
}

export const db = new AmolaDB();

export const newId = () => nanoid(12);

// Líneas de producto iniciales (en el código se llaman "brands": misma estructura, otro significado).
// Los colores son los del Manual de Marca AMOLA (cada línea tiene un color dominante en su etiqueta);
// Arvejas no figura en el manual: su verde se muestreó de la etiqueta real.
// No tienen archivo de logo: se puede cargar un sello por línea desde "Líneas".
export const INITIAL_BRANDS: { name: string; file?: string; colors: string[]; categories?: string[]; info?: string; since?: number }[] = [
  { name: 'Lentejas germinadas', colors: ['#4673bb'], categories: ['Legumbres'], info: 'Paquete 250 g · Legumbres veloces, ¡listas para cocinar!' },
  { name: 'Porotos negros germinados', colors: ['#bc5534'], categories: ['Legumbres'], info: 'Paquete 250 g · Legumbres veloces, ¡listas para cocinar!' },
  { name: 'Arvejas germinadas', colors: ['#5e8f45'], categories: ['Legumbres'], info: 'Paquete 250 g · Legumbres veloces, ¡listas para cocinar!' },
  { name: 'Harinas germinadas', colors: ['#c2a182'], categories: ['Harinas'], info: 'Completar variedades y presentaciones con las fichas técnicas.' },
];
export const BRAND_CATALOG_VERSION = 1;
/** Logo recortado píxel a píxel del packaging real (no redibujado). Reemplazar por el vectorial oficial. */
export const COMPANY_LOGO_FILE = 'amola-logo.png';
export const SAMPLE_PHOTO_FILE = 'amola-legumbres.jpg';

export const DEFAULT_SETTINGS: CompanySettings = {
  id: 'company',
  name: 'AMOLA Germinados',
  activity: 'Legumbres y harinas germinadas · Tandil, Argentina',
  // Sin teléfonos precargados: el manual no los incluye. Se cargan en "Empresa".
  phones: [],
  contactMessage: 'Seguinos en @amola.germinados',
  website: 'https://www.amola.com.ar',
  address: '',
  city: 'Tandil, Buenos Aires',
  mapsUrl: '',
  cuit: '',
  ivaCondition: 'Responsable Inscripto',
  email: '',
  quoteValidDays: 7,
  quotePaymentTerms: 'Transferencia bancaria. Consultar condiciones para comercios.',
  quoteDeliveryTerms: 'Según disponibilidad de stock. Envíos a coordinar.',
  quoteFooter: 'Precios sujetos a modificación sin previo aviso. Presupuesto no válido como factura.',
  // identidad AMOLA: Verde Amola + Mostaza (Manual de Marca)
  primaryColor: '#4e8b3b',
  accentColor: '#e3b84f',
};

async function seedFile(file: string): Promise<File | null> {
  try {
    const res = await fetch(`/seed/${file}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], file, { type: blob.type || (file.endsWith('.png') ? 'image/png' : 'image/jpeg') });
  } catch {
    return null;
  }
}

let seeding: Promise<void> | null = null;
/** Primera ejecución: datos de AMOLA, líneas de producto y logo. Idempotente. */
export function ensureSeed(): Promise<void> {
  if (!seeding) seeding = doSeed();
  return seeding;
}

async function doSeed(): Promise<void> {
  const { saveAsset } = await import('./assets');
  const current = await db.settings.get('company');
  if (!current) {
    const f = await seedFile(COMPANY_LOGO_FILE);
    const logo = f ? await saveAsset(f, 'logo').catch(() => null) : null;
    await db.settings.put({ ...DEFAULT_SETTINGS, logoAssetId: logo?.id });
  } else {
    // instalaciones anteriores: completa solo los campos nuevos que todavía no existen
    const missing = Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).filter(([k]) => (current as unknown as Record<string, unknown>)[k] === undefined),
    );
    if (Object.keys(missing).length) await db.settings.put({ ...current, ...missing });
  }
  const addBrands = async (list: typeof INITIAL_BRANDS) => {
    const now = Date.now();
    for (const [i, b] of list.entries()) {
      const f = b.file ? await seedFile(b.file) : null;
      const logo = f ? await saveAsset(f, 'logo').catch(() => null) : null;
      await db.brands.put({ id: newId(), name: b.name, logoAssetId: logo?.id, colors: b.colors, categories: b.categories ?? [], info: b.info ?? '', createdAt: now + i });
    }
  };
  const settings = (await db.settings.get('company'))!;
  if ((await db.brands.count()) === 0) {
    await addBrands(INITIAL_BRANDS);
  } else {
    // suma solo las líneas de versiones nuevas que no existan (por nombre); no revive líneas borradas de versiones anteriores
    const have = new Set((await db.brands.toArray()).map((b) => b.name.trim().toLowerCase()));
    const done = settings.brandCatalogVersion ?? 1;
    await addBrands(INITIAL_BRANDS.filter((b) => (b.since ?? 1) > done && !have.has(b.name.toLowerCase())));
  }
  if (settings.brandCatalogVersion !== BRAND_CATALOG_VERSION) {
    await db.settings.update('company', { brandCatalogVersion: BRAND_CATALOG_VERSION });
  }
}

export async function getSettings(): Promise<CompanySettings> {
  return (await db.settings.get('company')) ?? DEFAULT_SETTINGS;
}
