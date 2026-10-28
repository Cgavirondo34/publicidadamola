import { useEffect, useState } from 'react';
import { db, newId } from './db';
import type { Asset } from '../types';

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const LOGO_TYPES = ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'];
export const MAX_PHOTO_MB = 15;
export const MAX_LOGO_MB = 5;

export class AssetError extends Error {}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AssetError('El archivo no es una imagen válida o está dañado.'));
    };
    img.src = url;
  });
}

/**
 * Un SVG sin width/height explícitos se dibuja con tamaño 0 en algunos navegadores.
 * Solo se agregan esos dos atributos tomados del viewBox: el dibujo NO se modifica.
 */
async function normalizeSvg(file: Blob): Promise<Blob> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) {
    throw new AssetError('El SVG no es válido.');
  }
  // Seguridad: un SVG puede traer scripts. Se descartan los <script> y atributos on*.
  doc.querySelectorAll('script').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((a) => {
      if (a.name.toLowerCase().startsWith('on')) el.removeAttribute(a.name);
    });
  });
  const hasW = svg.getAttribute('width') && !svg.getAttribute('width')!.includes('%');
  const hasH = svg.getAttribute('height') && !svg.getAttribute('height')!.includes('%');
  const vb = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
  if ((!hasW || !hasH) && vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    const scale = 1000 / Math.max(vb[2], vb[3]); // tamaño intrínseco cómodo para rasterizar nítido
    svg.setAttribute('width', String(Math.round(vb[2] * scale)));
    svg.setAttribute('height', String(Math.round(vb[3] * scale)));
  }
  return new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' });
}

export async function saveAsset(file: File, kind: Asset['kind']): Promise<Asset> {
  const allowed = kind === 'photo' ? PHOTO_TYPES : LOGO_TYPES;
  const maxMb = kind === 'photo' ? MAX_PHOTO_MB : MAX_LOGO_MB;
  if (!allowed.includes(file.type)) {
    throw new AssetError(
      `Formato no admitido (${file.type || 'desconocido'}). Usá ${kind === 'photo' ? 'JPG, PNG o WebP' : 'PNG, SVG o WebP'}.`,
    );
  }
  if (file.size > maxMb * 1024 * 1024) {
    throw new AssetError(`El archivo supera ${maxMb} MB.`);
  }
  const blob = file.type === 'image/svg+xml' ? await normalizeSvg(file) : file;
  const img = await loadImageFromBlob(blob);
  URL.revokeObjectURL(img.src);
  if (!img.naturalWidth || !img.naturalHeight) throw new AssetError('No se pudo leer el tamaño de la imagen.');
  if (kind === 'photo' && Math.min(img.naturalWidth, img.naturalHeight) < 400) {
    throw new AssetError('La foto es muy chica (mínimo 400 px de lado). Va a verse pixelada al exportar.');
  }
  const asset: Asset = {
    id: newId(),
    kind,
    name: file.name,
    mime: blob.type,
    blob,
    width: img.naturalWidth,
    height: img.naturalHeight,
    createdAt: Date.now(),
  };
  await db.assets.put(asset);
  return asset;
}

// ── Caché de imágenes decodificadas por assetId ─────────────
const cache = new Map<string, Promise<HTMLImageElement>>();

export function loadAssetImage(assetId: string): Promise<HTMLImageElement> {
  let p = cache.get(assetId);
  if (!p) {
    p = (async () => {
      const asset = await db.assets.get(assetId);
      if (!asset) throw new AssetError('Archivo no encontrado');
      return loadImageFromBlob(asset.blob);
    })();
    p.catch(() => cache.delete(assetId));
    cache.set(assetId, p);
  }
  return p;
}

export function useAssetImage(assetId?: string): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement>();
  useEffect(() => {
    let alive = true;
    setImg(undefined);
    if (assetId) loadAssetImage(assetId).then((i) => alive && setImg(i)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [assetId]);
  return img;
}

export function useAssetUrl(assetId?: string): string | undefined {
  const img = useAssetImage(assetId);
  return img?.src;
}

export async function getAssetSize(assetId: string): Promise<{ width: number; height: number }> {
  const a = await db.assets.get(assetId);
  return a ? { width: a.width, height: a.height } : { width: 1, height: 1 };
}

// ── Color de borde de la foto ────────────────────────────────
// Las fotos de producto de AMOLA suelen estar sobre fondo blanco o liso. Si el borde de la foto
// es un color parejo, el motor extiende ESE color alrededor de la foto (queda "flotando", sin cortes)
// en lugar de usar la foto difuminada. La foto en sí nunca se modifica.

/** Promedio del anillo exterior de píxeles; null si el borde no es parejo (foto de escena). */
export function uniformEdgeColor(data: Uint8ClampedArray, w: number, h: number, ring = 2, maxStd = 14): string | null {
  const px: [number, number, number][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (x >= ring && x < w - ring && y >= ring && y < h - ring) continue;
      const i = (y * w + x) * 4;
      if (data[i + 3] < 200) continue; // transparente: no cuenta
      px.push([data[i], data[i + 1], data[i + 2]]);
    }
  if (px.length < 8) return null;
  const mean = [0, 1, 2].map((c) => px.reduce((a, p) => a + p[c], 0) / px.length);
  const std = Math.max(...[0, 1, 2].map((c) => Math.sqrt(px.reduce((a, p) => a + (p[c] - mean[c]) ** 2, 0) / px.length)));
  if (std > maxStd) return null;
  return `#${mean.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

const edgeCache = new Map<string, Promise<string | null>>();
export function getEdgeColor(assetId: string): Promise<string | null> {
  let p = edgeCache.get(assetId);
  if (!p) {
    p = loadAssetImage(assetId)
      .then((img) => {
        const S = 64;
        const c = document.createElement('canvas');
        c.width = S;
        c.height = S;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, S, S);
        return uniformEdgeColor(ctx.getImageData(0, 0, S, S).data, S, S);
      })
      .catch(() => null);
    edgeCache.set(assetId, p);
  }
  return p;
}
