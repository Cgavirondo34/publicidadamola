// ─────────────────────────────────────────────────────────────
// Modelo de datos de AMOLA Estudio
// Regla de diseño: cada pieza es una lista de CAPAS independientes.
// La foto es una capa; logos, textos y teléfonos son capas separadas.
//
// Nota de dominio: el modelo nació en una app de maquinaria y conserva algunos nombres
// internos para que el motor no cambie. En AMOLA significan:
//   Brand        → Línea de producto (Lentejas, Porotos negros, Arvejas, Harinas…)
//   model        → Producto ("Lentejas germinadas"), el nombre grande de la pieza
//   machineType  → Presentación ("Paquete 250 g"), la etiqueta chica
//   features     → Beneficios (solo claims respaldados por el manual de marca)
// ─────────────────────────────────────────────────────────────

export type ID = string;

/** Archivo binario (foto, logo) guardado en IndexedDB, nunca modificado. */
export interface Asset {
  id: ID;
  kind: 'photo' | 'logo';
  name: string;
  mime: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
}

export interface Brand {
  id: ID;
  name: string;
  logoAssetId?: ID;
  colors: string[]; // hex
  categories: string[];
  info: string;
  createdAt: number;
}

export interface Phone {
  id: ID;
  label: string; // "Pedidos", "Mayoristas", "Atención"
  number: string; // se muestra EXACTAMENTE como está escrito
  whatsapp: boolean;
}

export interface CompanySettings {
  id: 'company';
  name: string;
  activity: string;
  logoAssetId?: ID;
  phones: Phone[];
  contactMessage: string;
  website: string;
  primaryColor: string;
  accentColor: string;
  // ── Datos para presupuestos (opcionales: instalaciones anteriores no los tienen) ──
  address?: string; // calle y número
  city?: string; // localidad y provincia
  cuit?: string;
  ivaCondition?: string;
  email?: string;
  /** enlace de Google Maps a la sucursal: se muestra en el PDF como "Cómo llegar" */
  mapsUrl?: string;
  quoteValidDays?: number;
  /** número mínimo para el próximo presupuesto (para separar rangos entre equipos) */
  quoteNextNumber?: number;
  quotePaymentTerms?: string;
  quoteDeliveryTerms?: string;
  quoteFooter?: string;
  /** versión del catálogo de líneas ya cargado (para sumar líneas nuevas sin duplicar) */
  brandCatalogVersion?: number;
}

// ── Capas ──────────────────────────────────────────────────
export type Fit = 'cover' | 'contain';

interface BaseEl {
  id: ID;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export interface ImageEl extends BaseEl {
  type: 'image';
  role: 'photo' | 'logo' | 'image';
  assetId: ID;
  /** cover = llena el marco recortando; contain = entra completa. Nunca se deforma. */
  fit: Fit;
  brightness: number; // -1..1
  contrast: number; // -100..100
  saturation: number; // -2..10 (HSL de Konva)
  /** recorte (0..1) relativo a la imagen original — solo para fotos */
  focusX: number;
  focusY: number;
  shadow: boolean;
  /** desenfoque (0 = nítida). Se usa en el fondo difuminado, nunca en el producto. */
  blur: number;
  cornerRadius: number;
}

export interface TextEl extends BaseEl {
  type: 'text';
  role: 'headline' | 'model' | 'brandline' | 'features' | 'promo' | 'phones' | 'contact' | 'company' | 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  /** 'normal' | 'bold' | 'italic' o peso numérico ('500', '800'...) */
  fontStyle: string;
  fill: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
  uppercase: boolean;
  shadow: boolean;
  /** 'none' = nunca partir líneas (teléfonos). Por defecto 'word'. */
  wrap?: 'word' | 'none';
}

export interface Gradient {
  from: string; // color con alpha (rgba)
  to: string;
  angle: number; // 0 = de arriba (from) hacia abajo (to); 90 = izq→der
}

export interface ShapeEl extends BaseEl {
  type: 'rect';
  role: 'background' | 'overlay' | 'panel' | 'band' | 'accent' | 'shape';
  fill: string;
  gradient?: Gradient;
  cornerRadius: number;
  stroke: string;
  strokeWidth: number;
}

export interface ButtonEl extends BaseEl {
  type: 'button';
  role: 'whatsapp' | 'phone' | 'cta';
  label: string;
  fill: string;
  textColor: string;
  fontFamily: string;
  icon: 'chat' | 'phone' | 'check' | 'leaf' | 'none';
  cornerRadius: number;
}

export interface QrEl extends BaseEl {
  type: 'qr';
  value: string;
  fill: string;
  background: string;
}

export type DesignElement = ImageEl | TextEl | ShapeEl | ButtonEl | QrEl;

// ── Proyecto ───────────────────────────────────────────────
export type StyleId = 'premium' | 'impacto' | 'catalogo' | 'redes' | 'campana' | 'ia';

/** Datos de entrada: permiten regenerar la pieza en otro formato o variante. */
export interface DesignInput {
  photoAssetIds: ID[];
  brandId?: ID;
  machineType: string;
  model: string;
  headline: string;
  features: string[];
  promo: string;
  /** bajada bajo el titular (ej.: "Germinadas durante 7 días") — opcional */
  subheadline?: string;
  phoneIds: ID[];
  highlightPhoneId?: ID;
  showWhatsApp: boolean;
  whatsappPhoneId?: ID;
  qrUrl: string;
  contactMessage: string;
  includeCompanyLogo: boolean;
  includeBrandLogo: boolean;
}

export interface Project {
  id: ID;
  name: string;
  formatId: string;
  width: number;
  height: number;
  styleId: StyleId;
  variant: number;
  input: DesignInput;
  elements: DesignElement[];
  thumbnail?: string; // dataURL pequeño
  createdAt: number;
  updatedAt: number;
}
