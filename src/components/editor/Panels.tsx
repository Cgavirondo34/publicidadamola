import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Copy, Eye, EyeOff, Image as ImageIcon, Lock, MessageCircle,
  Phone, QrCode, Square, Trash2, Type, Unlock, Upload,
} from 'lucide-react';
import { db } from '../../lib/db';
import { saveAsset, useAssetUrl } from '../../lib/assets';
import { FONT_FAMILIES } from '../../lib/generate';
import { makeButton, makeImage, makeQr, makeRect, makeText } from '../../lib/elements';
import { useEditor } from '../../store/editor';
import type { ButtonEl, DesignElement, ImageEl, QrEl, ShapeEl, TextEl } from '../../types';
import { Button, ColorInput, Field, FileButton, Input, Select, Slider, Textarea, toast } from '../ui';

const WEIGHTS = [
  ['400', 'Regular'], ['500', 'Media'], ['600', 'Semi negrita'], ['700', 'Negrita'], ['800', 'Extra negrita'], ['900', 'Black'], ['italic', 'Itálica'], ['700 italic', 'Negrita itálica'],
];

const TYPE_LABEL: Record<DesignElement['type'], string> = { text: 'Texto', image: 'Imagen', rect: 'Forma', button: 'Botón', qr: 'QR' };

