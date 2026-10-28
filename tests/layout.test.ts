import { describe, expect, it } from 'vitest';
import { composeLayout, coverLoss, MAX_COVER_LOSS, renderedText, type LayoutInput, type Measure, type Rect } from '../src/lib/layout';
import { FORMATS } from '../src/lib/formats';
import { contrastRatio, readableOn } from '../src/lib/elements';
import { uniformEdgeColor } from '../src/lib/assets';
import type { DesignElement, ImageEl, TextEl } from '../src/types';

// Medición aproximada (en el navegador se usa Konva). Ancho de glifo conservador.
const measure: Measure = (text, o) => {
  // Nunito y Bree Serif son anchas: se mide con un glifo generoso para no subestimar
  const k = o.fontFamily === 'Inter' ? 0.6 : 0.64;
  const cw = (c: string) => o.fontSize * k + o.letterSpacing + (c === ' ' ? -o.fontSize * 0.25 : 0);
  const wordW = (w: string) => [...w].reduce((a, c) => a + cw(c), 0);
  let lines = 0;
  let maxW = 0;
  for (const para of text.split('\n')) {
    if (!o.width) {
      lines++;
      maxW = Math.max(maxW, wordW(para));
      continue;
    }
    let line = '';
    for (const word of para.split(' ')) {
      const cand = line ? `${line} ${word}` : word;
      if (wordW(cand) > o.width && line) {
        lines++;
        maxW = Math.max(maxW, wordW(line));
        line = word;
      } else line = cand;
    }
    lines++;
    maxW = Math.max(maxW, wordW(line));
  }
  return { width: o.width ?? maxW, height: lines * o.fontSize * o.lineHeight };
};

const base = (over: Partial<LayoutInput> = {}): LayoutInput => ({
  width: 1080,
  height: 1350,
  safeTop: 0,
  safeBottom: 0,
  styleId: 'premium',
  variant: 0,
  photo: { assetId: 'photo', width: 4000, height: 3000 },
  companyLogo: { assetId: 'amola', width: 900, height: 300 },
  brandLogo: { assetId: 'sello', width: 600, height: 400 },
  companyName: 'AMOLA Germinados',
  brandName: 'Lentejas germinadas',
  brandColor: '#4673bb',
  primaryColor: '#4e8b3b',
  accentColor: '#e3b84f',
  machineType: 'Paquete 250 g',
  model: 'Lentejas germinadas',
  headline: 'Legumbres veloces, ¡listas para cocinar!',
  features: ['Libre de gluten', '100% natural, sin aditivos', 'Más fácil de digerir'],
  promo: 'Nuevas en tu dietética',
  contactMessage: 'Seguinos en @amola.germinados',
  phones: [
    { label: 'Pedidos', number: '249-4123456' },
    { label: 'Mayoristas', number: '249-4654321' },
    { label: 'Atención', number: '249-4000000' },
  ],
  highlightFirst: true,
  whatsapp: { number: '249-4123456' },
  qrUrl: 'https://www.amola.com.ar',
  includeCompanyLogo: true,
  includeBrandLogo: true,
  ...over,
});

const box = (e: DesignElement): Rect => ({ x: e.x, y: e.y, w: e.width, h: e.height });
const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Capas de contenido que no pueden pisarse entre sí */
const content = (els: DesignElement[]) =>
  els.filter((e) => e.type === 'text' || e.type === 'button' || e.type === 'qr' || (e.type === 'image' && (e.role === 'logo' || e.role === 'photo')));

const STYLES = ['premium', 'impacto', 'catalogo', 'redes', 'campana'] as const;
const combos = STYLES.flatMap((s) => [0, 1, 2].flatMap((v) => FORMATS.map((f) => ({ s, v, f }))));

