export interface FormatDef {
  id: string;
  label: string;
  group: string;
  width: number;
  height: number;
  /** zonas superior/inferior donde Instagram/WhatsApp tapan la imagen (proporción del alto) */
  safeTop: number;
  safeBottom: number;
}

export const FORMATS: FormatDef[] = [
  { id: 'ig-square', label: 'Instagram cuadrado', group: 'Instagram', width: 1080, height: 1080, safeTop: 0, safeBottom: 0 },
  { id: 'ig-portrait', label: 'Instagram vertical', group: 'Instagram', width: 1080, height: 1350, safeTop: 0, safeBottom: 0 },
  { id: 'ig-story', label: 'Instagram Stories', group: 'Instagram', width: 1080, height: 1920, safeTop: 0.11, safeBottom: 0.12 },
  { id: 'wa-status', label: 'Estado de WhatsApp', group: 'WhatsApp', width: 1080, height: 1920, safeTop: 0.09, safeBottom: 0.1 },
  { id: 'fb-landscape', label: 'Facebook horizontal', group: 'Facebook', width: 1200, height: 630, safeTop: 0, safeBottom: 0 },
  { id: 'catalog', label: 'Catálogo horizontal', group: 'Catálogo', width: 1920, height: 1080, safeTop: 0, safeBottom: 0 },
];

export const CUSTOM_FORMAT_ID = 'custom';

export function getFormat(id: string, width?: number, height?: number): FormatDef {
  const f = FORMATS.find((x) => x.id === id);
  if (f) return f;
  return {
    id: CUSTOM_FORMAT_ID,
    label: 'Personalizado',
    group: 'Personalizado',
    width: width ?? 1080,
    height: height ?? 1080,
    safeTop: 0,
    safeBottom: 0,
  };
}

export const MIN_CUSTOM = 300;
export const MAX_CUSTOM = 4096;