// ───────────────────────── Agregar ─────────────────────────
export function AddPanel() {
  const project = useEditor((s) => s.project)!;
  const add = useEditor((s) => s.add);
  const settings = useLiveQuery(() => db.settings.get('company'));
  const brands = useLiveQuery(() => db.brands.orderBy('name').toArray(), []);
  const S = Math.min(project.width, project.height);
  const cx = (w: number) => Math.round((project.width - w) / 2);
  const cy = (h: number) => Math.round((project.height - h) / 2);

  const addLogo = async (assetId: string, name: string) => {
    const a = await db.assets.get(assetId);
    if (!a) return;
    const h = S * 0.12;
    const w = (a.width / a.height) * h;
    add(makeImage({ name, role: 'logo', assetId, fit: 'contain', x: cx(w), y: cy(h), width: Math.round(w), height: Math.round(h) }));
  };

  const addPhoto = async (assetId: string) => {
    const a = await db.assets.get(assetId);
    if (!a) return;
    const w = project.width * 0.7;
    const h = (a.height / a.width) * w;
    add(makeImage({ name: 'Foto', role: 'photo', assetId, fit: 'contain', x: cx(w), y: cy(h), width: Math.round(w), height: Math.round(h) }));
  };

  const brandsWithLogo = (brands ?? []).filter((b) => b.logoAssetId);

  return (
    <div className="space-y-5">
      <section>
        <h3 className="panel-title">Texto</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" onClick={() => add(makeText({ name: 'Titular', role: 'headline', text: 'Titular publicitario', fontFamily: 'Nunito', fontStyle: '900', fontSize: Math.round(S * 0.08), fill: '#ffffff', uppercase: false, x: cx(S * 0.8), y: cy(S * 0.1), width: Math.round(S * 0.8), align: 'center' }))}>
            <Type size={14} /> Titular
          </Button>
          <Button size="sm" onClick={() => add(makeText({ name: 'Texto', text: 'Texto', fontFamily: 'Inter', fontStyle: '500', fontSize: Math.round(S * 0.035), fill: '#ffffff', x: cx(S * 0.6), y: cy(S * 0.05), width: Math.round(S * 0.6) }))}>
            <Type size={14} /> Texto
          </Button>
        </div>
      </section>

      <section>
        <h3 className="panel-title">Teléfonos (datos comerciales exactos)</h3>
        <div className="grid gap-2">
          {settings?.phones.map((p) => (
            <Button
              key={p.id}
              size="sm"
              className="justify-start"
              onClick={() => add(makeText({ name: `Teléfono ${p.label}`, role: 'phones', text: `${p.label}  ${p.number}`, fontFamily: 'Nunito', fontStyle: '800', fontSize: Math.round(S * 0.045), fill: '#ffffff', x: cx(S * 0.7), y: cy(S * 0.06), width: Math.round(S * 0.7) }))}
            >
              <Phone size={14} /> {p.label}: {p.number}
            </Button>
          ))}
          {settings?.phones.filter((p) => p.whatsapp).map((p) => (
            <Button
              key={`wa-${p.id}`}
              size="sm"
              className="justify-start"
              onClick={() => add(makeButton({ name: 'Botón WhatsApp', role: 'whatsapp', label: `WhatsApp ${p.number}`, x: cx(S * 0.6), y: cy(S * 0.09), width: Math.round(S * 0.6), height: Math.round(S * 0.09) }))}
            >
              <MessageCircle size={14} /> Botón WhatsApp {p.label}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="panel-title">Logos (archivos originales)</h3>
        <div className="grid grid-cols-2 gap-2">
          {settings?.logoAssetId ? (
            <LogoTile assetId={settings.logoAssetId} label="Empresa" onClick={() => addLogo(settings.logoAssetId!, 'Logo empresa')} />
          ) : (
            <p className="col-span-2 text-xs text-stone-500">Cargá el logo de la empresa en Configuración.</p>
          )}
          {brandsWithLogo.map((b) => (
            <LogoTile key={b.id} assetId={b.logoAssetId!} label={b.name} onClick={() => addLogo(b.logoAssetId!, `Logo ${b.name}`)} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="panel-title">Fotos</h3>
        <div className="grid grid-cols-3 gap-2">
          {project.input.photoAssetIds.map((id) => (
            <PhotoTile key={id} assetId={id} onClick={() => addPhoto(id)} />
          ))}
        </div>
        <FileButton
          accept="image/jpeg,image/png,image/webp"
          size="sm"
          className="mt-2 w-full"
          onFiles={async (files) => {
            try {
              const a = await saveAsset(files[0], 'photo');
              useEditor.setState((s) => ({ project: s.project && { ...s.project, input: { ...s.project.input, photoAssetIds: [...s.project.input.photoAssetIds, a.id] } } }));
              await addPhoto(a.id);
            } catch (e) {
              toast((e as Error).message, 'error');
            }
          }}
        >
          <Upload size={14} /> Subir otra foto
        </FileButton>
      </section>

      <section>
        <h3 className="panel-title">Elementos</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" onClick={() => add(makeRect({ name: 'Rectángulo', x: cx(S * 0.4), y: cy(S * 0.2), width: Math.round(S * 0.4), height: Math.round(S * 0.2), cornerRadius: Math.round(S * 0.015) }))}>
            <Square size={14} /> Forma
          </Button>
          <Button size="sm" onClick={() => add(makeQr({ name: 'Código QR', value: settings?.website || 'https://', x: cx(S * 0.2), y: cy(S * 0.2), width: Math.round(S * 0.2), height: Math.round(S * 0.2) }))}>
            <QrCode size={14} /> Código QR
          </Button>
        </div>
      </section>
    </div>
  );
}

function LogoTile({ assetId, label, onClick }: { assetId: string; label: string; onClick: () => void }) {
  const url = useAssetUrl(assetId);
  return (
    <button onClick={onClick} className="group flex flex-col items-center gap-1 rounded-lg border border-stone-200 bg-[repeating-conic-gradient(#f5f5f4_0_25%,#fff_0_50%)] bg-[length:12px_12px] p-2 hover:border-amola-500">
      {url ? <img src={url} alt={label} className="h-10 w-full object-contain" /> : <div className="h-10" />}
      <span className="w-full truncate text-[11px] font-medium text-stone-700">{label}</span>
    </button>
  );
}

function PhotoTile({ assetId, onClick, active }: { assetId: string; onClick: () => void; active?: boolean }) {
  const url = useAssetUrl(assetId);
  return (
    <button onClick={onClick} className={`aspect-square overflow-hidden rounded-lg border-2 ${active ? 'border-mostaza-500' : 'border-transparent'} bg-stone-100 hover:border-amola-500`}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </button>
  );
}

// ───────────────────────── Capas ─────────────────────────
export function LayersPanel() {
  const els = useEditor((s) => s.project?.elements ?? []);
  const selectedId = useEditor((s) => s.selectedId);
  const { select, update, reorder, remove } = useEditor.getState();
  return (
    <ul className="space-y-1">
      {[...els].reverse().map((el) => (
        <li
          key={el.id}
          onClick={() => select(el.id)}
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${el.id === selectedId ? 'bg-amola-100 ring-1 ring-amola-400' : 'hover:bg-stone-100'}`}
        >
          <span className="w-12 shrink-0 text-[10px] font-semibold uppercase text-stone-400">{TYPE_LABEL[el.type]}</span>
          <span className={`flex-1 truncate ${el.visible ? 'text-stone-800' : 'text-stone-400 line-through'}`}>{el.name}</span>
          <IconBtn title={el.visible ? 'Ocultar' : 'Mostrar'} onClick={() => update(el.id, { visible: !el.visible })}>{el.visible ? <Eye size={14} /> : <EyeOff size={14} />}</IconBtn>
          <IconBtn title={el.locked ? 'Desbloquear' : 'Bloquear'} onClick={() => update(el.id, { locked: !el.locked })}>{el.locked ? <Lock size={14} /> : <Unlock size={14} />}</IconBtn>
          <IconBtn title="Subir" onClick={() => reorder(el.id, 'up')}><ArrowUp size={14} /></IconBtn>
          <IconBtn title="Bajar" onClick={() => reorder(el.id, 'down')}><ArrowDown size={14} /></IconBtn>
          <IconBtn title="Eliminar" onClick={() => remove(el.id)}><Trash2 size={14} /></IconBtn>
        </li>
      ))}
    </ul>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded p-1 text-stone-500 hover:bg-white hover:text-stone-900"
    >
      {children}
    </button>
  );
}

// ───────────────────────── Propiedades ─────────────────────────
export function PropertiesPanel() {
  const el = useEditor((s) => s.project?.elements.find((e) => e.id === s.selectedId));
  const { update, duplicate, remove, reorder } = useEditor.getState();
  if (!el) return <p className="text-sm text-stone-500">Tocá un elemento del diseño para editarlo, o elegilo en Capas.</p>;
  const set = (patch: Partial<DesignElement>, key?: string) => update(el.id, patch, key ?? Object.keys(patch).join(','));
  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input value={el.name} onChange={(e) => set({ name: e.target.value }, 'name')} className="font-semibold" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" onClick={() => duplicate(el.id)}><Copy size={13} /> Duplicar</Button>
        <Button size="sm" onClick={() => reorder(el.id, 'top')} title="Traer al frente"><ChevronsUp size={13} /> Frente</Button>
        <Button size="sm" onClick={() => reorder(el.id, 'bottom')} title="Enviar al fondo"><ChevronsDown size={13} /> Fondo</Button>
        <Button size="sm" onClick={() => set({ locked: !el.locked })}>{el.locked ? <Unlock size={13} /> : <Lock size={13} />}{el.locked ? 'Desbloquear' : 'Bloquear'}</Button>
        <Button size="sm" variant="danger" onClick={() => remove(el.id)}><Trash2 size={13} /> Eliminar</Button>
      </div>

      {el.type === 'text' && <TextProps el={el} set={set} />}
      {el.type === 'image' && <ImageProps el={el} set={set} />}
      {el.type === 'rect' && <RectProps el={el} set={set} />}
      {el.type === 'button' && <ButtonProps el={el} set={set} />}
      {el.type === 'qr' && <QrProps el={el} set={set} />}

      <Slider label="Transparencia" value={Math.round(el.opacity * 100)} min={0} max={100} onChange={(v) => set({ opacity: v / 100 })} format={(v) => `${v}%`} />

      <details className="rounded-lg border border-stone-200 p-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-stone-600">Posición y tamaño</summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="X"><Input type="number" value={Math.round(el.x)} onChange={(e) => set({ x: num(e.target.value) }, 'x')} /></Field>
          <Field label="Y"><Input type="number" value={Math.round(el.y)} onChange={(e) => set({ y: num(e.target.value) }, 'y')} /></Field>
          <Field label="Ancho"><Input type="number" value={Math.round(el.width)} onChange={(e) => set(lockRatio(el, { width: Math.max(10, num(e.target.value)) }), 'w')} /></Field>
          {el.type !== 'text' && (
            <Field label="Alto"><Input type="number" value={Math.round(el.height)} onChange={(e) => set(lockRatio(el, { height: Math.max(10, num(e.target.value)) }), 'h')} /></Field>
          )}
          <Field label="Rotación"><Input type="number" value={el.rotation} onChange={(e) => set({ rotation: num(e.target.value) }, 'rot')} /></Field>
        </div>
      </details>
    </div>
  );
}

/** Los logos solo se escalan proporcionalmente. */
function lockRatio(el: DesignElement, patch: { width?: number; height?: number }) {
  if (el.type === 'image' && el.role === 'logo') {
    const r = el.width / el.height;
    if (patch.width) return { width: patch.width, height: Math.round(patch.width / r) };
    if (patch.height) return { height: patch.height, width: Math.round(patch.height * r) };
  }
  return patch;
}

type Setter = (patch: Partial<DesignElement>, key?: string) => void;

function TextProps({ el, set }: { el: TextEl; set: Setter }) {
  const settings = useLiveQuery(() => db.settings.get('company'));
  return (
    <div className="space-y-3">
      <Field label="Texto">
        <Textarea id="prop-text" rows={Math.min(6, el.text.split('\n').length + 1)} value={el.text} onChange={(e) => set({ text: e.target.value } as Partial<TextEl>, 'text')} />
      </Field>
      {el.role === 'phones' && settings && (
        <Field label="Reemplazar por teléfono comercial" hint="Usa el número tal cual está cargado en Configuración.">
          <Select
            value=""
            onChange={(e) => {
              const p = settings.phones.find((x) => x.id === e.target.value);
              if (p) set({ text: `${p.label}  ${p.number}` } as Partial<TextEl>);
            }}
          >
            <option value="">Elegir…</option>
            {settings.phones.map((p) => (
              <option key={p.id} value={p.id}>{p.label}: {p.number}</option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tipografía">
          <Select value={el.fontFamily} onChange={(e) => set({ fontFamily: e.target.value } as Partial<TextEl>)}>
            {FONT_FAMILIES.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
          </Select>
        </Field>
        <Field label="Peso">
          <Select value={el.fontStyle} onChange={(e) => set({ fontStyle: e.target.value } as Partial<TextEl>)}>
            {WEIGHTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
      </div>
      <Slider label="Tamaño" value={el.fontSize} min={8} max={300} onChange={(v) => set({ fontSize: v } as Partial<TextEl>)} format={(v) => `${Math.round(v)} px`} />
      <Field label="Color"><ColorInput value={el.fill} onChange={(v) => set({ fill: v } as Partial<TextEl>, 'fill')} /></Field>
      <div className="grid grid-cols-3 gap-1">
        {(['left', 'center', 'right'] as const).map((a) => (
          <Button key={a} size="sm" variant={el.align === a ? 'primary' : 'secondary'} onClick={() => set({ align: a } as Partial<TextEl>)}>
            {a === 'left' ? 'Izquierda' : a === 'center' ? 'Centro' : 'Derecha'}
          </Button>
        ))}
      </div>
      <Slider label="Interlineado" value={el.lineHeight} min={0.8} max={2} step={0.05} onChange={(v) => set({ lineHeight: v } as Partial<TextEl>)} format={(v) => v.toFixed(2)} />
      <Slider label="Espaciado de letras" value={el.letterSpacing} min={-5} max={30} step={0.5} onChange={(v) => set({ letterSpacing: v } as Partial<TextEl>)} />
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={el.uppercase} onChange={(e) => set({ uppercase: e.target.checked } as Partial<TextEl>)} /> Mayúsculas</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={el.shadow} onChange={(e) => set({ shadow: e.target.checked } as Partial<TextEl>)} /> Sombra</label>
      </div>
    </div>
  );
}

function ImageProps({ el, set }: { el: ImageEl; set: Setter }) {
  const project = useEditor((s) => s.project)!;
  const brands = useLiveQuery(() => db.brands.toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('company'));
  const isLogo = el.role === 'logo';
  const logos = [
    ...(settings?.logoAssetId ? [{ id: settings.logoAssetId, label: 'Empresa' }] : []),
    ...(brands ?? []).filter((b) => b.logoAssetId).map((b) => ({ id: b.logoAssetId!, label: b.name })),
  ];
  const replaceLogo = async (assetId: string) => {
    const a = await db.assets.get(assetId);
    if (!a) return;
    // se conserva la altura y se recalcula el ancho con la proporción del logo nuevo
    set({ assetId, width: Math.round((a.width / a.height) * el.height) } as Partial<ImageEl>);
  };
  return (
    <div className="space-y-3">
      {isLogo ? (
        <>
          <Field label="Logo" hint="Los logos se usan como archivo original: solo se mueven y escalan en proporción.">
            <Select value={el.assetId} onChange={(e) => replaceLogo(e.target.value)}>
              {logos.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </Select>
          </Field>
        </>
      ) : (
        <>
          <Field label="Imagen">
            <div className="grid grid-cols-4 gap-1.5">
              {project.input.photoAssetIds.map((id) => (
                <PhotoTile key={id} assetId={id} active={id === el.assetId} onClick={() => set({ assetId: id } as Partial<ImageEl>)} />
              ))}
            </div>
          </Field>
          <Field label="Encuadre" hint="Completa: el producto entra entero. Llenar: ocupa todo el marco y recorta bordes.">
            <div className="grid grid-cols-2 gap-1">
              <Button size="sm" variant={el.fit === 'contain' ? 'primary' : 'secondary'} onClick={() => set({ fit: 'contain' } as Partial<ImageEl>)}>Completa</Button>
              <Button size="sm" variant={el.fit === 'cover' ? 'primary' : 'secondary'} onClick={() => set({ fit: 'cover' } as Partial<ImageEl>)}>Llenar marco</Button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Slider label="Posición H" value={Math.round(el.focusX * 100)} min={0} max={100} onChange={(v) => set({ focusX: v / 100 } as Partial<ImageEl>)} format={(v) => `${v}%`} />
            <Slider label="Posición V" value={Math.round(el.focusY * 100)} min={0} max={100} onChange={(v) => set({ focusY: v / 100 } as Partial<ImageEl>)} format={(v) => `${v}%`} />
          </div>
          <Slider label="Brillo" value={Math.round(el.brightness * 100)} min={-50} max={50} onChange={(v) => set({ brightness: v / 100 } as Partial<ImageEl>)} />
          <Slider label="Contraste" value={el.contrast} min={-50} max={60} onChange={(v) => set({ contrast: v } as Partial<ImageEl>)} />
          <Slider label="Saturación" value={Math.round(el.saturation * 100)} min={-100} max={100} onChange={(v) => set({ saturation: v / 100 } as Partial<ImageEl>)} />
          <Slider label="Desenfoque (solo fondos)" value={el.blur} min={0} max={60} onChange={(v) => set({ blur: v } as Partial<ImageEl>)} />
          <Slider label="Esquinas redondeadas" value={el.cornerRadius} min={0} max={200} onChange={(v) => set({ cornerRadius: v } as Partial<ImageEl>)} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={el.shadow} onChange={(e) => set({ shadow: e.target.checked } as Partial<ImageEl>)} /> Sombra</label>
          {(el.brightness !== 0 || el.contrast !== 0 || el.saturation !== 0) && (
            <Button size="sm" onClick={() => set({ brightness: 0, contrast: 0, saturation: 0 } as Partial<ImageEl>)}>Restablecer ajustes</Button>
          )}
        </>
      )}
    </div>
  );
}

function RectProps({ el, set }: { el: ShapeEl; set: Setter }) {
  return (
    <div className="space-y-3">
      <Field label="Color de relleno"><ColorInput value={el.fill} onChange={(v) => set({ fill: v, gradient: undefined } as Partial<ShapeEl>, 'fill')} /></Field>
      {el.gradient && (
        <Field label="Degradado" hint="Este elemento usa un degradado. Al elegir un color sólido se reemplaza.">
          <div className="grid grid-cols-2 gap-2">
            <Input value={el.gradient.from} onChange={(e) => set({ gradient: { ...el.gradient!, from: e.target.value } } as Partial<ShapeEl>, 'gf')} className="font-mono text-xs" />
            <Input value={el.gradient.to} onChange={(e) => set({ gradient: { ...el.gradient!, to: e.target.value } } as Partial<ShapeEl>, 'gt')} className="font-mono text-xs" />
          </div>
        </Field>
      )}
      <Slider label="Esquinas" value={el.cornerRadius} min={0} max={Math.round(Math.min(el.width, el.height) / 2)} onChange={(v) => set({ cornerRadius: v } as Partial<ShapeEl>)} />
      <Slider label="Borde" value={el.strokeWidth} min={0} max={40} onChange={(v) => set({ strokeWidth: v, stroke: el.stroke || '#ffffff' } as Partial<ShapeEl>)} />
      {el.strokeWidth > 0 && <Field label="Color de borde"><ColorInput value={el.stroke} onChange={(v) => set({ stroke: v } as Partial<ShapeEl>, 'stroke')} /></Field>}
    </div>
  );
}

function ButtonProps({ el, set }: { el: ButtonEl; set: Setter }) {
  const settings = useLiveQuery(() => db.settings.get('company'));
  return (
    <div className="space-y-3">
      <Field label="Texto del botón"><Input value={el.label} onChange={(e) => set({ label: e.target.value } as Partial<ButtonEl>, 'label')} /></Field>
      {settings && (
        <Field label="Usar teléfono comercial">
          <Select
            value=""
            onChange={(e) => {
              const p = settings.phones.find((x) => x.id === e.target.value);
              if (p) set({ label: `WhatsApp ${p.number}` } as Partial<ButtonEl>);
            }}
          >
            <option value="">Elegir…</option>
            {settings.phones.map((p) => <option key={p.id} value={p.id}>{p.label}: {p.number}</option>)}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Fondo"><ColorInput value={el.fill} onChange={(v) => set({ fill: v } as Partial<ButtonEl>, 'fill')} /></Field>
        <Field label="Texto"><ColorInput value={el.textColor} onChange={(v) => set({ textColor: v } as Partial<ButtonEl>, 'tc')} /></Field>
      </div>
      <Field label="Ícono">
        <Select value={el.icon} onChange={(e) => set({ icon: e.target.value as ButtonEl['icon'] } as Partial<ButtonEl>)}>
          <option value="chat">Mensaje</option>
          <option value="phone">Teléfono</option>
          <option value="leaf">Hoja (beneficio)</option>
          <option value="check">Check</option>
          <option value="none">Sin ícono</option>
        </Select>
      </Field>
    </div>
  );
}

function QrProps({ el, set }: { el: QrEl; set: Setter }) {
  const valid = /^https?:\/\/\S+\.\S+/.test(el.value);
  return (
    <div className="space-y-3">
      <Field label="Enlace del QR" hint={valid ? 'Escaneá la vista previa para comprobarlo.' : 'Ingresá un enlace completo (https://...).'}>
        <Input value={el.value} onChange={(e) => set({ value: e.target.value } as Partial<QrEl>, 'qr')} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Color"><ColorInput value={el.fill} onChange={(v) => set({ fill: v } as Partial<QrEl>, 'qf')} /></Field>
        <Field label="Fondo"><ColorInput value={el.background} onChange={(v) => set({ background: v } as Partial<QrEl>, 'qb')} /></Field>
      </div>
    </div>
  );
}

export { ImageIcon };