describe('motor de composición', () => {
  it.each(combos)('$s v$v $f.id: márgenes, superposición, logos y teléfonos', ({ s, v, f }) => {
    const input = base({ styleId: s, variant: v, width: f.width, height: f.height, safeTop: f.safeTop, safeBottom: f.safeBottom });
    const { elements } = composeLayout(input, measure);
    const S = Math.min(f.width, f.height);
    const m = Math.round(S * 0.055);
    const top = Math.max(m, Math.round(f.height * f.safeTop));
    const bottom = f.height - Math.max(m, Math.round(f.height * f.safeBottom));

    // 1) márgenes de seguridad (la foto puede sangrar; el resto no)
    for (const e of content(elements)) {
      if (e.type === 'image' && e.role === 'photo') continue;
      expect(e.x, `${e.name} x`).toBeGreaterThanOrEqual(m - 1);
      expect(e.x + e.width, `${e.name} derecha`).toBeLessThanOrEqual(f.width - m + 1);
      expect(e.y, `${e.name} y`).toBeGreaterThanOrEqual(top - 1);
      expect(e.y + e.height, `${e.name} abajo`).toBeLessThanOrEqual(bottom + 1);
    }

    // 2) sin superposición entre textos, logos, botones, QR y la foto
    const c = content(elements);
    for (let i = 0; i < c.length; i++)
      for (let j = i + 1; j < c.length; j++) {
        const a = c[i];
        const b = c[j];
        const photoVsLogo =
          (a.type === 'image' && a.role === 'photo' && b.type === 'image' && b.role === 'logo') ||
          (b.type === 'image' && b.role === 'photo' && a.type === 'image' && a.role === 'logo');
        if (photoVsLogo) continue; // en foto a sangre, los logos van sobre la foto en un recuadro blanco
        const isPhoto = (e: DesignElement) => e.type === 'image' && e.role === 'photo';
        // Paisaje: la foto llega al borde; botón, logos, QR y contacto van sobre fondos sólidos. Titular y bajada nunca pisan la foto.
        const titleText = (e: DesignElement) => e.type === 'text' && ['headline', 'promo', 'model'].includes(e.role);
        if (s === 'campana' && ((isPhoto(a) && !titleText(b)) || (isPhoto(b) && !titleText(a)))) continue;
        expect(overlap(box(a), box(b)), `${a.name} ↔ ${b.name}`).toBeLessThanOrEqual(1);
      }

    // 3) logos con su proporción original
    for (const e of elements.filter((x): x is ImageEl => x.type === 'image' && x.role === 'logo')) {
      const ratio = e.assetId === 'amola' ? 3 : 1.5;
      expect(e.width / e.height).toBeCloseTo(ratio, 3);
    }

    // 4) teléfonos exactos
    const allText = elements.filter((e): e is TextEl => e.type === 'text').map(renderedText).join('\n');
    const buttons = elements.filter((e) => e.type === 'button').map((e) => (e as { label: string }).label).join('\n');
    for (const p of input.phones) expect(allText).toContain(p.number);
    expect(buttons).toContain('249-4123456');

    // 5) teléfonos en una línea, sin cortes, dentro de su ancho
    for (const t of elements.filter((e): e is TextEl => e.type === 'text' && e.role === 'phones')) {
      expect(t.wrap).toBe('none');
      for (const line of renderedText(t).split('\n')) {
        const w = measure(line, { fontFamily: t.fontFamily, fontStyle: t.fontStyle, fontSize: t.fontSize, lineHeight: 1, letterSpacing: t.letterSpacing }).width;
        expect(w, `${t.name}: "${line}"`).toBeLessThanOrEqual(t.width + 1);
      }
    }
    // 6) el botón de WhatsApp tiene lugar para el número completo
    for (const b of elements.filter((e) => e.type === 'button' && (e as { label: string }).label)) {
      const lw = measure((b as { label: string }).label, { fontFamily: 'Nunito', fontStyle: '700', fontSize: b.height * 0.36, lineHeight: 1, letterSpacing: 0 }).width;
      expect(lw + b.height * 1.41, b.name).toBeLessThanOrEqual(b.width + 1);
    }
  });

  it('no inventa beneficios: solo muestra los cargados', () => {
    const { elements } = composeLayout(base({ styleId: 'catalogo', features: ['Dato A'] }), measure);
    const feats = elements.find((e) => e.type === 'text' && e.role === 'features') as TextEl;
    expect(feats.text).toBe('•  Dato A');
    const icons = composeLayout(base({ styleId: 'impacto', width: 1080, height: 1920, features: ['Dato A', 'Dato B'] }), measure).elements;
    expect(icons.filter((e) => e.type === 'text' && e.role === 'features').map((e) => (e as TextEl).text)).toEqual(['Dato A', 'Dato B']);
  });

  it('sin beneficios no crea la capa', () => {
    const { elements } = composeLayout(base({ features: [] }), measure);
    expect(elements.some((e) => e.type === 'text' && e.role === 'features')).toBe(false);
  });

  it('sin logo de empresa usa el nombre en texto y avisa', () => {
    const { elements, warnings } = composeLayout(base({ companyLogo: undefined }), measure);
    expect(elements.some((e) => e.type === 'text' && e.text === 'AMOLA Germinados')).toBe(true);
    expect(warnings.join(' ')).toMatch(/logo de AMOLA/);
  });

  it('foto con proporción muy distinta: se muestra completa (contain) y nunca recortada de más', () => {
    const { elements } = composeLayout(base({ width: 1080, height: 1920, photo: { assetId: 'p', width: 5000, height: 2000 } }), measure);
    const photo = elements.find((e): e is ImageEl => e.type === 'image' && e.role === 'photo')!;
    expect(photo.fit).toBe('contain');
    expect(elements.some((e) => e.type === 'image' && e.blur > 0)).toBe(true);
  });

  it('foto de estudio (borde liso): extiende su color en vez de difuminar, sin avisos', () => {
    const cases = [
      { styleId: 'premium' as const, width: 1080, height: 1920, photo: { assetId: 'p', width: 2400, height: 1000, edge: '#fefefe' } },
      { styleId: 'campana' as const, width: 1080, height: 1350, photo: { assetId: 'p', width: 1000, height: 1000, edge: '#fefefe' } },
    ];
    for (const { styleId, ...over } of cases) {
      const { elements, warnings } = composeLayout(base({ styleId, ...over }), measure);
      expect(elements.some((e) => e.type === 'image' && e.blur > 0), styleId).toBe(false);
      expect(elements.some((e) => e.type === 'rect' && e.name === 'Fondo de la foto' && e.fill === '#fefefe'), styleId).toBe(true);
      expect(warnings.join(' '), styleId).not.toMatch(/difuminado/);
      const photo = elements.find((e): e is ImageEl => e.type === 'image' && e.role === 'photo')!;
      expect(photo.fit).toBe('contain'); // el producto entra entero
    }
  });

  it('cover solo cuando la pérdida de imagen es chica', () => {
    expect(coverLoss(4000, 3000, 1080, 810)).toBeCloseTo(0, 5);
    expect(coverLoss(5000, 2000, 1080, 1080)).toBeGreaterThan(MAX_COVER_LOSS);
  });

  it('QR inválido se omite con aviso', () => {
    const { elements, warnings } = composeLayout(base({ qrUrl: 'mi web' }), measure);
    expect(elements.some((e) => e.type === 'qr')).toBe(false);
    expect(warnings.join(' ')).toMatch(/QR/);
  });

  it('elige texto legible sobre el color de fondo', () => {
    expect(readableOn('#ffd400')).toBe('#141414');
    expect(readableOn('#1f3a1b')).toBe('#ffffff');
    expect(contrastRatio('#ffffff', '#1f3a1b')).toBeGreaterThan(4.5);
  });
});

