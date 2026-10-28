import { useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Group, Image as KImage, Path, Rect, Text } from 'react-konva';
import QRCode from 'qrcode';
import { useAssetImage } from '../../lib/assets';
import { renderedText } from '../../lib/layout';
import type { ButtonEl, DesignElement, Gradient, ImageEl, QrEl, ShapeEl, TextEl } from '../../types';

export interface NodeProps<T extends DesignElement> {
  el: T;
  interactive: boolean;
  onSelect?: (id: string) => void;
  onChange?: (id: string, patch: Partial<DesignElement>) => void;
}

/** Props comunes de posición, arrastre y selección */
function common<T extends DesignElement>({ el, interactive, onSelect, onChange }: NodeProps<T>) {
  const canEdit = interactive && !el.locked;
  return {
    id: el.id,
    name: 'design-node',
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    opacity: el.opacity,
    visible: el.visible,
    draggable: canEdit,
    listening: interactive,
    onMouseDown: () => interactive && onSelect?.(el.id),
    onTap: () => interactive && onSelect?.(el.id),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      onChange?.(el.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
    },
  };
}

/** Al terminar de transformar se lleva la escala a ancho/alto reales (sin deformar contenido). */
function onTransformEndBox(el: DesignElement, onChange?: NodeProps<DesignElement>['onChange']) {
  return (e: Konva.KonvaEventObject<Event>) => {
    const n = e.target;
    const sx = n.scaleX();
    const sy = n.scaleY();
    n.scaleX(1);
    n.scaleY(1);
    onChange?.(el.id, {
      x: Math.round(n.x()),
      y: Math.round(n.y()),
      rotation: Math.round(n.rotation() * 10) / 10,
      width: Math.max(10, Math.round(el.width * sx)),
      height: Math.max(10, Math.round(el.height * sy)),
    });
  };
}

