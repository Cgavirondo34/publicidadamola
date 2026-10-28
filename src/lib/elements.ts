import { nanoid } from 'nanoid';
import type { ButtonEl, ImageEl, QrEl, ShapeEl, TextEl } from '../types';

const base = (name: string) => ({
  id: nanoid(10),
  name,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
});

export const makeRect = (p: Partial<ShapeEl> = {}): ShapeEl => ({
  ...base('Forma'),
  type: 'rect',
  role: 'shape',
  fill: '#e0a12e',
  cornerRadius: 0,
  stroke: '',
  strokeWidth: 0,
  ...p,
});

export const makeText = (p: Partial<TextEl> = {}): TextEl => ({
  ...base('Texto'),
  type: 'text',
  role: 'text',
  text: 'Texto',
  fontFamily: 'Nunito',
  fontSize: 48,
  fontStyle: '700',
  fill: '#ffffff',
  align: 'left',
  lineHeight: 1.15,
  letterSpacing: 0,
  uppercase: false,
  shadow: false,
  ...p,
});

export const makeImage = (p: Partial<ImageEl> & Pick<ImageEl, 'assetId'>): ImageEl => ({
  ...base('Imagen'),
  type: 'image',
  role: 'image',
  fit: 'contain',
  brightness: 0,
  contrast: 0,
  saturation: 0,
  focusX: 0.5,
  focusY: 0.5,
  shadow: false,
  blur: 0,
  cornerRadius: 0,
  ...p,
});

export const makeButton = (p: Partial<ButtonEl> = {}): ButtonEl => ({
  ...base('Botón'),
  type: 'button',
  role: 'cta',
  label: 'Consultanos',
  fill: '#25D366',
  textColor: '#ffffff',
  fontFamily: 'Nunito',
  icon: 'chat',
  cornerRadius: 999,
  ...p,
});

export const makeQr = (p: Partial<QrEl> = {}): QrEl => ({
  ...base('Código QR'),
  type: 'qr',
  value: 'https://',
  fill: '#111111',
  background: '#ffffff',
  ...p,
});

// ── Utilidades de color ──────────────────────────────────────
export function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

/** Luminancia relativa WCAG */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Texto blanco o casi negro según cuál se lea mejor sobre el fondo. */
export function readableOn(bg: string, dark = '#141414', light = '#ffffff'): string {
  return contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark;
}