describe('estilo Paisaje AMOLA', () => {
  it('titular en dos líneas y dos tipografías; color legible sobre el color de la línea', () => {
    const { elements } = composeLayout(base({ styleId: 'campana', headline: 'Recetas fáciles y ricas', promo: 'Nuevas en tu dietética' }), measure);
    const t1 = elements.find((e) => e.type === 'text' && e.role === 'headline') as TextEl;
    const t2 = elements.find((e) => e.type === 'text' && e.role === 'promo') as TextEl;
    expect(t1.fontFamily).toBe('Nunito');
    expect(t2.fontFamily).toBe('Bree Serif');
    const bg = (elements.find((e) => e.name === 'Fondo degradado') as { gradient: { from: string } }).gradient.from;
    expect(t1.fill).toBe('#ffffff'); // sobre el azul de Lentejas
    expect(t2.fill).not.toBe(t1.fill); // dos colores
    expect(contrastRatio(t2.fill, bg)).toBeGreaterThanOrEqual(3);
    expect(renderedText(t2)).toBe('Nuevas en tu dietética'); // sin mayúsculas forzadas: tono cercano
  });
  it('en fondos claros el titular usa tinta oscura (contraste suficiente)', () => {
    for (const v of [1, 2]) {
      const { elements } = composeLayout(base({ styleId: 'campana', variant: v }), measure);
      const bg = elements.find((e) => e.name === 'Fondo') as { fill: string };
      for (const t of elements.filter((e): e is TextEl => e.type === 'text' && ['headline', 'promo'].includes(e.role)))
        expect(contrastRatio(t.fill, bg.fill), `v${v} ${t.name}`).toBeGreaterThanOrEqual(3);
    }
  });
  it('líneas de color claro (Harinas) también quedan legibles', () => {
    const { elements } = composeLayout(base({ styleId: 'campana', variant: 0, brandColor: '#c2a182' }), measure);
    const t1 = elements.find((e) => e.type === 'text' && e.role === 'headline') as TextEl;
    expect(contrastRatio(t1.fill, '#c2a182')).toBeGreaterThanOrEqual(3);
  });
  it('usa la bajada si se carga', () => {
    const { elements } = composeLayout(base({ styleId: 'campana', subheadline: 'Germinadas durante 7 días' }), measure);
    expect(elements.some((e) => e.type === 'text' && e.text === 'Germinadas durante 7 días')).toBe(true);
  });
  it('etiqueta larga no invade el sello de la línea', () => {
    const { elements } = composeLayout(base({ styleId: 'campana', machineType: 'Caja para comercios con doce paquetes' }), measure);
    const badge = elements.find((e) => e.name === 'Etiqueta (fondo)')!;
    const logo = elements.find((e) => e.name === 'Sello de la línea (fondo)')!;
    expect(badge.x + badge.width).toBeLessThan(logo.x);
  });
  it('agrega formas orgánicas debajo del contenido', () => {
    const { elements } = composeLayout(base({ styleId: 'campana' }), measure);
    const firstContent = elements.findIndex((e) => e.type === 'text' || e.type === 'image');
    const blobs = elements.map((e, i) => [e, i] as const).filter(([e]) => e.name.startsWith('Forma orgánica'));
    expect(blobs.length).toBeGreaterThan(0);
    for (const [, i] of blobs) expect(i).toBeLessThan(firstContent);
  });
});

