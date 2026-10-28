// ─────────────────────────────────────────────────────────────
// Control de claims según el Manual de Marca AMOLA.
// "No se deben crear ni comunicar beneficios nutricionales, certificaciones,
//  ingredientes, claims científicos o comparaciones que no estén respaldados
//  por la documentación de marca o las fichas técnicas del producto."
//
// Esto NO bloquea nada: avisa antes de publicar para que alguien lo confirme.
// Función pura, sin DOM (se testea en tests/claims.test.ts).
// ─────────────────────────────────────────────────────────────

/** Claims permitidos por el manual (respaldados por la documentación de marca). */
export const ALLOWED_CLAIMS = [
  '100% natural, sin aditivos',
  'Libre de gluten',
  'Más fácil de digerir',
  'Nutrientes más disponibles',
  'Menos antinutrientes',
  'Listas para cocinar',
  'Industria Argentina',
];

/** Territorio de mensaje del manual: titulares sugeridos. */
export const HEADLINE_SUGGESTIONS = [
  'Legumbres veloces, ¡listas para cocinar!',
  'Recetas fáciles y ricas',
  'Del grano al superalimento',
  'Comer bien no tiene que ser complicado',
  'Alimentos reales, todos los días',
  'Germinadas con paciencia: 7 días',
];

export type ClaimKind = 'salud' | 'certificacion' | 'nutricional' | 'comparacion' | 'exageracion' | 'tono';

export interface ClaimIssue {
  kind: ClaimKind;
  /** fragmento exacto que disparó el aviso */
  match: string;
  /** campo donde apareció (titular, beneficio 2, promoción…) */
  field: string;
  message: string;
}

/** Palabra completa con límites Unicode (\b de JS no reconoce tildes ni ñ). */
const word = (src: string) => new RegExp(`(?<![\\p{L}\\d])(?:${src})(?![\\p{L}\\d])`, 'iu');

const RULES: { kind: ClaimKind; re: RegExp; message: string }[] = [
  {
    kind: 'salud',
    re: word('cura[rn]?|sanar|previene[n]?|prevenir|tratamiento|enfermedad(es)?|diabetes|colesterol|c[aá]ncer|presi[oó]n arterial|inmun\\p{L}*|antiinflamatori\\p{L}*|desinflama\\p{L}*'),
    message: 'Promesa de salud. El manual prohíbe beneficios de salud no comprobados y el tono médico o clínico.',
  },
  {
    kind: 'salud',
    re: word('adelgaz\\p{L}*|bajar de peso|quemar? grasas?|detox|desintoxica\\p{L}*|depurativ\\p{L}*'),
    message: 'Promesa de descenso de peso o "detox": no está respaldada por la documentación de marca.',
  },
  {
    kind: 'certificacion',
    re: word('org[aá]nic[oa]s?|agroecol[oó]gic[oa]s?|certificad[oa]s?|sin\\s+tacc|vegan[oa]s?|kosher|no\\s*gmo|libres? de transg[eé]nicos|sin agrot[oó]xicos'),
    message: 'Certificación o atributo no documentado. Confirmalo con la ficha técnica antes de publicar (en el packaging figura "Libre de gluten").',
  },
  {
    kind: 'nutricional',
    re: word('(alt[oa]s? en|ric[oa]s? en|fuente de|aporta|contiene)\\s+(prote[ií]n\\p{L}*|fibras?|hierro|calcio|zinc|magnesio|vitamina\\p{L}*|omega\\p{L}*)'),
    message: 'Dato nutricional: tiene que salir de la ficha técnica del producto.',
  },
  {
    kind: 'nutricional',
    re: word('\\d+([.,]\\d+)?\\s*(g|mg|kcal|calor[ií]as)\\s+(de\\s+)?(prote[ií]n\\p{L}*|fibras?|hierro|calcio|az[uú]car\\p{L}*|grasas?)'),
    message: 'Cifra nutricional: verificala contra la ficha técnica.',
  },
  {
    kind: 'comparacion',
    re: word('\\d+\\s*(veces|x)\\s+m[aá]s|el\\s+doble|el\\s+triple'),
    message: 'Comparación numérica: el manual solo respalda "más digestible / nutrientes más disponibles" frente al grano no germinado, sin cifras.',
  },
  {
    kind: 'comparacion',
    re: word('(el|la|los|las)\\s+mejor(es)?|[uú]nic[oa]s?|n[°º.]?\\s?1|n[uú]mero uno|l[ií]der(es)?'),
    message: 'Comparación absoluta ("el mejor", "único", "n.º 1"): no está respaldada.',
  },
  {
    kind: 'exageracion',
    re: word('milagros\\p{L}*|m[aá]gic[oa]s?|garantiza\\p{L}*|100\\s*%\\s*(saludable|efectiv\\p{L}*|nutritiv\\p{L}*)'),
    message: 'Exageración. La voz AMOLA es positiva "sin exagerar".',
  },
];

/** Porcentajes que no sean el "100% natural" del manual. */
const PERCENT = /(?<![\p{L}\d])\d+([.,]\d+)?\s*%\s*(\p{L}+)?/giu;
const OK_PERCENT = /^100\s*%\s*(natural(es)?)?$/i;
/** Promociones con porcentaje ("20% off", "15% de descuento") son comerciales, no claims. */
const PROMO_WORDS = /^(off|de|descuento|dto|menos|bonificaci[oó]n|recargo)$/i;

/**
 * Revisa los textos de una pieza y devuelve los fragmentos que conviene confirmar.
 * `fields` = [nombre del campo, texto].
 */
export function checkClaims(fields: [field: string, text: string][]): ClaimIssue[] {
  const out: ClaimIssue[] = [];
  for (const [field, raw] of fields) {
    const text = raw ?? '';
    if (!text.trim()) continue;
    for (const r of RULES) {
      const m = text.match(r.re);
      if (m) out.push({ kind: r.kind, match: m[0], field, message: r.message });
    }
    for (const m of text.matchAll(PERCENT)) {
      const word = m[2] ?? '';
      if (OK_PERCENT.test(m[0].trim()) || PROMO_WORDS.test(word)) continue;
      out.push({ kind: 'nutricional', match: m[0].trim(), field, message: 'Porcentaje: si es un dato nutricional o de proceso, tiene que salir de la ficha técnica.' });
    }
    // tono: todo en mayúsculas y signos repetidos suenan a "grito" de marketing
    const letters = text.replace(/[^\p{L}]/gu, '');
    if (letters.length >= 12 && letters === letters.toLocaleUpperCase('es-AR')) {
      out.push({ kind: 'tono', match: text.trim().slice(0, 30), field, message: 'Todo en mayúsculas: la voz AMOLA es cercana; usá mayúsculas solo al inicio.' });
    }
    const bang = text.match(/[!¡?¿]{3,}/);
    if (bang) out.push({ kind: 'tono', match: bang[0], field, message: 'Signos repetidos: suenan a marketing genérico.' });
  }
  return out;
}
