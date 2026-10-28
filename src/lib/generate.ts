import Konva from 'konva';
import { db, getSettings, newId } from './db';
import { getEdgeColor } from './assets';
import { getFormat } from './formats';
import { composeLayout, type AssetRef, type LayoutInput, type Measure } from './layout';
import type { DesignInput, Project, StyleId } from '../types';

export const FONT_FAMILIES = ['Nunito', 'Bree Serif', 'Inter', 'Montserrat'];

let fontsReady: Promise<void> | null = null;
/** Konva dibuja en canvas: las fuentes deben estar cargadas antes de medir o dibujar. */
export function ensureFonts(): Promise<void> {
  if (!fontsReady) {
    const specs = [
      '900 40px Nunito', '800 40px Nunito', '700 40px Nunito', '600 40px Nunito', '400 40px Nunito',
      '400 40px "Bree Serif"', '500 40px Inter', '600 40px Inter', '700 40px Inter',
      '400 40px Montserrat', '700 40px Montserrat', '800 40px Montserrat',
    ];
    fontsReady = Promise.all(specs.map((s) => document.fonts.load(s, 'ÁÉÍÓÚÑáéíóúñ0123456789'))).then(
      () => undefined,
      () => undefined, // sin conexión: se usa la fuente del sistema
    );
  }
  return fontsReady;
}

export const konvaMeasure: Measure = (text, o) => {
  const node = new Konva.Text({
    text,
    fontFamily: o.fontFamily,
    fontStyle: o.fontStyle,
    fontSize: o.fontSize,
    lineHeight: o.lineHeight,
    letterSpacing: o.letterSpacing,
    ...(o.width ? { width: o.width } : {}),
  });
  const r = { width: node.width(), height: node.height() };
  node.destroy();
  return r;
};

async function ref(assetId?: string): Promise<AssetRef | undefined> {
  if (!assetId) return undefined;
  const a = await db.assets.get(assetId);
  return a ? { assetId: a.id, width: a.width, height: a.height } : undefined;
}

/** Foto principal + color de su borde si es parejo (fondo blanco o liso). */
async function photoRef(assetId?: string): Promise<AssetRef | undefined> {
  const r = await ref(assetId);
  if (!r) return r;
  const edge = typeof document !== 'undefined' ? await getEdgeColor(r.assetId) : null;
  return edge ? { ...r, edge } : r;
}

export async function buildLayoutInput(
  input: DesignInput,
  styleId: Exclude<StyleId, 'ia'>,
  variant: number,
  width: number,
  height: number,
  formatId: string,
): Promise<LayoutInput> {
  const settings = await getSettings();
  const brand = input.brandId ? await db.brands.get(input.brandId) : undefined;
  const fmt = getFormat(formatId, width, height);
  const selected = settings.phones.filter((p) => input.phoneIds.includes(p.id));
  const hi = selected.find((p) => p.id === input.highlightPhoneId);
  const phones = hi ? [hi, ...selected.filter((p) => p !== hi)] : selected;
  const wa = settings.phones.find((p) => p.id === input.whatsappPhoneId) ?? selected.find((p) => p.whatsapp);
  return {
    width,
    height,
    safeTop: fmt.safeTop,
    safeBottom: fmt.safeBottom,
    styleId,
    variant,
    photo: await photoRef(input.photoAssetIds[0]),
    companyLogo: await ref(settings.logoAssetId),
    brandLogo: await ref(brand?.logoAssetId),
    companyName: settings.name,
    brandName: brand?.name ?? '',
    brandColor: brand?.colors[0],
    primaryColor: settings.primaryColor,
    accentColor: settings.accentColor,
    machineType: input.machineType,
    model: input.model,
    headline: input.headline,
    features: input.features,
    promo: input.promo,
    subheadline: input.subheadline ?? '',
    contactMessage: input.contactMessage,
    phones: phones.map((p) => ({ label: p.label, number: p.number })),
    highlightFirst: !!hi,
    whatsapp: input.showWhatsApp && wa ? { number: wa.number } : undefined,
    qrUrl: input.qrUrl,
    includeCompanyLogo: input.includeCompanyLogo,
    includeBrandLogo: input.includeBrandLogo,
  };
}

export interface Proposal {
  styleId: Exclude<StyleId, 'ia'>;
  variant: number;
  width: number;
  height: number;
  formatId: string;
  elements: Project['elements'];
  warnings: string[];
}

export async function generateProposal(
  input: DesignInput,
  styleId: Exclude<StyleId, 'ia'>,
  variant: number,
  formatId: string,
  width: number,
  height: number,
): Promise<Proposal> {
  await ensureFonts();
  const li = await buildLayoutInput(input, styleId, variant, width, height, formatId);
  const { elements, warnings } = composeLayout(li, konvaMeasure);
  return { styleId, variant, width, height, formatId, elements, warnings };
}

export function projectName(input: DesignInput, lineName?: string): string {
  const parts = [input.model || lineName, input.machineType].filter(Boolean).join(' · ');
  return parts || 'Diseño sin nombre';
}

export async function saveProposalAsProject(p: Proposal, input: DesignInput, name: string): Promise<string> {
  const now = Date.now();
  const id = newId();
  await db.projects.put({
    id,
    name,
    formatId: p.formatId,
    width: p.width,
    height: p.height,
    styleId: p.styleId,
    variant: p.variant,
    input,
    elements: p.elements,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
