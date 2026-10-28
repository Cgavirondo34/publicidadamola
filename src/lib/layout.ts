// ─────────────────────────────────────────────────────────────
// Motor de composición publicitaria.
// Recibe datos confirmados por el usuario y devuelve CAPAS editables.
// No inventa textos técnicos: solo usa lo que el usuario escribió.
// Función pura: la medición de texto se inyecta (Konva en el navegador,
// una aproximación en los tests).
// ─────────────────────────────────────────────────────────────
import type { DesignElement, Fit, ImageEl, StyleId, TextEl } from '../types';
import { AMOLA } from './brand';
import { contrastRatio, luminance, makeButton, makeImage, makeQr, makeRect, makeText, readableOn, rgba } from './elements';

export interface MeasureOpts {
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  /** si se indica, el texto hace salto de línea en ese ancho */
  width?: number;
}
export type Measure = (text: string, o: MeasureOpts) => { width: number; height: number };

export interface AssetRef {
  assetId: string;
  width: number;
  height: number;
  /** color parejo del borde de la foto (p. ej. fondo blanco de estudio), si lo tiene */
  edge?: string;
}

export interface LayoutInput {
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
  styleId: Exclude<StyleId, 'ia'>;
  variant: number;
  photo?: AssetRef;
  companyLogo?: AssetRef;
  brandLogo?: AssetRef;
  companyName: string;
  brandName: string;
  brandColor?: string;
  primaryColor: string;
  accentColor: string;
  machineType: string;
  model: string;
  headline: string;
  features: string[];
  promo: string;
  subheadline?: string;
  contactMessage: string;
  /** teléfonos elegidos; el destacado va primero */
  phones: { label: string; number: string }[];
  highlightFirst: boolean;
  whatsapp?: { number: string };
  qrUrl: string;
  includeCompanyLogo: boolean;
  includeBrandLogo: boolean;
}