export function gradientProps(g: Gradient | undefined, w: number, h: number) {
  if (!g) return {};
  const a = (g.angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = w / 2;
  const cy = h / 2;
  return {
    fillPriority: 'linear-gradient',
    fillLinearGradientStartPoint: { x: cx - dx * half, y: cy - dy * half },
    fillLinearGradientEndPoint: { x: cx + dx * half, y: cy + dy * half },
    fillLinearGradientColorStops: [0, g.from, 1, g.to],
  };
}

export function RectNode(p: NodeProps<ShapeEl>) {
  const { el } = p;
  return (
    <Rect
      {...common(p)}
      width={el.width}
      height={el.height}
      fill={el.fill}
      cornerRadius={Math.min(el.cornerRadius, el.width / 2, el.height / 2)}
      stroke={el.stroke || undefined}
      strokeWidth={el.strokeWidth}
      {...gradientProps(el.gradient, el.width, el.height)}
      onTransformEnd={onTransformEndBox(el, p.onChange)}
    />
  );
}

export function TextNode(p: NodeProps<TextEl>) {
  const { el, onChange } = p;
  return (
    <Text
      {...common(p)}
      text={renderedText(el)}
      width={el.width}
      fontFamily={el.fontFamily}
      fontStyle={el.fontStyle}
      fontSize={el.fontSize}
      fill={el.fill}
      align={el.align}
      lineHeight={el.lineHeight}
      letterSpacing={el.letterSpacing}
      wrap={el.wrap ?? 'word'}
      shadowColor="#000"
      shadowBlur={el.shadow ? el.fontSize * 0.25 : 0}
      shadowOpacity={el.shadow ? 0.55 : 0}
      shadowOffsetY={el.shadow ? el.fontSize * 0.05 : 0}
      onTransformEnd={(e) => {
        const n = e.target as Konva.Text;
        const sx = n.scaleX();
        const sy = n.scaleY();
        n.scaleX(1);
        n.scaleY(1);
        const scaledFont = Math.abs(sy - 1) > 0.001;
        onChange?.(el.id, {
          x: Math.round(n.x()),
          y: Math.round(n.y()),
          rotation: Math.round(n.rotation() * 10) / 10,
          width: Math.max(20, Math.round(el.width * sx)),
          fontSize: scaledFont ? Math.max(6, Math.round(el.fontSize * sy * 10) / 10) : el.fontSize,
          height: Math.round(n.height() * (scaledFont ? sy : 1)),
        } as Partial<TextEl>);
      }}
    />
  );
}

/** Calcula cómo dibujar la imagen dentro del marco sin deformarla. */
export function imageDraw(el: ImageEl, iw: number, ih: number) {
  if (el.fit === 'cover') {
    const s = Math.max(el.width / iw, el.height / ih);
    const cw = el.width / s;
    const ch = el.height / s;
    return {
      x: 0, y: 0, width: el.width, height: el.height,
      crop: { x: (iw - cw) * el.focusX, y: (ih - ch) * el.focusY, width: cw, height: ch },
    };
  }
  const s = Math.min(el.width / iw, el.height / ih);
  const w = iw * s;
  const h = ih * s;
  return { x: (el.width - w) * el.focusX, y: (el.height - h) * el.focusY, width: w, height: h, crop: undefined };
}

export function ImageNode(p: NodeProps<ImageEl>) {
  const { el } = p;
  const img = useAssetImage(el.assetId);
  const ref = useRef<Konva.Image>(null);
  const filtered = el.brightness !== 0 || el.contrast !== 0 || el.saturation !== 0 || el.blur > 0;
  const draw = img ? imageDraw(el, img.naturalWidth, img.naturalHeight) : null;

  useEffect(() => {
    const n = ref.current;
    if (!n || !img) return;
    if (filtered) {
      // desenfoque: caché a baja resolución (rápido y suave); ajustes de color: a resolución de exportación
      n.cache({ pixelRatio: el.blur > 0 ? 0.35 : 1 });
    } else {
      n.clearCache();
    }
    n.getLayer()?.batchDraw();
  }, [img, filtered, el.brightness, el.contrast, el.saturation, el.blur, el.width, el.height, el.fit, el.focusX, el.focusY, el.cornerRadius]);

  const filters = [
    ...(el.blur > 0 ? [Konva.Filters.Blur] : []),
    ...(el.brightness !== 0 ? [Konva.Filters.Brighten] : []),
    ...(el.contrast !== 0 ? [Konva.Filters.Contrast] : []),
    ...(el.saturation !== 0 ? [Konva.Filters.HSL] : []),
  ];

  return (
    <Group {...common(p)} onTransformEnd={onTransformEndBox(el, p.onChange)}>
      {/* el marco define el área seleccionable aunque la imagen sea "contain" */}
      <Rect width={el.width} height={el.height} fill="rgba(0,0,0,0)" />
      {img && draw && (
        <KImage
          ref={ref}
          image={img}
          {...draw}
          cornerRadius={el.cornerRadius || 0}
          filters={filters}
          blurRadius={el.blur}
          brightness={el.brightness}
          contrast={el.contrast}
          saturation={el.saturation}
          shadowColor="#000"
          shadowBlur={el.shadow ? Math.min(el.width, el.height) * 0.05 : 0}
          shadowOpacity={el.shadow ? 0.35 : 0}
          shadowOffsetY={el.shadow ? Math.min(el.width, el.height) * 0.02 : 0}
          listening={false}
        />
      )}
    </Group>
  );
}

const ICONS = {
  // íconos genéricos (no se reproduce ningún logotipo de terceros)
  chat: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z',
  check: 'M20 6 9 17l-5-5',
  // hoja (sellos de beneficio AMOLA)
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12',
  phone:
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
};

export function ButtonNode(p: NodeProps<ButtonEl>) {
  const { el } = p;
  const h = el.height;
  const icon = el.icon !== 'none';
  const onlyIcon = icon && !el.label.trim();
  const iconSize = onlyIcon ? Math.min(el.width, h) * 0.5 : h * 0.46;
  const iconX = onlyIcon ? (el.width - iconSize) / 2 : h * 0.38;
  const textX = icon ? h * 0.38 + iconSize + h * 0.22 : h * 0.45;
  return (
    <Group {...common(p)} onTransformEnd={onTransformEndBox(el, p.onChange)}>
      <Rect width={el.width} height={h} fill={el.fill} cornerRadius={Math.min(el.cornerRadius, h / 2)} />
      {icon && (
        <Path
          data={ICONS[el.icon as keyof typeof ICONS]}
          x={iconX}
          y={(h - iconSize) / 2}
          scaleX={iconSize / 24}
          scaleY={iconSize / 24}
          stroke={el.textColor}
          strokeWidth={onlyIcon ? 3 : 2.2}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}
      {!onlyIcon && <Text
        x={textX}
        y={0}
        width={Math.max(10, el.width - textX - h * 0.35)}
        height={h}
        text={el.label}
        fontFamily={el.fontFamily}
        fontStyle="700"
        fontSize={h * 0.36}
        fill={el.textColor}
        verticalAlign="middle"
        align={icon ? 'left' : 'center'}
        wrap="none"
        listening={false}
      />}
    </Group>
  );
}

export function useQrImage(value: string, dark: string, light: string): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement>();
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value || ' ', { margin: 1, width: 1024, errorCorrectionLevel: 'M', color: { dark, light } })
      .then((url) => {
        const i = new Image();
        i.onload = () => alive && setImg(i);
        i.src = url;
      })
      .catch(() => alive && setImg(undefined));
    return () => {
      alive = false;
    };
  }, [value, dark, light]);
  return img;
}

export function QrNode(p: NodeProps<QrEl>) {
  const { el } = p;
  const img = useQrImage(el.value, el.fill, el.background);
  const size = Math.min(el.width, el.height);
  return (
    <Group {...common(p)} onTransformEnd={onTransformEndBox(el, p.onChange)}>
      <Rect width={el.width} height={el.height} fill="rgba(0,0,0,0)" />
      {img && <KImage image={img} x={(el.width - size) / 2} y={(el.height - size) / 2} width={size} height={size} listening={false} />}
    </Group>
  );
}

export function ElementNode(p: NodeProps<DesignElement>) {
  const el = p.el;
  return useMemo(() => {
    switch (el.type) {
      case 'rect':
        return <RectNode {...(p as NodeProps<ShapeEl>)} />;
      case 'text':
        return <TextNode {...(p as NodeProps<TextEl>)} />;
      case 'image':
        return <ImageNode {...(p as NodeProps<ImageEl>)} />;
      case 'button':
        return <ButtonNode {...(p as NodeProps<ButtonEl>)} />;
      case 'qr':
        return <QrNode {...(p as NodeProps<QrEl>)} />;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el, p.interactive]);
}
