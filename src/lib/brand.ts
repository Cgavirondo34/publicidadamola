// ─────────────────────────────────────────────────────────────
// Identidad AMOLA (Manual de Marca v1.0, septiembre 2026).
// Los HEX son los relevados del packaging; el manual los marca "a validar"
// contra la guía oficial. Si cambian, se actualizan solo acá.
// ─────────────────────────────────────────────────────────────

export const AMOLA = {
  verde: '#4e8b3b', // logo, salud, natural
  verdeOscuro: '#2b4a23',
  terracota: '#8c1f14', // wordmark en kraft
  naranja: '#bc5534', // línea Porotos negros
  azul: '#4673bb', // línea Lentejas
  mostaza: '#e3b84f', // piezas estacionales
  arena: '#c2a182', // fondos, packaging harinas
  crema: '#f6efe4',
  tinta: '#2a211a',
};

/** Muestras rápidas para los selectores de color (nombre del manual + HEX). */
export const BRAND_SWATCHES: [name: string, hex: string][] = [
  ['Verde Amola', AMOLA.verde],
  ['Rojo Terracota', AMOLA.terracota],
  ['Azul (Lentejas)', AMOLA.azul],
  ['Naranja Poroto', AMOLA.naranja],
  ['Mostaza', AMOLA.mostaza],
  ['Crema / Arena', AMOLA.arena],
  ['Crema claro', AMOLA.crema],
  ['Blanco', '#ffffff'],
  ['Tinta', AMOLA.tinta],
];
