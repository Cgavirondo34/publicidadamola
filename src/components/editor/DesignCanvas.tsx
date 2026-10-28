import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Konva from 'konva';
import { Group, Layer, Rect, Stage, Transformer } from 'react-konva';
import { ElementNode } from './nodes';
import type { DesignElement } from '../../types';

export interface CanvasHandle {
  /** Exporta EXACTAMENTE a ancho×alto×multiplicador. */
  exportBlob: (mime: 'image/png' | 'image/jpeg' | 'image/webp', quality?: number, multiplier?: number) => Promise<Blob>;
  thumbnail: (maxSide?: number) => string;
}

interface Props {
  width: number;
  height: number;
  elements: DesignElement[];
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (id: string, patch: Partial<DesignElement>) => void;
  /** tamaño fijo del lienzo en pantalla (para miniaturas); si no, ocupa el contenedor */
  fixedSize?: { w: number; h: number };
  zoom?: number; // 1 = ajustar a pantalla
}

const PAD = 24;

export const DesignCanvas = forwardRef<CanvasHandle, Props>(function DesignCanvas(
  { width, height, elements, interactive = false, selectedId, onSelect, onChange, fixedSize, zoom = 1 },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [box, setBox] = useState({ w: fixedSize?.w ?? 600, h: fixedSize?.h ?? 600 });

  useEffect(() => {
    if (fixedSize) {
      setBox(fixedSize);
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setBox({ w: Math.max(100, r.width), h: Math.max(100, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixedSize?.w, fixedSize?.h]);

  const pad = fixedSize ? 0 : PAD;
  const fitScale = Math.min((box.w - pad * 2) / width, (box.h - pad * 2) / height);
  const scale = Math.max(0.02, fitScale * zoom);
  const stageW = fixedSize ? box.w : Math.max(box.w, width * scale + pad * 2);
  const stageH = fixedSize ? box.h : Math.max(box.h, height * scale + pad * 2);
  const ox = (stageW - width * scale) / 2;
  const oy = (stageH - height * scale) / 2;

  // Transformer sobre el elemento seleccionado
  const selected = elements.find((e) => e.id === selectedId);
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (interactive && selected && !selected.locked && selected.visible) {
      const node = stage.findOne(`#${selected.id}`);
      tr.nodes(node ? [node] : []);
    } else tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selected, interactive, elements]);

  const exportCanvas = useCallback(
    (multiplier: number) => {
      const stage = stageRef.current!;
      const tr = trRef.current;
      const prev = tr?.nodes() ?? [];
      tr?.nodes([]);
      const src = stage.toCanvas({ x: ox, y: oy, width: width * scale, height: height * scale, pixelRatio: (1 / scale) * multiplier });
      tr?.nodes(prev);
      // Se redibuja en un lienzo de tamaño exacto: la exportación nunca queda con 1 px de más o de menos.
      const out = document.createElement('canvas');
      out.width = Math.round(width * multiplier);
      out.height = Math.round(height * multiplier);
      const ctx = out.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(src, 0, 0, out.width, out.height);
      return out;
    },
    [ox, oy, width, height, scale],
  );

  useImperativeHandle(
    ref,
    () => ({
      exportBlob: (mime, quality = 0.95, multiplier = 1) =>
        new Promise((resolve, reject) => {
          const c = exportCanvas(multiplier);
          c.toBlob((b) => (b ? resolve(b) : reject(new Error('El navegador no pudo generar la imagen.'))), mime, quality);
        }),
      thumbnail: (maxSide = 420) => {
        const m = Math.min(1, maxSide / Math.max(width, height));
        const c = exportCanvas(1);
        const t = document.createElement('canvas');
        t.width = Math.round(width * m);
        t.height = Math.round(height * m);
        t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height);
        return t.toDataURL('image/jpeg', 0.78);
      },
    }),
    [exportCanvas, width, height],
  );

  const handleStageDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!interactive) return;
    if (e.target === e.target.getStage()) onSelect?.(null);
  };

  return (
    <div
      ref={wrapRef}
      className={fixedSize ? '' : 'h-full w-full overflow-auto'}
      style={fixedSize ? { width: fixedSize.w, height: fixedSize.h } : undefined}
    >
      <Stage ref={stageRef} width={stageW} height={stageH} onMouseDown={handleStageDown} onTouchStart={handleStageDown}>
        <Layer>
          <Group x={ox} y={oy} scaleX={scale} scaleY={scale}>
            {/* sombra del "papel" */}
            {!fixedSize && <Rect width={width} height={height} fill="#fff" shadowColor="#000" shadowBlur={30 / scale} shadowOpacity={0.25} listening={false} />}
            <Group clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
              {elements.map((el) => (
                <ElementNode key={el.id} el={el} interactive={interactive} onSelect={onSelect as (id: string) => void} onChange={onChange} />
              ))}
            </Group>
          </Group>
          {interactive && (
            <Transformer
              ref={trRef}
              rotateEnabled
              keepRatio={selected?.type === 'image' && selected.role === 'logo'}
              enabledAnchors={
                selected?.type === 'image' && selected.role === 'logo'
                  ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                  : selected?.type === 'qr'
                    ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                    : undefined
              }
              anchorSize={10}
              anchorCornerRadius={3}
              borderStroke="#e0a12e"
              anchorStroke="#e0a12e"
              ignoreStroke
              boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
});
