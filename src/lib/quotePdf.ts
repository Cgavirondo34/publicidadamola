// ─────────────────────────────────────────────────────────────
// PDF del presupuesto (A4). Texto real y seleccionable, no una captura.
// buildQuotePdf es independiente del navegador: recibe las imágenes ya
// convertidas a PNG, así también se puede probar en Node.
// ─────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf';
import type { CompanySettings } from '../types';
import {
  addDays, formatDate, formatMoney, formatNumber, formatQty, normalizeCuit, quoteTotals, type Quote,
} from './quotes';

export interface PdfImage {
  data: string; // data URL PNG/JPEG
  width: number;
  height: number;
}

export interface QuotePdfInput {
  quote: Quote;
  company: CompanySettings;
  logo?: PdfImage;
  /** sellos de las líneas que aparecen en los ítems (archivos originales; solo las que tienen archivo) */
  brandLogos?: (PdfImage & { name: string })[];
  brandNames?: Record<string, string>;
  /** false solo para pruebas: deja el texto legible dentro del archivo */
  compress?: boolean;
}

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14; // margen
const CONTENT_W = PAGE_W - 2 * M;
const FOOTER_H = 22;

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(/^[0-9a-f]{6}$/i.test(full) ? full : '262626', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function fit(img: PdfImage, maxW: number, maxH: number) {
  const r = img.width / img.height;
  let w = maxW;
  let h = w / r;
  if (h > maxH) {
    h = maxH;
    w = h * r;
  }
  return { w, h };
}

export function buildQuotePdf({ quote: q, company: c, logo, brandLogos = [], brandNames = {}, compress = true }: QuotePdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress });
  const dark = rgb(c.primaryColor || '#262626');
  const accent = rgb(c.accentColor || '#94c83c');
  const grey: [number, number, number] = [100, 100, 100];
  const totals = quoteTotals(q.items);
  const items = q.items.map((it, i) => ({ it, t: totals.lines[i] })).filter(({ it }) => it.description.trim());
  const money = (cents: number) => formatMoney(cents, q.currency);

  doc.setProperties({
    title: `Presupuesto ${formatNumber(q.number)} - ${q.client.name}`,
    subject: 'Presupuesto',
    author: c.name,
    creator: 'AMOLA Estudio',
  });

  const text = (s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'right' | 'center'; maxW?: number } = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
    doc.setFontSize(o.size ?? 9);
    doc.setTextColor(...(o.color ?? [30, 30, 30]));
    const lines = o.maxW ? (doc.splitTextToSize(s, o.maxW) as string[]) : [s];
    doc.text(lines, x, y, { align: o.align ?? 'left', baseline: 'top' });
    return lines.length * (o.size ?? 9) * 0.3528 * 1.18; // alto ocupado en mm
  };

  // ── Encabezado ──────────────────────────────────────────
  let y = M;
  const leftW = 112;
  if (logo) {
    const { w, h } = fit(logo, 46, 26);
    doc.addImage(logo.data, 'PNG', M, y, w, h, undefined, 'SLOW');
    y += h + 4;
  } else {
    y += text(c.name, M, y, { size: 14, bold: true, maxW: leftW }) + 2;
  }
  const companyLines = [
    logo ? c.name : '',
    [c.address, c.city].filter((s) => s?.trim()).join(' · '),
    [c.cuit?.trim() ? `CUIT ${normalizeCuit(c.cuit).value}` : '', c.ivaCondition?.trim() ?? ''].filter(Boolean).join(' · '),
    c.phones.map((p) => `${p.label} ${p.number}`).join('   '),
    [c.email, c.website].filter((s) => s?.trim()).join(' · '),
  ].filter((s) => s.trim());
  companyLines.forEach((line, i) => {
    y += text(line, M, y, { size: i === 0 && logo ? 9.5 : 8.5, bold: i === 0 && !!logo, color: i === 0 ? [30, 30, 30] : grey, maxW: leftW });
  });
  if (/^https:\/\//.test(c.mapsUrl?.trim() ?? '')) {
    // enlace clicable a la ubicación de la sucursal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...accent.map((v) => Math.round(v * 0.62)) as [number, number, number]);
    doc.textWithLink('Cómo llegar: ver ubicación en Google Maps', M, y + 3, { url: c.mapsUrl!.trim() });
    y += 4.4;
  }
  const headerBottom = y;

  // Recuadro de número a la derecha
  const boxW = 64;
  const bx = PAGE_W - M - boxW;
  doc.setFillColor(...dark);
  doc.roundedRect(bx, M, boxW, 34, 2, 2, 'F');
  text('PRESUPUESTO', bx + boxW / 2, M + 4, { size: 13, bold: true, color: [255, 255, 255], align: 'center' });
  text(`Nº ${formatNumber(q.number)}`, bx + boxW / 2, M + 11, { size: 11, bold: true, color: accent, align: 'center' });
  text(`Fecha: ${formatDate(q.date)}`, bx + boxW / 2, M + 19, { size: 8.5, color: [235, 235, 235], align: 'center' });
  text(`Válido hasta: ${formatDate(addDays(q.date, q.validDays))}`, bx + boxW / 2, M + 24.5, { size: 8.5, color: [235, 235, 235], align: 'center' });

  y = Math.max(headerBottom, M + 34) + 4;
  doc.setFillColor(...accent);
  doc.rect(M, y, CONTENT_W, 1.2, 'F');
  y += 5;

  // ── Cliente ────────────────────────────────────────────
  const cl = q.client;
  const clientRows: [string, string][] = [
    ['Cliente', cl.name],
    ['CUIT', cl.cuit.trim() ? normalizeCuit(cl.cuit).value : ''],
    ['Condición IVA', cl.ivaCondition],
    ['Domicilio', cl.address],
    ['Teléfono', cl.phone],
    ['Email', cl.email],
  ].filter(([, v]) => v.trim()) as [string, string][];
  const colW = CONTENT_W / 2;
  const rowsPerCol = Math.ceil(clientRows.length / 2);
  const clientH = Math.max(1, rowsPerCol) * 5.2 + 6;
  doc.setFillColor(246, 246, 243);
  doc.roundedRect(M, y, CONTENT_W, clientH, 1.5, 1.5, 'F');
  clientRows.forEach(([k, v], i) => {
    const col = i < rowsPerCol ? 0 : 1;
    const row = col === 0 ? i : i - rowsPerCol;
    const x = M + 4 + col * colW;
    const yy = y + 3.2 + row * 5.2;
    text(`${k}:`, x, yy, { size: 8, color: grey });
    text(v, x + 24, yy, { size: 9, bold: k === 'Cliente', maxW: colW - 30 });
  });
  y += clientH + 6;

  // ── Tabla de ítems ─────────────────────────────────────
  const showIva = q.showIva;
  // columnas: x de inicio y ancho
  const cols = showIva
    ? { n: [M, 8], desc: [M + 8, 78], qty: [M + 86, 14], unit: [M + 100, 28], disc: [M + 128, 14], iva: [M + 142, 13], sub: [M + 155, 27] }
    : { n: [M, 8], desc: [M + 8, 92], qty: [M + 100, 14], unit: [M + 114, 30], disc: [M + 144, 14], iva: [0, 0], sub: [M + 158, 24] };
  const bottomLimit = PAGE_H - M - FOOTER_H;

  const drawHead = () => {
    doc.setFillColor(...dark);
    doc.rect(M, y, CONTENT_W, 7, 'F');
    const hy = y + 1.9;
    const w = [255, 255, 255] as [number, number, number];
    text('#', cols.n[0] + 2, hy, { size: 8, bold: true, color: w });
    text('Descripción', cols.desc[0] + 1, hy, { size: 8, bold: true, color: w });
    text('Cant.', cols.qty[0] + cols.qty[1] - 1, hy, { size: 8, bold: true, color: w, align: 'right' });
    text(showIva ? 'P. unit. neto' : 'P. unitario', cols.unit[0] + cols.unit[1] - 1, hy, { size: 8, bold: true, color: w, align: 'right' });
    text('Bonif.', cols.disc[0] + cols.disc[1] - 1, hy, { size: 8, bold: true, color: w, align: 'right' });
    if (showIva) text('IVA', cols.iva[0] + cols.iva[1] - 1, hy, { size: 8, bold: true, color: w, align: 'right' });
    text(showIva ? 'Subtotal neto' : 'Subtotal', cols.sub[0] + cols.sub[1] - 1, hy, { size: 8, bold: true, color: w, align: 'right' });
    y += 7;
  };
  drawHead();

  items.forEach(({ it, t }, idx) => {
    const brand = it.brandId ? brandNames[it.brandId] : '';
    const title = it.description.trim();
    const detail = [brand ? `Línea: ${brand}` : '', it.detail.trim()].filter(Boolean).join(' · ');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const tLines = doc.splitTextToSize(title, cols.desc[1] - 2) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const dLines = detail ? (doc.splitTextToSize(detail, cols.desc[1] - 2) as string[]) : [];
    const rowH = Math.max(7, tLines.length * 3.8 + dLines.length * 3.2 + 3.4);
    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = M;
      drawHead();
    }
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 247);
      doc.rect(M, y, CONTENT_W, rowH, 'F');
    }
    const ry = y + 1.8;
    // precio unitario mostrado: neto o con IVA según el modo
    const unitCents = Math.round(it.unitPrice * 100 * (showIva ? 1 : 1 + it.ivaRate / 100));
    text(String(idx + 1), cols.n[0] + 2, ry, { size: 8.5, color: grey });
    text(tLines.join('\n'), cols.desc[0] + 1, ry, { size: 9, bold: true });
    if (dLines.length) text(dLines.join('\n'), cols.desc[0] + 1, ry + tLines.length * 3.8, { size: 7.5, color: grey });
    text(formatQty(it.quantity), cols.qty[0] + cols.qty[1] - 1, ry, { size: 9, align: 'right' });
    text(money(unitCents), cols.unit[0] + cols.unit[1] - 1, ry, { size: 9, align: 'right' });
    text(it.discountPct ? `${formatQty(it.discountPct)} %` : '-', cols.disc[0] + cols.disc[1] - 1, ry, { size: 9, align: 'right', color: it.discountPct ? [30, 30, 30] : grey });
    if (showIva) text(`${formatQty(it.ivaRate)} %`, cols.iva[0] + cols.iva[1] - 1, ry, { size: 9, align: 'right' });
    text(money(showIva ? t.net : t.total), cols.sub[0] + cols.sub[1] - 1, ry, { size: 9, bold: true, align: 'right' });
    y += rowH;
    doc.setDrawColor(225, 225, 220);
    doc.setLineWidth(0.2);
    doc.line(M, y, M + CONTENT_W, y);
  });

  // ── Totales ────────────────────────────────────────────
  const totRows: [string, string, boolean?][] = [];
  if (showIva) {
    if (totals.discount) {
      totRows.push(['Subtotal', money(totals.gross)]);
      totRows.push(['Bonificaciones', `- ${money(totals.discount)}`]);
    }
    totRows.push(['Neto', money(totals.net)]);
    totals.ivaByRate.forEach((r) => totRows.push([`IVA ${formatQty(r.rate)} %`, money(r.iva)]));
  } else if (totals.discount) {
    // subtotal con IVA antes de bonificar, línea por línea (respeta alícuotas mixtas)
    const grossWithIva = items.reduce((a, { it, t }) => a + Math.round((t.gross * (100 + it.ivaRate)) / 100), 0);
    totRows.push(['Subtotal', money(grossWithIva)]);
    totRows.push(['Bonificaciones', `- ${money(grossWithIva - totals.total)}`]);
  }
  const totH = totRows.length * 5.5 + 12;
  if (y + 6 + totH > bottomLimit) {
    doc.addPage();
    y = M;
  }
  y += 5;
  const tw = 78;
  const tx = PAGE_W - M - tw;
  totRows.forEach(([k, v]) => {
    text(k, tx + 2, y, { size: 9, color: grey });
    text(v, tx + tw - 2, y, { size: 9, align: 'right' });
    y += 5.5;
  });
  doc.setFillColor(...accent);
  doc.roundedRect(tx, y, tw, 10, 1.5, 1.5, 'F');
  const onAccent: [number, number, number] = (accent[0] * 299 + accent[1] * 587 + accent[2] * 114) / 1000 > 140 ? [20, 20, 20] : [255, 255, 255];
  text('TOTAL', tx + 3, y + 2.9, { size: 11, bold: true, color: onAccent });
  text(money(totals.total), tx + tw - 3, y + 2.6, { size: 12, bold: true, color: onAccent, align: 'right' });
  y += 11.5;
  text(
    showIva ? `Importes en ${q.currency === 'USD' ? 'dólares estadounidenses' : 'pesos'}. IVA discriminado.` : `Importes en ${q.currency === 'USD' ? 'dólares estadounidenses' : 'pesos'} con IVA incluido.`,
    tx + tw, y, { size: 7.5, color: grey, align: 'right' },
  );
  y += 6;

  // ── Condiciones ────────────────────────────────────────
  const cond: [string, string][] = [
    ['Forma de pago', q.paymentTerms],
    ['Plazo de entrega', q.deliveryTerms],
    ['Validez', `${q.validDays} días (hasta el ${formatDate(addDays(q.date, q.validDays))})`],
    ['Observaciones', q.notes],
    ['Atendido por', q.seller],
  ].filter(([, v]) => v.trim()) as [string, string][];
  if (cond.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const condH = cond.reduce((a, [, v]) => a + (doc.splitTextToSize(v, CONTENT_W - 36) as string[]).length * 3.6 + 1.8, 8);
    if (y + condH > bottomLimit) {
      doc.addPage();
      y = M;
    }
    text('CONDICIONES COMERCIALES', M, y, { size: 8.5, bold: true, color: dark });
    y += 5.5;
    cond.forEach(([k, v]) => {
      text(k, M, y, { size: 8.5, bold: true, color: grey });
      y += text(v, M + 34, y, { size: 8.5, maxW: CONTENT_W - 36 }) + 1.8;
    });
  }

  // ── Pie en todas las páginas ───────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const fy = PAGE_H - M - FOOTER_H + 4;
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.6);
    doc.line(M, fy, M + CONTENT_W, fy);
    let lx = M;
    const logosShown = brandLogos.slice(0, 6);
    logosShown.forEach((b) => {
      const { w, h } = fit(b, 26, 8);
      doc.addImage(b.data, 'PNG', lx, fy + 3 + (8 - h) / 2, w, h, undefined, 'SLOW');
      lx += w + 5;
    });
    const footer = c.quoteFooter?.trim() ?? '';
    if (footer) text(footer, M, fy + (logosShown.length ? 13 : 3), { size: 7, color: grey, maxW: CONTENT_W - 30 });
    text(`Página ${p} de ${pages}`, M + CONTENT_W, fy + (logosShown.length ? 13 : 3), { size: 7, color: grey, align: 'right' });
  }
  return doc;
}

// ── Utilidades de navegador ─────────────────────────────────
/** Convierte cualquier logo guardado (PNG, SVG, WebP, JPG) a PNG para el PDF, sin alterar el dibujo. */
export async function imageToPng(img: HTMLImageElement, maxPx = 900): Promise<PdfImage> {
  const s = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s));
  const h = Math.max(1, Math.round(img.naturalHeight * s));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return { data: canvas.toDataURL('image/png'), width: w, height: h };
}

export function quoteFileName(q: Quote): string {
  const client = q.client.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `Presupuesto-${formatNumber(q.number)}${client ? `-${client}` : ''}.pdf`;
}