describe('identidad AMOLA en todos los estilos', () => {
  it('títulos con las tipografías de marca (Nunito / Bree Serif)', () => {
    for (const s of STYLES)
      for (const v of [0, 1, 2]) {
        const { elements } = composeLayout(base({ styleId: s, variant: v }), measure);
        for (const t of elements.filter((e): e is TextEl => e.type === 'text' && ['headline', 'model', 'promo'].includes(e.role)))
          expect(['Nunito', 'Bree Serif'], `${s} v${v} ${t.name}`).toContain(t.fontFamily);
      }
  });
  it('la línea no se imprime como texto: se expresa con su color', () => {
    const { elements } = composeLayout(base({ styleId: 'impacto', includeBrandLogo: false }), measure);
    expect(elements.some((e) => e.type === 'text' && e.text.includes('Lentejas germinadas ·'))).toBe(false);
    expect((elements.find((e) => e.name === 'Fondo') as { fill: string }).fill).toBe('#4673bb');
  });
  it('los sellos de beneficio usan el ícono de hoja', () => {
    const { elements } = composeLayout(base({ styleId: 'impacto', width: 1080, height: 1920 }), measure);
    const icons = elements.filter((e) => e.type === 'button' && e.name.startsWith('Ícono beneficio'));
    expect(icons.length).toBe(3);
    for (const i of icons) expect((i as { icon: string }).icon).toBe('leaf');
  });
});

describe('color de borde de la foto', () => {
  const img = (w: number, h: number, f: (x: number, y: number) => [number, number, number]) => {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set([...f(x, y), 255], (y * w + x) * 4);
    return d;
  };
  it('fondo blanco de estudio → devuelve el color', () => {
    const d = img(32, 32, (x, y) => (x > 8 && x < 24 && y > 8 && y < 24 ? [120, 60, 20] : [250, 250, 248]));
    expect(uniformEdgeColor(d, 32, 32)).toBe('#fafaf8');
  });
  it('foto de escena (borde variado) → null', () => {
    const d = img(32, 32, (x, y) => [(x * 37) % 255, (y * 53) % 255, ((x + y) * 19) % 255]);
    expect(uniformEdgeColor(d, 32, 32)).toBeNull();
  });
});