export interface LayoutResult {
  elements: DesignElement[];
  warnings: string[];
  /** zonas reservadas (para tests de no-superposición) */
  zones: Record<string, Rect>;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Recetas de estilo ────────────────────────────────────────
type Font = [family: string, style: string];

interface Recipe {
  name: string;
  bg: string;
  photoZone: 'top' | 'bottom';
  photoFrac: number;
  photoBleed: boolean;
  photoFit: 'auto' | 'contain';
  photoFrame?: { fill: string; radiusK: number; padK: number };
  fade: boolean;
  topShade: boolean;
  align: 'left' | 'center';
  colors: { brandline: string; model: string; headline: string; body: string };
  fonts: { brandline: Font; model: Font; headline: Font; body: Font };
  upperModel: boolean;
  headlineFirst: boolean;
  sizes: { brandline: number; model: number; headline: number; body: number };
  featuresMax: number;
  /** 'icons' = fila de sellos de beneficio con hoja */
  featuresStyle: 'list' | 'icons';
  promo: { fill: string; text: string };
  logoChips: boolean;
  /** formas orgánicas suaves de fondo (estilo de las etiquetas AMOLA) */
  blobs?: string[];
  footer: {
    fill: string;
    text: string;
    highlight: string;
    bleed: boolean;
    heightK: number;
  };
}

interface Palette {
  primary: string;
  accent: string;
  brand: string;
}

export { AMOLA };

const NUN_900: Font = ['Nunito', '900'];
const NUN_800: Font = ['Nunito', '800'];
const NUN_700: Font = ['Nunito', '700'];
const BREE: Font = ['Bree Serif', 'normal'];
const INTER_500: Font = ['Inter', '500'];

export const STYLE_INFO: Record<StyleId, { name: string; description: string; variants: string[] }> = {
  campana: {
    name: 'Paisaje AMOLA',
    description: 'Como las etiquetas: fondo de color con formas orgánicas, producto protagonista y titular en dos tipografías.',
    variants: ['Color de la línea', 'Crema natural', 'Mostaza'],
  },
  premium: {
    name: 'Natural cálido',
    description: 'Fotografía protagonista en escenas cálidas, composición tranquila y cercana.',
    variants: ['Verde Amola', 'Arena', 'Editorial claro'],
  },
  impacto: {
    name: 'Promo',
    description: 'Titular grande, color de la línea y sellos de beneficio. Ideal para promociones y lanzamientos.',
    variants: ['Color de la línea', 'Blanco y fresco', 'Terracota y mostaza'],
  },
  catalogo: {
    name: 'Catálogo / E-commerce',
    description: 'Producto completo sobre fondo claro, nombre, presentación y beneficios.',
    variants: ['Ficha crema', 'Ficha blanca', 'Ficha centrada'],
  },
  redes: {
    name: 'Redes sociales',
    description: 'Foto + beneficio simple + llamado claro. Textos breves y contacto visible.',
    variants: ['Llamado directo', 'Foto protagonista', 'Mostaza'],
  },
  ia: {
    name: 'IA Creativa',
    description: 'La IA analiza la foto y propone tres diseños distintos. Disponible en la Fase 2.',
    variants: [],
  },
};

function recipes(p: Palette): Record<Exclude<StyleId, 'ia' | 'campana'>, Recipe[]> {
  const onBrand = readableOn(p.brand);
  const onAccent = readableOn(p.accent);
  const onPrimary = readableOn(p.primary);
  const deep = shade(p.primary, 0.62);
  const A = AMOLA;
  return {
    premium: [
      {
        name: 'Verde Amola', bg: deep, photoZone: 'top', photoFrac: 0.6, photoBleed: true, photoFit: 'auto',
        fade: true, topShade: true, align: 'left',
        colors: { brandline: p.accent, model: '#ffffff', headline: A.crema, body: '#e3eadc' },
        fonts: { brandline: NUN_800, model: BREE, headline: NUN_800, body: INTER_500 },
        upperModel: false, headlineFirst: false,
        sizes: { brandline: 0.032, model: 0.08, headline: 0.046, body: 0.032 },
        featuresMax: 4, featuresStyle: 'list', promo: { fill: p.accent, text: onAccent }, logoChips: true,
        footer: { fill: 'rgba(255,255,255,0.10)', text: '#ffffff', highlight: p.accent, bleed: false, heightK: 0.17 },
      },
      {
        name: 'Arena', bg: A.crema, photoZone: 'bottom', photoFrac: 0.56, photoBleed: true, photoFit: 'auto',
        fade: true, topShade: false, align: 'center',
        colors: { brandline: A.naranja, model: p.primary, headline: A.tinta, body: '#4d4034' },
        fonts: { brandline: NUN_800, model: BREE, headline: NUN_800, body: INTER_500 },
        upperModel: false, headlineFirst: false,
        sizes: { brandline: 0.032, model: 0.08, headline: 0.044, body: 0.031 },
        featuresMax: 3, featuresStyle: 'list', promo: { fill: p.primary, text: onPrimary }, logoChips: false,
        blobs: [A.mostaza, p.brand],
        footer: { fill: p.primary, text: onPrimary, highlight: p.accent, bleed: true, heightK: 0.16 },
      },
      {
        name: 'Editorial claro', bg: '#fbf8f2', photoZone: 'top', photoFrac: 0.58, photoBleed: false, photoFit: 'auto',
        photoFrame: { fill: '#efe6d8', radiusK: 0.03, padK: 0 },
        fade: false, topShade: false, align: 'left',
        colors: { brandline: p.primary, model: A.tinta, headline: '#4d4034', body: '#4d4034' },
        fonts: { brandline: NUN_800, model: BREE, headline: NUN_700, body: INTER_500 },
        upperModel: false, headlineFirst: false,
        sizes: { brandline: 0.032, model: 0.076, headline: 0.042, body: 0.031 },
        featuresMax: 4, featuresStyle: 'list', promo: { fill: p.primary, text: onPrimary }, logoChips: false,
        footer: { fill: p.primary, text: onPrimary, highlight: p.accent, bleed: false, heightK: 0.16 },
      },
    ],
    impacto: [
      {
        name: 'Color de la línea', bg: p.brand, photoZone: 'bottom', photoFrac: 0.6, photoBleed: false, photoFit: 'auto',
        photoFrame: { fill: '#ffffff', radiusK: 0.03, padK: 0.012 },
        fade: false, topShade: false, align: 'center',
        colors: { brandline: onBrand, model: onBrand, headline: onBrand, body: onBrand },
        fonts: { brandline: NUN_800, model: BREE, headline: NUN_900, body: NUN_700 },
        upperModel: false, headlineFirst: true,
        sizes: { brandline: 0.034, model: 0.06, headline: 0.095, body: 0.032 },
        featuresMax: 4, featuresStyle: 'icons', promo: { fill: p.accent, text: onAccent }, logoChips: true,
        blobs: [mix(p.brand, '#ffffff', 0.45), shade(p.brand, 0.8)],
        footer: { fill: p.accent, text: onAccent, highlight: onAccent, bleed: true, heightK: 0.17 },
      },
      {
        name: 'Blanco y fresco', bg: '#ffffff', photoZone: 'top', photoFrac: 0.55, photoBleed: true, photoFit: 'auto',
        fade: false, topShade: true, align: 'left',
        colors: { brandline: contrastRatio(p.brand, '#ffffff') >= 3 ? p.brand : p.primary, model: A.tinta, headline: p.primary, body: '#3b3027' },
        fonts: { brandline: NUN_800, model: BREE, headline: NUN_900, body: NUN_700 },
        upperModel: false, headlineFirst: false,
        sizes: { brandline: 0.034, model: 0.08, headline: 0.06, body: 0.032 },
        featuresMax: 4, featuresStyle: 'icons', promo: { fill: p.accent, text: onAccent }, logoChips: true,
        footer: { fill: p.primary, text: onPrimary, highlight: p.accent, bleed: true, heightK: 0.17 },
      },
      {
        name: 'Terracota y mostaza', bg: A.terracota, photoZone: 'bottom', photoFrac: 0.52, photoBleed: true, photoFit: 'auto',
        fade: true, topShade: false, align: 'center',
        colors: { brandline: '#ffffff', model: '#ffffff', headline: A.mostaza, body: '#f6efe4' },
        fonts: { brandline: NUN_800, model: BREE, headline: NUN_900, body: NUN_700 },
        upperModel: false, headlineFirst: true,
        sizes: { brandline: 0.034, model: 0.062, headline: 0.095, body: 0.032 },
        featuresMax: 4, featuresStyle: 'icons', promo: { fill: A.mostaza, text: readableOn(A.mostaza) }, logoChips: true,
        footer: { fill: A.mostaza, text: readableOn(A.mostaza), highlight: readableOn(A.mostaza), bleed: true, heightK: 0.17 },
      },
    ],
    catalogo: [
      {
        name: 'Ficha crema', bg: A.crema, photoZone: 'top', photoFrac: 0.58, photoBleed: false, photoFit: 'contain',
        photoFrame: { fill: '#ffffff', radiusK: 0.03, padK: 0.025 },
        fade: false, topShade: false, align: 'left',
        colors: { brandline: p.primary, model: A.tinta, headline: '#5c4f43', body: '#3b3027' },
        fonts: { brandline: NUN_800, model: BREE, headline: NUN_700, body: INTER_500 },
        upperModel: false, headlineFirst: false,
        sizes: { brandline: 0.03, model: 0.068, headline: 0.038, body: 0.03 },
        featuresMax: 6, featuresStyle: 'list', promo: { fill: p.accent, text: onAccent }, logoChips: false,
        footer: { fill: deep, text: '#ffffff', highlight: p.accent, bleed: true, heightK: 0.15 },
      },
      {
        name: 'Ficha blanca', bg: '#ffffff', photoZone: 'top', photoFrac: 0.6, photoBleed: false, photoFit: 'contain',
        photoFrame: { fill: '#faf6ef', radiusK: 0, padK: 0.03 },
        fade: false, topShade: false, align: 'left',
        colors: { brandline: contrastRatio(p.brand, '#ffffff') >= 3 ? p.brand : p.primary, model: p.primary, headline: '#5c4f43', body: '#3b3027' },
        fonts: { brandline: NUN_800, model: BREE, headline: NUN_700, body: INTER_500 },
        upperModel: false, headlineFirst: false,
        sizes: { brandline: 0.03, model: 0.068, headline: 0.038, body: 0.03 },
        featuresMax: 6, featuresStyle: 'list', promo: { fill: p.primary, text: onPrimary }, logoChips: false,
        footer: { fill: p.primary, text: onPrimary, highlight: p.accent, bleed: true, heightK: 0.15 },
      },
      {
        name: 'Ficha centrada', bg: '#ffffff', photoZone: 'bottom', photoFrac: 0.56, photoBleed: false, photoFit: 'contain',
        photoFrame: { fill: A.crema, radiusK: 0.03, padK: 0.03 },
        fade: false, topShade: false, align: 'center',
        colors: { brandline: p.primary, model: A.tinta, headline: '#5c4f43', body: '#3b3027' },
        fonts: { brandline: NUN_800, model: BREE, headline: NUN_700, body: INTER_500 },
        upperModel: false, headlineFirst: false,
        sizes: { brandline: 0.03, model: 0.068, headline: 0.038, body: 0.03 },
        featuresMax: 4, featuresStyle: 'list', promo: { fill: p.accent, text: onAccent }, logoChips: false,
        footer: { fill: A.crema, text: A.tinta, highlight: p.primary, bleed: false, heightK: 0.15 },
      },
    ],
    redes: [
      {
        name: 'Llamado directo', bg: p.primary, photoZone: 'top', photoFrac: 0.6, photoBleed: true, photoFit: 'auto',
        fade: true, topShade: true, align: 'center',
        colors: { brandline: onPrimary, model: onPrimary, headline: p.accent, body: onPrimary },
        fonts: { brandline: NUN_800, model: BREE, headline: NUN_900, body: NUN_700 },
        upperModel: false, headlineFirst: false,
        sizes: { brandline: 0.036, model: 0.072, headline: 0.08, body: 0.036 },
        featuresMax: 3, featuresStyle: 'icons', promo: { fill: p.accent, text: onAccent }, logoChips: true,
        footer: { fill: p.accent, text: onAccent, highlight: onAccent, bleed: false, heightK: 0.2 },
      },
      {
        name: 'Foto protagonista', bg: '#ffffff', photoZone: 'top', photoFrac: 0.62, photoBleed: true, photoFit: 'auto',
        fade: false, topShade: true, align: 'center',
        colors: { brandline: p.primary, model: A.tinta, headline: p.primary, body: '#3b3027' },
        fonts: { brandline: NUN_800, model: BREE, headline: NUN_900, body: NUN_700 },
        upperModel: false, headlineFirst: false,
        sizes: { brandline: 0.036, model: 0.072, headline: 0.075, body: 0.036 },
        featuresMax: 3, featuresStyle: 'icons', promo: { fill: p.accent, text: onAccent }, logoChips: true,
        footer: { fill: p.primary, text: onPrimary, highlight: p.accent, bleed: true, heightK: 0.2 },
      },
      {
        name: 'Mostaza', bg: p.accent, photoZone: 'bottom', photoFrac: 0.55, photoBleed: false, photoFit: 'auto',
        photoFrame: { fill: '#ffffff', radiusK: 0.035, padK: 0.012 },
        fade: false, topShade: false, align: 'center',
        colors: { brandline: onAccent, model: onAccent, headline: contrastRatio(A.terracota, p.accent) >= 4.5 ? A.terracota : onAccent, body: onAccent },
        fonts: { brandline: NUN_800, model: BREE, headline: NUN_900, body: NUN_700 },
        upperModel: false, headlineFirst: true,
        sizes: { brandline: 0.036, model: 0.068, headline: 0.09, body: 0.036 },
        featuresMax: 3, featuresStyle: 'icons', promo: { fill: A.terracota, text: '#ffffff' }, logoChips: true,
        blobs: ['#ffffff', AMOLA.naranja],
        footer: { fill: A.terracota, text: '#ffffff', highlight: A.mostaza, bleed: true, heightK: 0.2 },
      },
    ],
  };
}

/** Formas orgánicas de fondo: píldoras rotadas que asoman desde los bordes, muy suaves. */
function organicBlobs(colors: string[], W: number, H: number, opacity = 0.35): DesignElement[] {
  const S = Math.min(W, H);
  const spots = [
    { x: W - S * 0.28, y: -S * 0.12, w: S * 0.62, h: S * 0.3, rot: 28 },
    { x: -S * 0.18, y: H * 0.42, w: S * 0.5, h: S * 0.24, rot: -18 },
    { x: W * 0.62, y: H * 0.55, w: S * 0.44, h: S * 0.2, rot: 12 },
  ];
  return colors.flatMap((c, i) => {
    const s = spots[i % spots.length];
    return [makeRect({ name: `Forma orgánica ${i + 1}`, role: 'shape', x: s.x, y: s.y, width: s.w, height: s.h, rotation: s.rot, fill: c, opacity, cornerRadius: s.h / 2, locked: true })];
  });
}

export function variantCount(styleId: StyleId): number {
  return STYLE_INFO[styleId].variants.length;
}

// ── Bloques de texto apilados ────────────────────────────────
type Block =
  | {
      kind: 'text';
      role: TextEl['role'];
      name: string;
      text: string;
      font: Font;
      size: number;
      color: string;
      upper?: boolean;
      letterSpacing?: number;
      lineHeight?: number;
      shadow?: boolean;
      /** nunca se parte en renglones: se achica hasta entrar (teléfonos) */
      nowrap?: boolean;
    }
  | { kind: 'badge'; name: string; text: string; font: Font; size: number; fill: string; color: string }
  | { kind: 'button'; name: string; label: string; size: number; fill: string; color: string; icon: 'chat' | 'phone' }
  | { kind: 'icons'; name: string; items: string[]; font: Font; size: number; circle: string; iconColor: string; color: string };

const display = (t: string, upper?: boolean) => (upper ? t.toLocaleUpperCase('es-AR') : t);

function blockSize(b: Block, k: number, w: number, measure: Measure): { w: number; h: number } {
  if (b.kind === 'text') {
    const fs = b.size * k;
    const m = measure(display(b.text, b.upper), {
      fontFamily: b.font[0], fontStyle: b.font[1], fontSize: fs,
      lineHeight: b.lineHeight ?? 1.12, letterSpacing: (b.letterSpacing ?? 0) * fs, width: b.nowrap ? undefined : w,
    });
    // en nowrap se devuelve el ancho real para detectar desbordes horizontales
    return { w: b.nowrap ? m.width * 1.02 : w, h: m.height };
  }
  if (b.kind === 'badge') {
    const fs = b.size * k;
    const padX = fs * 0.7;
    const padY = fs * 0.45;
    const o = { fontFamily: b.font[0], fontStyle: b.font[1], fontSize: fs, lineHeight: 1.15, letterSpacing: 0 };
    const single = measure(b.text, o);
    const bw = Math.min(w, Math.ceil(single.width * 1.04) + padX * 2);
    const wrapped = measure(b.text, { ...o, width: bw - padX * 2 });
    return { w: bw, h: wrapped.height + padY * 2 };
  }
  if (b.kind === 'icons') {
    const { fs, d, labelH } = iconsMetrics(b, k, w, measure);
    return { w, h: d + fs * 0.5 + labelH };
  }
  const h = b.size * k;
  const fs = h * 0.36;
  const lw = measure(b.label, { fontFamily: 'Nunito', fontStyle: '700', fontSize: fs, lineHeight: 1, letterSpacing: 0 }).width;
  return { w: Math.min(w, lw + h * 1.55), h };
}

function iconsMetrics(b: Extract<Block, { kind: 'icons' }>, k: number, w: number, measure: Measure) {
  const n = b.items.length;
  const cellW = w / n;
  const fs = b.size * k;
  const d = Math.min(cellW * 0.5, fs * 2.6);
  const labelW = cellW * 0.92;
  const labelH = Math.max(
    ...b.items.map((it) => measure(display(it, true), { fontFamily: b.font[0], fontStyle: b.font[1], fontSize: fs, lineHeight: 1.1, letterSpacing: 0, width: labelW }).height),
  );
  return { n, cellW, fs, d, labelW, labelH };
}

interface StackResult {
  elements: DesignElement[];
  fits: boolean;
  usedHeight: number;
}

function stack(
  blocks: Block[],
  rect: Rect,
  align: 'left' | 'center',
  gap: number,
  measure: Measure,
  vAlign: 'top' | 'center' | 'bottom' = 'center',
  minK = 0.5,
  maxK = 1,
): StackResult {
  if (!blocks.length || rect.h <= 0 || rect.w <= 0) return { elements: [], fits: blocks.length === 0, usedHeight: 0 };
  let k = maxK;
  let sizes = blocks.map((b) => blockSize(b, k, rect.w, measure));
  const total = () => sizes.reduce((a, s) => a + s.h, 0) + gap * k * (blocks.length - 1);
  const tooWide = () => sizes.some((s) => s.w > rect.w + 0.5);
  while ((total() > rect.h || tooWide()) && k > minK) {
    k *= 0.95;
    sizes = blocks.map((b) => blockSize(b, k, rect.w, measure));
  }
  const used = total();
  const fits = used <= rect.h + 0.5 && !tooWide();
  let y = rect.y + (vAlign === 'top' ? 0 : vAlign === 'bottom' ? rect.h - used : (rect.h - used) / 2);
  y = Math.max(rect.y, y);
  const out: DesignElement[] = [];
  blocks.forEach((b, i) => {
    const s = sizes[i];
    const x = align === 'center' ? rect.x + (rect.w - s.w) / 2 : rect.x;
    if (b.kind === 'text' && b.nowrap) s.w = rect.w; // el elemento ocupa el ancho del bloque para alinear
    if (b.kind === 'text') {
      const fs = b.size * k;
      out.push(
        makeText({
          name: b.name, role: b.role, text: b.text, x: rect.x, y, width: rect.w, height: s.h,
          fontFamily: b.font[0], fontStyle: b.font[1], fontSize: round(fs), fill: b.color, align,
          lineHeight: b.lineHeight ?? 1.12, letterSpacing: round((b.letterSpacing ?? 0) * fs), uppercase: !!b.upper,
          shadow: !!b.shadow, wrap: b.nowrap ? 'none' : 'word',
        }),
      );
    } else if (b.kind === 'icons') {
      const { n, cellW, fs, d, labelW, labelH } = iconsMetrics(b, k, rect.w, measure);
      for (let j = 0; j < n; j++) {
        const cx = rect.x + cellW * j + cellW / 2;
        out.push(makeButton({ name: `Ícono beneficio ${j + 1}`, role: 'cta', label: '', icon: 'leaf', x: cx - d / 2, y, width: d, height: d, fill: b.circle, textColor: b.iconColor, cornerRadius: 999 }));
        out.push(
          makeText({
            name: `Beneficio ${j + 1}`, role: 'features', text: b.items[j], x: cx - labelW / 2, y: y + d + fs * 0.5, width: labelW, height: labelH,
            fontFamily: b.font[0], fontStyle: b.font[1], fontSize: round(fs), fill: b.color, align: 'center', lineHeight: 1.1, uppercase: true,
          }),
        );
      }
    } else if (b.kind === 'badge') {
      const fs = b.size * k;
      out.push(makeRect({ name: `${b.name} (fondo)`, role: 'accent', x, y, width: s.w, height: s.h, fill: b.fill, cornerRadius: s.h * 0.18 }));
      out.push(
        makeText({
          name: b.name, role: 'promo', text: b.text, x: x + fs * 0.7, y: y + fs * 0.45, width: s.w - fs * 1.4,
          height: s.h - fs * 0.9, fontFamily: b.font[0], fontStyle: b.font[1], fontSize: round(fs), fill: b.color,
          align: 'center', lineHeight: 1.15,
        }),
      );
    } else {
      out.push(makeButton({ name: b.name, role: 'whatsapp', label: b.label, x, y, width: s.w, height: s.h, fill: b.fill, textColor: b.color, icon: b.icon }));
    }
    y += s.h + gap * k;
  });
  return { elements: out, fits, usedHeight: used };
}

const round = (n: number) => Math.round(n * 10) / 10;

// ── Imagen: elegir encuadre sin deformar ni cortar el producto ─
/** Proporción de la foto que se pierde si se usa "cover" en ese marco. */
export function coverLoss(iw: number, ih: number, w: number, h: number): number {
  const ia = iw / ih;
  const fa = w / h;
  return 1 - Math.min(ia / fa, fa / ia);
}
export const MAX_COVER_LOSS = 0.15;

function logoBox(ref: AssetRef, maxW: number, maxH: number) {
  const a = ref.width / ref.height;
  let h = maxH;
  let w = h * a;
  if (w > maxW) {
    w = maxW;
    h = w / a;
  }
  return { w, h };
}

// ── Composición principal ────────────────────────────────────
export function composeLayout(input: LayoutInput, measure: Measure): LayoutResult {
  if (input.styleId === 'campana') return composeCampaign(input, measure);
  const styleId = input.styleId;
  const { width: W, height: H } = input;
  const warnings: string[] = [];
  const zones: Record<string, Rect> = {};
  const palette: Palette = {
    primary: input.primaryColor,
    accent: input.accentColor,
    brand: input.brandColor || input.primaryColor,
  };
  const all = recipes(palette)[styleId];
  const r = all[((input.variant % all.length) + all.length) % all.length];

  const S = Math.min(W, H);
  const landscape = W / H > 1.2;
  const m = Math.round(S * 0.055);
  const gap = Math.round(S * 0.025);
  const topInset = Math.max(m, Math.round(H * input.safeTop));
  const bottomInset = Math.max(m, Math.round(H * input.safeBottom));
  // en formatos altos (Stories / estados) logos y contacto ganan tamaño
  const tall = Math.min(1.3, Math.max(1, H / W / 1.35));
  const headerH = Math.round(S * (landscape ? 0.13 : 0.11) * tall);
  const footerH = Math.round(S * r.footer.heightK * (landscape ? 0.95 : 1) * tall);

  const els: DesignElement[] = [];

  // Fondo
  els.push(makeRect({ name: 'Fondo', role: 'background', x: 0, y: 0, width: W, height: H, fill: r.bg, locked: true }));
  if (r.blobs) els.push(...organicBlobs(r.blobs, W, H));

  // Pie (contacto)
  const footerBox: Rect = r.footer.bleed
    ? { x: 0, y: H - bottomInset - footerH, w: W, h: bottomInset + footerH }
    : { x: m, y: H - bottomInset - footerH, w: W - 2 * m, h: footerH };
  const fPad = Math.round(footerH * 0.15);
  const footerContent: Rect = r.footer.bleed
    ? { x: m, y: footerBox.y + fPad, w: W - 2 * m, h: footerH - 2 * fPad }
    : { x: footerBox.x + fPad * 1.4, y: footerBox.y + fPad, w: footerBox.w - fPad * 2.8, h: footerH - 2 * fPad };
  zones.footer = footerContent;

  // Cuerpo
  const bodyTop = topInset + headerH + gap;
  const bodyBottom = footerBox.y - gap;
  const body: Rect = { x: m, y: bodyTop, w: W - 2 * m, h: bodyBottom - bodyTop };

  // Reparto foto / texto
  let photoRect: Rect;
  let textRect: Rect;
  const photoFirst = r.photoZone === 'top';
  if (!landscape) {
    const ph = Math.round(body.h * r.photoFrac);
    if (photoFirst) {
      photoRect = r.photoBleed
        ? { x: 0, y: 0, w: W, h: body.y + ph }
        : { x: m, y: body.y, w: body.w, h: ph };
      const ty = body.y + ph + gap;
      textRect = { x: m, y: ty, w: body.w, h: bodyBottom - ty };
    } else {
      const th = body.h - ph - gap;
      textRect = { x: m, y: body.y, w: body.w, h: th };
      const py = body.y + th + gap;
      photoRect = r.photoBleed
        ? { x: 0, y: py, w: W, h: (r.footer.bleed ? footerBox.y : bodyBottom) - py }
        : { x: m, y: py, w: body.w, h: bodyBottom - py };
    }
  } else {
    const pw = Math.round(body.w * r.photoFrac);
    const fullTop = r.photoBleed ? 0 : body.y;
    const fullBottom = r.photoBleed && r.footer.bleed ? footerBox.y : bodyBottom;
    if (photoFirst) {
      photoRect = r.photoBleed
        ? { x: 0, y: fullTop, w: m + pw, h: fullBottom - fullTop }
        : { x: m, y: body.y, w: pw, h: body.h };
      const tx = m + pw + gap * 1.5;
      textRect = { x: tx, y: body.y, w: W - m - tx, h: body.h };
    } else {
      const tw = body.w - pw - gap * 1.5;
      textRect = { x: m, y: body.y, w: tw, h: body.h };
      const px = m + tw + gap * 1.5;
      photoRect = r.photoBleed
        ? { x: px, y: fullTop, w: W - px, h: fullBottom - fullTop }
        : { x: px, y: body.y, w: W - m - px, h: body.h };
    }
  }
  zones.text = textRect;

  // Foto
  if (input.photo) {
    const ph = input.photo;
    let frame = photoRect;
    let fit: Fit;
    if (r.photoFrame) {
      const pad = S * r.photoFrame.padK;
      frame = { x: photoRect.x + pad, y: photoRect.y + pad, w: photoRect.w - 2 * pad, h: photoRect.h - 2 * pad };
      fit = r.photoFit === 'contain' || coverLoss(ph.width, ph.height, frame.w, frame.h) > MAX_COVER_LOSS ? 'contain' : 'cover';
      if (fit === 'contain') {
        // el marco "abraza" la foto: sin bandas vacías alrededor del producto
        const sc = Math.min(frame.w / ph.width, frame.h / ph.height);
        const cw = ph.width * sc;
        const ch = ph.height * sc;
        frame = { x: frame.x + (frame.w - cw) / 2, y: frame.y + (frame.h - ch) / 2, w: cw, h: ch };
        photoRect = { x: frame.x - pad, y: frame.y - pad, w: cw + 2 * pad, h: ch + 2 * pad };
      }
      els.push(
        makeRect({
          name: 'Marco de foto', role: 'panel', ...rectXY(photoRect), fill: r.photoFrame.fill,
          cornerRadius: S * r.photoFrame.radiusK,
        }),
      );
    } else {
      fit = r.photoFit === 'contain' || coverLoss(ph.width, ph.height, frame.w, frame.h) > MAX_COVER_LOSS ? 'contain' : 'cover';
    }
    // Si la foto no entra completa, se usa la misma foto desenfocada como ambiente:
    // el producto nítido queda completo y sin recortes.
    if (fit === 'contain' && !r.photoFrame) {
      if (ph.edge) {
        // foto de estudio (fondo liso): se extiende su mismo color y el producto queda entero, sin costuras
        els.push(makeRect({ name: 'Fondo de la foto', role: 'panel', ...rectXY(frame), fill: ph.edge, locked: true }));
      } else {
        els.push(
          makeImage({
            name: 'Ambiente (foto desenfocada)', role: 'image', assetId: ph.assetId, ...rectXY(frame), fit: 'cover',
            blur: 40, brightness: -0.18, locked: true,
          }),
        );
      }
    }
    const inset = fit === 'contain' && !r.photoFrame ? S * 0.02 : 0;
    const photoFrameRect = { x: frame.x + inset, y: frame.y + inset, w: frame.w - 2 * inset, h: frame.h - 2 * inset };
    // La foto en "contain" no debe quedar debajo de los logos del encabezado
    if (fit === 'contain' && photoFrameRect.y < topInset + headerH) {
      const top = topInset + headerH + gap / 2;
      photoFrameRect.h -= top - photoFrameRect.y;
      photoFrameRect.y = top;
    }
    els.push(
      makeImage({
        name: 'Foto principal', role: 'photo', assetId: ph.assetId, ...rectXY(photoFrameRect), fit,
        shadow: fit === 'contain' && !!r.photoFrame && r.photoFit === 'contain',
        cornerRadius: r.photoFrame && r.photoFrame.padK > 0 ? S * r.photoFrame.radiusK * 0.6 : r.photoFrame ? S * r.photoFrame.radiusK : 0,
      }),
    );
    zones.photo = photoFrameRect;
    // con marco, el marco "abraza" la foto; con fondo liso se extiende su color: no hace falta avisar
    if (fit === 'contain' && r.photoFit !== 'contain' && !r.photoFrame && !ph.edge) {
      warnings.push('La foto no coincide con la proporción del formato: se muestra completa sobre un fondo difuminado de la misma foto.');
    }
    // Fundido hacia el fondo
    if (r.fade && r.photoBleed) {
      const fh = Math.round(S * 0.16);
      const transparent = rgba(r.bg, 0);
      if (!landscape) {
        if (photoFirst) {
          els.push(makeRect({ name: 'Fundido', role: 'overlay', x: 0, y: photoRect.y + photoRect.h - fh, width: W, height: fh, fill: r.bg, gradient: { from: transparent, to: r.bg, angle: 0 }, locked: true }));
        } else {
          els.push(makeRect({ name: 'Fundido', role: 'overlay', x: 0, y: photoRect.y, width: W, height: fh, fill: r.bg, gradient: { from: r.bg, to: transparent, angle: 0 }, locked: true }));
        }
      } else {
        const fw = Math.round(S * 0.22);
        if (photoFirst) {
          els.push(makeRect({ name: 'Fundido', role: 'overlay', x: photoRect.x + photoRect.w - fw, y: photoRect.y, width: fw, height: photoRect.h, fill: r.bg, gradient: { from: transparent, to: r.bg, angle: 90 }, locked: true }));
        } else {
          els.push(makeRect({ name: 'Fundido', role: 'overlay', x: photoRect.x, y: photoRect.y, width: fw, height: photoRect.h, fill: r.bg, gradient: { from: r.bg, to: transparent, angle: 90 }, locked: true }));
        }
      }
    }
  } else {
    warnings.push('No hay fotografía cargada.');
  }

  // Sombra superior para que se lean los logos sobre la foto
  // (no en fotos de estudio claras: oscurecería el fondo blanco; los logos ya van en recuadro)
  if (r.topShade && input.photo && !(input.photo.edge && luminance(input.photo.edge) > 0.7)) {
    els.push(
      makeRect({
        name: 'Sombra superior', role: 'overlay', x: 0, y: 0, width: W, height: topInset + headerH * 1.9, fill: '#000000',
        gradient: { from: 'rgba(0,0,0,0.55)', to: 'rgba(0,0,0,0)', angle: 0 }, locked: true,
      }),
    );
  }

  // Encabezado: logos (archivos originales, solo escalado proporcional)
  const headerRect: Rect = { x: m, y: topInset, w: W - 2 * m, h: headerH };
  zones.header = headerRect;
  const halfW = (headerRect.w - gap) / 2;
  const chipPad = r.logoChips ? Math.round(headerH * 0.16) : 0;
  const placeLogo = (
    ref: AssetRef | undefined,
    fallbackText: string,
    side: 'left' | 'right',
    maxH: number,
    name: string,
  ) => {
    const maxW = halfW;
    if (ref) {
      const { w, h } = logoBox(ref, maxW - 2 * chipPad, maxH - 2 * chipPad);
      const cw = w + 2 * chipPad;
      const ch = h + 2 * chipPad;
      const cx = side === 'left' ? headerRect.x : headerRect.x + headerRect.w - cw;
      const cy = headerRect.y + (headerH - ch) / 2;
      if (r.logoChips) {
        els.push(makeRect({ name: `${name} (fondo)`, role: 'panel', x: cx, y: cy, width: cw, height: ch, fill: '#ffffff', cornerRadius: Math.round(ch * 0.16) }));
      }
      els.push(makeImage({ name, role: 'logo', assetId: ref.assetId, x: cx + chipPad, y: cy + chipPad, width: w, height: h, fit: 'contain' }));
    } else if (fallbackText.trim()) {
      // Sin logo cargado: se muestra el NOMBRE en texto (no se inventa un logo)
      const onBg = r.logoChips ? '#141414' : readableOn(r.bg);
      const rect: Rect = { x: side === 'left' ? headerRect.x : headerRect.x + headerRect.w - maxW, y: headerRect.y, w: maxW, h: maxH };
      const textRect = r.logoChips ? { x: rect.x + chipPad, y: rect.y + chipPad, w: rect.w - 2 * chipPad, h: rect.h - 2 * chipPad } : rect;
      const res = stack(
        [{ kind: 'text', role: 'company', name: `${name} (texto)`, text: fallbackText, font: NUN_800, size: maxH * 0.32, color: onBg, upper: true, lineHeight: 1.05 }],
        textRect, 'left', 0, measure, 'center', 0.4,
      );
      const t = res.elements[0] as TextEl;
      t.align = side;
      if (r.logoChips) {
        els.push(makeRect({ name: `${name} (fondo)`, role: 'panel', x: rect.x, y: t.y - chipPad, width: rect.w, height: t.height + 2 * chipPad, fill: '#ffffff', cornerRadius: Math.round(maxH * 0.14) }));
      }
      els.push(t);
    }
  };
  if (input.includeCompanyLogo) {
    placeLogo(input.companyLogo, input.companyName, 'left', headerH, 'Logo empresa');
    if (!input.companyLogo) warnings.push('Falta el logo de AMOLA (cargalo en Empresa). Se usa el nombre en texto.');
  }
  if (input.includeBrandLogo && input.brandName) {
    placeLogo(input.brandLogo, input.brandName, 'right', Math.round(headerH * 0.86), 'Sello de la línea');
    if (!input.brandLogo) warnings.push(`La línea ${input.brandName} no tiene sello cargado. Se usa el nombre en texto.`);
  }

  // ── Bloque de texto ──
  const t = input;
  // AMOLA: la línea se expresa con su color; arriba del producto va la presentación ("Paquete 250 g")
  const brandline = t.machineType.trim();
  const headline: Block | null = t.headline.trim()
    ? { kind: 'text', role: 'headline', name: 'Titular', text: t.headline.trim(), font: r.fonts.headline, size: S * r.sizes.headline, color: r.colors.headline, lineHeight: 1.05 }
    : null;
  const brandBlock: Block | null = brandline
    ? { kind: 'text', role: 'brandline', name: 'Presentación', text: brandline, font: r.fonts.brandline, size: S * r.sizes.brandline, color: r.colors.brandline, upper: true, letterSpacing: 0.12 }
    : null;
  const modelBlock: Block | null = t.model.trim()
    ? { kind: 'text', role: 'model', name: 'Producto', text: t.model.trim(), font: r.fonts.model, size: S * r.sizes.model, color: r.colors.model, upper: r.upperModel, lineHeight: 1.0 }
    : null;
  const feats = t.features.map((f) => f.trim()).filter(Boolean);
  const shownFeats = feats.slice(0, r.featuresMax);
  if (feats.length > shownFeats.length) {
    warnings.push(`Este estilo muestra hasta ${r.featuresMax} beneficios; se omitieron ${feats.length - shownFeats.length}. Podés agregarlas en el editor.`);
  }
  const featBlock: Block | null = !shownFeats.length
    ? null
    : r.featuresStyle === 'icons'
      ? { kind: 'icons', name: 'Beneficios', items: shownFeats, font: NUN_800, size: S * 0.026, circle: palette.accent, iconColor: readableOn(palette.accent), color: r.colors.body }
      : { kind: 'text', role: 'features', name: 'Beneficios', text: shownFeats.map((f) => `•  ${f}`).join('\n'), font: r.fonts.body, size: S * r.sizes.body, color: r.colors.body, lineHeight: 1.35 };
  const promoBlock: Block | null = t.promo.trim()
    ? { kind: 'badge', name: 'Promoción', text: t.promo.trim(), font: NUN_800, size: S * 0.034, fill: r.promo.fill, color: r.promo.text }
    : null;

  const qrOn = /^https?:\/\/\S+\.\S+/.test(t.qrUrl.trim());
  if (t.qrUrl.trim() && !qrOn) warnings.push('El enlace del QR no es válido (debe empezar con http:// o https://). Se omitió el QR.');
  let buttonInFooter = landscape || !qrOn;
  const waBlock: Block | null = t.whatsapp
    ? { kind: 'button', name: 'Botón WhatsApp', label: `WhatsApp ${t.whatsapp.number}`, size: S * 0.085, fill: '#25D366', color: '#ffffff', icon: 'chat' }
    : null;

  const head: (Block | null)[] = r.headlineFirst ? [headline, brandBlock, modelBlock] : [brandBlock, modelBlock, headline];
  const tGap = S * 0.018;
  // en formatos altos (Stories) sobra alto: el texto puede crecer hasta 35 %
  const growK = landscape ? 1 : Math.min(1.35, Math.max(1, H / W / 1.25));
  const vAlign = landscape ? 'center' : r.photoZone === 'top' ? 'top' : 'center';

  // Degradación ordenada: primero se resignan los elementos menos prioritarios
  // de la jerarquía (beneficios → promo → botón al pie → presentación).
  const attempts: { drop: Block[]; waInText: boolean; note?: string }[] = [
    { drop: [], waInText: !buttonInFooter },
    { drop: [featBlock!], waInText: !buttonInFooter, note: 'No había espacio para los beneficios en este formato: se omitieron (agregalos en el editor si querés).' },
    { drop: [featBlock!, promoBlock!], waInText: !buttonInFooter, note: 'Por espacio se omitieron beneficios y promoción en este formato.' },
    { drop: [featBlock!, promoBlock!], waInText: false, note: 'Por espacio se omitieron beneficios y promoción en este formato.' },
    { drop: [featBlock!, promoBlock!, brandBlock!], waInText: false, note: 'Por espacio solo se muestran producto y titular.' },
  ];
  let res: StackResult | null = null;
  for (const a of attempts) {
    const blocks = [...head, featBlock, promoBlock, a.waInText ? waBlock : null]
      .filter((b): b is Block => !!b && !a.drop.includes(b));
    const attempt = stack(blocks, textRect, r.align, tGap, measure, vAlign, 0.5, growK);
    res = attempt;
    buttonInFooter = !a.waInText;
    if (attempt.fits) {
      if (a.note && a.drop.some(Boolean)) warnings.push(a.note);
      break;
    }
  }
  if (res && !res.fits) {
    // Último recurso: se quitan bloques desde el final hasta que entre.
    let blocks: Block[] = head.filter((b) => !!b) as Block[];
    while (blocks.length > 1 && !(res = stack(blocks, textRect, r.align, tGap, measure, vAlign, 0.5, growK)).fits) blocks = blocks.slice(0, -1);
    warnings.push('El texto es largo para este formato: acortá el titular o el nombre del producto para mejorar la legibilidad.');
  }
  if (res) els.push(...res.elements);

  // ── Pie de contacto ──
  els.push(
    makeRect({
      name: 'Banda de contacto', role: 'band', ...rectXY(footerBox), fill: r.footer.fill,
      cornerRadius: r.footer.bleed ? 0 : Math.round(S * 0.02),
    }),
  );
  let contentRight = footerContent.x + footerContent.w;
  if (qrOn) {
    const q = footerContent.h;
    contentRight -= q;
    els.push(makeQr({ name: 'Código QR', value: t.qrUrl.trim(), x: contentRight, y: footerContent.y, width: q, height: q }));
    contentRight -= gap;
  }
  if (t.whatsapp && buttonInFooter) {
    const label = `WhatsApp ${t.whatsapp.number}`;
    const maxBw = (contentRight - footerContent.x) * 0.52;
    let bh = Math.min(footerContent.h * 0.62, S * 0.085);
    const need = (h: number) => measure(label, { fontFamily: 'Nunito', fontStyle: '700', fontSize: h * 0.36, lineHeight: 1, letterSpacing: 0 }).width * 1.03 + h * 1.55;
    // el número nunca se trunca: se reduce el botón hasta que entre completo
    while (need(bh) > maxBw && bh > S * 0.04) bh *= 0.95;
    const bw = need(bh);
    contentRight -= bw;
    els.push(
      makeButton({
        name: 'Botón WhatsApp', role: 'whatsapp', label, x: contentRight, y: footerContent.y + (footerContent.h - bh) / 2,
        width: bw, height: bh, fill: '#25D366', textColor: '#ffffff', icon: 'chat',
      }),
    );
    contentRight -= gap;
  }
  const phonesRect: Rect = { x: footerContent.x, y: footerContent.y, w: contentRight - footerContent.x, h: footerContent.h };
  zones.phones = phonesRect;
  const phoneBlocks: Block[] = [];
  if (t.contactMessage.trim()) {
    phoneBlocks.push({ kind: 'text', role: 'contact', name: 'Mensaje de contacto', text: t.contactMessage.trim(), font: INTER_500, size: S * 0.026, color: r.footer.text, lineHeight: 1.15 });
  }
  const phones = t.phones.filter((p) => p.number.trim());
  if (phones.length) {
    const [first, ...rest] = phones;
    if (t.highlightFirst) {
      phoneBlocks.push({ kind: 'text', role: 'phones', name: `Teléfono ${first.label}`, text: `${first.label}  ${first.number}`, font: NUN_800, size: S * 0.05, color: r.footer.highlight, upper: false, lineHeight: 1.05, nowrap: true });
    }
    const others = t.highlightFirst ? rest : phones;
    if (others.length) {
      const sep = landscape || others.length === 1 ? '     ' : '\n';
      phoneBlocks.push({ kind: 'text', role: 'phones', name: 'Otros teléfonos', text: others.map((p) => `${p.label}  ${p.number}`).join(sep), font: NUN_700, size: S * 0.03, color: r.footer.text, lineHeight: 1.2, nowrap: true });
    }
  }
  const pr = stack(phoneBlocks, phonesRect, landscape || r.align === 'left' || qrOn || (t.whatsapp && buttonInFooter) ? 'left' : 'center', S * 0.008, measure, 'center', 0.35);
  if (!pr.fits) warnings.push('Los teléfonos no entran con buen tamaño: elegí menos teléfonos o quitá el QR.');
  els.push(...pr.elements);

  return { elements: els, warnings, zones };
}

function rectXY(r: Rect) {
  return { x: r.x, y: r.y, width: r.w, height: r.h };
}

/** Texto realmente visible (respeta mayúsculas). */
export function renderedText(el: TextEl): string {
  return display(el.text, el.uppercase);
}

export function isImage(el: DesignElement): el is ImageEl {
  return el.type === 'image';
}

// ─────────────────────────────────────────────────────────────
// Estilo "Paisaje AMOLA" (id interno 'campana').
// Como las etiquetas del packaging: fondo de color con formas orgánicas, foto del producto
// a sangre abajo (fundida con el fondo), titular en dos líneas y dos tipografías
// (Nunito redondeada + Bree Serif), etiqueta de presentación, sello de línea y contacto.
// La foto NO se altera: el fondo es un degradado y formas planas, no una imagen inventada.
// ─────────────────────────────────────────────────────────────
const PAISAJES: { name: string; top: string; bottom: string; line1: string; line2: string }[] = [
  { name: 'Color de la línea', top: '', bottom: '', line1: '', line2: '' },
  { name: 'Crema natural', top: '#efe3d0', bottom: '#fbf8f2', line1: AMOLA.verdeOscuro, line2: AMOLA.naranja },
  { name: 'Mostaza', top: '#dcae3c', bottom: '#f3dc9e', line1: AMOLA.terracota, line2: AMOLA.verdeOscuro },
];

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Mezcla dos colores HEX (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace('#', ''), 16);
  const pb = parseInt(b.replace('#', ''), 16);
  const ch = (n: number, sh: number) => (n >> sh) & 255;
  const c = [16, 8, 0].map((sh) => Math.round(ch(pa, sh) + (ch(pb, sh) - ch(pa, sh)) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Primer color de la lista que se lee bien sobre el fondo (o, si ninguno llega, el más contrastado). */
function firstReadable(bg: string, options: string[], min = 3): string {
  return options.find((c) => contrastRatio(c, bg) >= min) ?? options.reduce((a, c) => (contrastRatio(c, bg) > contrastRatio(a, bg) ? c : a));
}

function composeCampaign(input: LayoutInput, measure: Measure): LayoutResult {
  const { width: W, height: H } = input;
  const warnings: string[] = [];
  const zones: Record<string, Rect> = {};
  const S = Math.min(W, H);
  const landscape = W / H > 1.2;
  const m = Math.round(S * 0.055);
  const gap = Math.round(S * 0.025);
  const topInset = Math.max(m, Math.round(H * input.safeTop));
  const bottomInset = Math.max(m, Math.round(H * input.safeBottom));
  const tall = Math.min(1.3, Math.max(1, H / W / 1.35));
  const brand = input.brandColor || input.primaryColor;
  const v = ((input.variant % 3) + 3) % 3;
  const sky = { ...PAISAJES[v] };
  if (v === 0) {
    sky.top = shade(brand, 0.8);
    sky.bottom = mix(brand, '#ffffff', 0.12);
  }
  const mid = mix(sky.top, sky.bottom, 0.5);
  if (v === 0) {
    sky.line1 = readableOn(mid, AMOLA.tinta);
    sky.line2 = firstReadable(mid, [AMOLA.mostaza, AMOLA.crema, AMOLA.verdeOscuro, AMOLA.tinta].filter((c) => c !== sky.line1));
  }
  const lightText = luminance(sky.line1) > 0.5;
  const els: DesignElement[] = [];

  // Fondo: base sólida + degradado que termina exactamente donde se funde la foto (sin cortes de color)
  els.push(makeRect({ name: 'Fondo', role: 'background', x: 0, y: 0, width: W, height: H, fill: sky.bottom, locked: true }));
  const skyRect = makeRect({
    name: 'Fondo degradado', role: 'background', x: 0, y: 0, width: W, height: H, fill: sky.bottom,
    gradient: { from: sky.top, to: sky.bottom, angle: landscape ? 90 : 0 }, locked: true,
  });
  els.push(skyRect);
  // formas orgánicas en los colores de la marca (debajo de todo el contenido)
  // sobre el color de la línea: formas del mismo tono (más claro / más oscuro); sobre fondos claros: paleta AMOLA
  const blobColors = v === 0
    ? [mix(brand, '#ffffff', 0.4), shade(brand, 0.7)]
    : [AMOLA.mostaza, AMOLA.naranja, AMOLA.azul, AMOLA.verde].filter((c) => contrastRatio(c, mid) > 1.25).slice(0, 2);
  els.push(...organicBlobs(blobColors, W, H, v === 0 ? 0.55 : 0.3));

  // Pie de contacto (banda a sangre, verde Amola)
  const footerH = Math.round(S * 0.14 * (landscape ? 0.95 : 1) * tall);
  const footerBox: Rect = { x: 0, y: H - bottomInset - footerH, w: W, h: bottomInset + footerH };
  const fPad = Math.round(footerH * 0.15);
  const footer: Rect = { x: m, y: footerBox.y + fPad, w: W - 2 * m, h: footerH - 2 * fPad };

  const top: DesignElement[] = []; // etiqueta y sello: se dibujan encima de la foto
  // Etiqueta (presentación) arriba a la izquierda
  let cursorY = topInset;
  const badgeText = (input.machineType || '').trim();
  const badgeFill = firstReadable(mid, [input.accentColor, AMOLA.terracota, AMOLA.verdeOscuro], 1.6);
  if (badgeText) {
    const bh = Math.round(S * 0.07);
    const maxBw = (W - 2 * m) * 0.5; // nunca invade la zona del sello de la línea
    let fs = bh * 0.5;
    const tw = () => measure(display(badgeText, true), { fontFamily: 'Nunito', fontStyle: '900', fontSize: fs, lineHeight: 1, letterSpacing: 0 }).width;
    while (Math.ceil(tw() * 1.05) + bh * 1.1 > maxBw && fs > bh * 0.25) fs *= 0.93;
    const bw = Math.min(maxBw, Math.ceil(tw() * 1.05) + bh * 1.1);
    top.push(makeRect({ name: 'Etiqueta (fondo)', role: 'accent', x: m, y: cursorY, width: bw, height: bh, fill: badgeFill, cornerRadius: Math.round(bh / 2) }));
    top.push(makeText({ name: 'Etiqueta', role: 'brandline', text: badgeText, x: m + bh * 0.55, y: cursorY + (bh - fs) / 2, width: bw - bh * 1.1, height: fs, fontFamily: 'Nunito', fontStyle: '900', fontSize: round(fs), fill: readableOn(badgeFill), lineHeight: 1, uppercase: true, wrap: 'none', align: 'center' }));
    cursorY += bh + gap;
  }

  // Sello de la línea: arriba a la derecha, en su recuadro blanco (archivo original)
  if (input.includeBrandLogo && input.brandLogo) {
    const lh = Math.round(S * 0.085 * tall);
    const pad = Math.round(lh * 0.18);
    const maxW = (W - 2 * m) * (badgeText ? 0.42 : 0.5);
    const { w, h } = logoBox(input.brandLogo, maxW - 2 * pad, lh - 2 * pad);
    const cx = W - m - w - 2 * pad;
    top.push(makeRect({ name: 'Sello de la línea (fondo)', role: 'panel', x: cx, y: topInset, width: w + 2 * pad, height: h + 2 * pad, fill: '#ffffff', cornerRadius: Math.round((h + 2 * pad) * 0.3) }));
    top.push(makeImage({ name: 'Sello de la línea', role: 'logo', assetId: input.brandLogo.assetId, x: cx + pad, y: topInset + pad, width: w, height: h, fit: 'contain' }));
    cursorY = Math.max(cursorY, topInset + h + 2 * pad + gap);
  } else if (input.includeBrandLogo && input.brandName) {
    warnings.push(`La línea ${input.brandName} no tiene sello cargado.`);
  }

  // Foto a sangre
  let photoRect: Rect = landscape
    ? { x: Math.round(W * 0.4), y: 0, w: W - Math.round(W * 0.4), h: footerBox.y }
    : { x: 0, y: 0, w: W, h: 0 };
  if (!landscape) {
    const aspect = input.photo ? input.photo.width / input.photo.height : 4 / 3;
    const minText = Math.round(S * 0.3); // espacio mínimo reservado al titular
    const maxH = footerBox.y - (cursorY + minText);
    // hasta el recorte lateral permitido (15 %): saca bordes del fondo sin cortar el producto
    const h = Math.max(Math.round(S * 0.3), Math.min(Math.floor(W / aspect / (1 - MAX_COVER_LOSS) - 1), Math.round(H * 0.62), maxH));
    photoRect = { x: 0, y: footerBox.y - h, w: W, h };
  }
  if (input.photo) {
    const ph = input.photo;
    const loss = coverLoss(ph.width, ph.height, photoRect.w, photoRect.h);
    if (loss > MAX_COVER_LOSS && ph.edge) {
      // foto de estudio (fondo liso): se extiende su mismo color; el producto queda entero, sin costuras
      els.push(makeRect({ name: 'Fondo de la foto', role: 'panel', x: photoRect.x, y: photoRect.y, width: photoRect.w, height: photoRect.h, fill: ph.edge, locked: true }));
    } else if (loss > MAX_COVER_LOSS) {
      // el producto entero, sobre la misma foto desenfocada: nunca se corta de más
      els.push(makeImage({ name: 'Ambiente (foto desenfocada)', role: 'image', assetId: ph.assetId, x: photoRect.x, y: photoRect.y, width: photoRect.w, height: photoRect.h, fit: 'cover', blur: 40, brightness: -0.05, locked: true }));
      warnings.push('La foto no coincide con la proporción del formato: se muestra completa sobre un fondo difuminado de la misma foto.');
    }
    els.push(
      makeImage({
        name: 'Foto principal', role: 'photo', assetId: ph.assetId, x: photoRect.x, y: photoRect.y, width: photoRect.w, height: photoRect.h,
        fit: loss > MAX_COVER_LOSS ? 'contain' : 'cover', focusY: 0.55,
      }),
    );
    // fundido de la foto con el fondo
    const transparent = rgba(sky.bottom, 0);
    if (landscape) {
      const fw = Math.round(S * 0.3);
      skyRect.width = photoRect.x + fw;
      els.push(makeRect({ name: 'Fundido', role: 'overlay', x: photoRect.x, y: 0, width: fw, height: photoRect.h, fill: sky.bottom, gradient: { from: sky.bottom, to: transparent, angle: 90 }, locked: true }));
    } else {
      const fh = Math.round(S * 0.22);
      skyRect.height = photoRect.y + fh;
      els.push(makeRect({ name: 'Fundido', role: 'overlay', x: 0, y: photoRect.y, width: W, height: fh, fill: sky.bottom, gradient: { from: sky.bottom, to: transparent, angle: 0 }, locked: true }));
    }
  } else {
    warnings.push('No hay fotografía cargada.');
  }
  zones.photo = photoRect;
  els.push(...top);

  // Titular en dos líneas y dos tipografías + bajada
  const textBottom = landscape ? footerBox.y - gap : photoRect.y - Math.round(gap * 0.6);
  const textRect: Rect = landscape
    ? { x: m, y: cursorY, w: photoRect.x - m - gap, h: textBottom - cursorY }
    : { x: m, y: cursorY, w: W - 2 * m, h: textBottom - cursorY };
  zones.text = textRect;
  const headline = input.headline.trim();
  const product = input.model.trim();
  const line1 = headline || product || input.brandName.trim();
  const line2 = input.promo.trim() || (headline ? product : '');
  const sub = (input.subheadline ?? '').trim() || (input.promo.trim() && headline && product ? product : '');
  const big = S * (landscape ? 0.095 : 0.11);
  const blocks: Block[] = [];
  if (line1) blocks.push({ kind: 'text', role: 'headline', name: 'Titular', text: line1, font: ['Nunito', '900'], size: big, color: sky.line1, lineHeight: 1.0, shadow: lightText });
  if (line2) blocks.push({ kind: 'text', role: 'promo', name: 'Titular (2ª línea)', text: line2, font: ['Bree Serif', 'normal'], size: big * 0.92, color: sky.line2, lineHeight: 1.0, shadow: luminance(sky.line2) > 0.5 });
  if (sub) blocks.push({ kind: 'text', role: 'model', name: 'Bajada', text: sub, font: ['Nunito', '700'], size: S * 0.042, color: sky.line1, lineHeight: 1.15, shadow: lightText });
  if (input.features.some((f) => f.trim())) warnings.push('El estilo Paisaje no muestra la lista de beneficios: usá la bajada para el mensaje principal.');
  // primero se intenta cada línea del titular en un solo renglón; si habría que achicar demasiado, se permite partir
  const oneLine = blocks.map((b) => (b.kind === 'text' && b.role !== 'model' ? { ...b, nowrap: true } : b));
  const vAlign = 'center' as const;
  const qrOn = /^https?:\/\/\S+\.\S+/.test(input.qrUrl.trim());
  if (input.qrUrl.trim() && !qrOn) warnings.push('El enlace del QR no es válido (debe empezar con http:// o https://). Se omitió el QR.');
  const waLabel = input.whatsapp ? `WhatsApp ${input.whatsapp.number}` : '';
  const waBlock: Block | null = input.whatsapp
    ? { kind: 'button', name: 'Botón WhatsApp', label: waLabel, size: S * 0.075, fill: '#25D366', color: '#ffffff', icon: 'chat' }
    : null;
  // intentos en orden: todo en una línea → titular partido → sin bajada → WhatsApp a la banda
  const subBlock = blocks.find((b) => b.kind === 'text' && b.role === 'model');
  const attempts: { list: Block[]; minK: number; note?: string; waInBand?: boolean }[] = [
    { list: [...oneLine, ...(waBlock ? [waBlock] : [])], minK: 0.62 },
    { list: [...blocks, ...(waBlock ? [waBlock] : [])], minK: 0.45 },
    { list: [...blocks.filter((b) => b !== subBlock), ...(waBlock ? [waBlock] : [])], minK: 0.45, note: subBlock ? 'Por espacio se omitió la bajada en este formato.' : undefined },
    { list: oneLine, minK: 0.62, waInBand: true },
    { list: blocks, minK: 0.45, waInBand: true },
    { list: blocks.filter((b) => b !== subBlock), minK: 0.45, waInBand: true, note: subBlock ? 'Por espacio se omitió la bajada en este formato.' : undefined },
  ];
  let res = stack([], textRect, 'left', 0, measure);
  let waInBand = false;
  for (const at of attempts) {
    res = stack(at.list, textRect, 'left', S * 0.012, measure, vAlign, at.minK, 1);
    waInBand = !!at.waInBand && !!waBlock;
    if (res.fits) {
      if (at.note) warnings.push(at.note);
      break;
    }
  }
  if (!res.fits) warnings.push('El titular es largo para este formato: acortalo para que se lea mejor.');
  els.push(...res.elements);

  // Banda de contacto: logo de AMOLA, teléfonos y QR
  const band = shade(input.primaryColor, 0.62);
  els.push(makeRect({ name: 'Banda de contacto', role: 'band', x: 0, y: footerBox.y, width: W, height: footerBox.h, fill: band, gradient: { from: shade(input.primaryColor, 0.75), to: shade(input.primaryColor, 0.5), angle: 0 } }));
  const onBand = readableOn(band);
  let left = footer.x;
  let right = footer.x + footer.w;
  if (input.includeCompanyLogo && input.companyLogo) {
    const pad = Math.round(footer.h * 0.1);
    const { w, h } = logoBox(input.companyLogo, footer.w * 0.32 - 2 * pad, footer.h - 2 * pad);
    els.push(makeRect({ name: 'Logo empresa (fondo)', role: 'panel', x: left, y: footer.y + (footer.h - h - 2 * pad) / 2, width: w + 2 * pad, height: h + 2 * pad, fill: '#ffffff', cornerRadius: Math.round(pad * 1.6) }));
    els.push(makeImage({ name: 'Logo empresa', role: 'logo', assetId: input.companyLogo.assetId, x: left + pad, y: footer.y + (footer.h - h) / 2, width: w, height: h, fit: 'contain' }));
    left += w + 2 * pad + gap;
  } else if (input.includeCompanyLogo) {
    warnings.push('Falta el logo de AMOLA (cargalo en Empresa).');
  }
  if (waInBand && input.whatsapp) {
    let bh = footer.h * 0.58;
    const need = (h: number) => measure(waLabel, { fontFamily: 'Nunito', fontStyle: '700', fontSize: h * 0.36, lineHeight: 1, letterSpacing: 0 }).width * 1.03 + h * 1.55;
    const maxBw = (right - left) * 0.48;
    while (need(bh) > maxBw && bh > S * 0.035) bh *= 0.95;
    right -= need(bh);
    els.push(makeButton({ name: 'Botón WhatsApp', role: 'whatsapp', label: waLabel, x: right, y: footer.y + (footer.h - bh) / 2, width: need(bh), height: bh, fill: '#25D366', textColor: '#ffffff', icon: 'chat' }));
    right -= gap;
  }
  if (qrOn) {
    right -= footer.h;
    els.push(makeQr({ name: 'Código QR', value: input.qrUrl.trim(), x: right, y: footer.y, width: footer.h, height: footer.h }));
    right -= gap;
  }
  const phonesRect: Rect = { x: left, y: footer.y, w: right - left, h: footer.h };
  zones.phones = phonesRect;
  const pBlocks: Block[] = [];
  const phones = input.phones.filter((p) => p.number.trim());
  if (input.contactMessage.trim()) pBlocks.push({ kind: 'text', role: 'contact', name: 'Mensaje de contacto', text: input.contactMessage.trim(), font: ['Nunito', '700'], size: S * 0.026, color: onBand, lineHeight: 1.15 });
  if (phones.length) {
    const [first, ...rest] = phones;
    const others = input.highlightFirst ? rest : phones;
    if (input.highlightFirst) pBlocks.push({ kind: 'text', role: 'phones', name: `Teléfono ${first.label}`, text: `${first.label}  ${first.number}`, font: ['Nunito', '900'], size: S * 0.045, color: firstReadable(band, [input.accentColor, '#ffffff'], 4.5), lineHeight: 1.05, nowrap: true });
    if (others.length) pBlocks.push({ kind: 'text', role: 'phones', name: 'Otros teléfonos', text: others.map((p) => `${p.label}  ${p.number}`).join(landscape ? '     ' : '\n'), font: ['Nunito', '700'], size: S * 0.027, color: onBand, lineHeight: 1.2, nowrap: true });
  }
  const pr = stack(pBlocks, phonesRect, 'left', S * 0.006, measure, 'center', 0.3);
  if (!pr.fits) warnings.push('Los teléfonos no entran con buen tamaño: elegí menos teléfonos o quitá el QR.');
  els.push(...pr.elements);

  return { elements: els, warnings, zones };
}
