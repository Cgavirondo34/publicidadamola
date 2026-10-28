import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Layers, Loader2, Maximize, Plus, Redo2, Save, SlidersHorizontal, Undo2, ZoomIn, ZoomOut, Shuffle } from 'lucide-react';
import { db, newId } from '../lib/db';
import { CUSTOM_FORMAT_ID, FORMATS, getFormat } from '../lib/formats';
import { STYLE_INFO, variantCount } from '../lib/layout';
import { ensureFonts, generateProposal } from '../lib/generate';
import { useEditor } from '../store/editor';
import { DesignCanvas, type CanvasHandle } from '../components/editor/DesignCanvas';
import { AddPanel, LayersPanel, PropertiesPanel } from '../components/editor/Panels';
import { Button, Field, Input, Modal, Notice, Select, toast } from '../components/ui';
import type { DesignElement, StyleId } from '../types';

type Tab = 'add' | 'props' | 'layers';

export default function Editor() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const project = useEditor((s) => s.project);
  const selectedId = useEditor((s) => s.selectedId);
  const dirty = useEditor((s) => s.dirty);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { load, select, update, undo, redo, remove, duplicate, rename, markSaved } = useEditor.getState();
  const canvasRef = useRef<CanvasHandle>(null);
  const [notFound, setNotFound] = useState(false);
  const [fontsOk, setFontsOk] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [tab, setTab] = useState<Tab>('add');
  const [exportOpen, setExportOpen] = useState(false);
  const [adaptOpen, setAdaptOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ensureFonts().then(() => setFontsOk(true));
  }, []);

  useEffect(() => {
    if (!id) return;
    db.projects.get(id).then((p) => (p ? load(p) : setNotFound(true)));
    return () => useEditor.setState({ project: null });
  }, [id, load]);

  // al seleccionar, mostrar propiedades
  useEffect(() => {
    if (selectedId) setTab('props');
  }, [selectedId]);

  // abrir exportación directa desde la galería (?export=1)
  useEffect(() => {
    if (project && fontsOk && params.get('export')) {
      setExportOpen(true);
      params.delete('export');
      setParams(params, { replace: true });
    }
  }, [project, fontsOk, params, setParams]);

  const save = useCallback(
    async (silent = false) => {
      const p = useEditor.getState().project;
      if (!p) return;
      setSaving(true);
      try {
        const thumbnail = canvasRef.current?.thumbnail() ?? p.thumbnail;
        const updatedAt = Date.now();
        await db.projects.put({ ...p, thumbnail, updatedAt });
        markSaved({ thumbnail, updatedAt });
        if (!silent) toast('Diseño guardado');
      } catch (e) {
        toast(`No se pudo guardar: ${(e as Error).message}`, 'error');
      } finally {
        setSaving(false);
      }
    },
    [markSaved],
  );

  // guardado automático
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => save(true), 2000);
    return () => clearTimeout(t);
  }, [dirty, project, save]);

  // atajos de teclado
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      const st = useEditor.getState();
      const sel = st.project?.elements.find((x) => x.id === st.selectedId);
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      else if (mod && e.key.toLowerCase() === 'd' && sel) { e.preventDefault(); duplicate(sel.id); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !sel.locked) { e.preventDefault(); remove(sel.id); }
      else if (e.key === 'Escape') select(null);
      else if (sel && !sel.locked && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
        const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
        update(sel.id, { x: sel.x + dx, y: sel.y + dy }, 'nudge');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [undo, redo, save, duplicate, remove, select, update]);

  const onChange = useCallback((elId: string, patch: Partial<DesignElement>) => update(elId, patch), [update]);
  const onSelect = useCallback((elId: string | null) => select(elId), [select]);

  if (notFound) return <div className="p-8">No se encontró el diseño. <Link to="/galeria" className="underline">Volver a la galería</Link></div>;
  if (!project || !fontsOk) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const fmt = getFormat(project.formatId, project.width, project.height);

  return (
    <div className="flex h-full flex-col bg-stone-200">
      {/* barra superior */}
      <header className="flex flex-wrap items-center gap-2 border-b border-stone-300 bg-white px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/galeria')} title="Volver"><ArrowLeft size={16} /></Button>
        <Input value={project.name} onChange={(e) => rename(e.target.value)} className="h-8 max-w-[220px] py-1 font-semibold" />
        <span className="hidden text-xs text-stone-500 md:inline">
          {fmt.label} · {project.width}×{project.height} · {STYLE_INFO[project.styleId].name}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)"><Undo2 size={16} /></Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Y)"><Redo2 size={16} /></Button>
          <div className="mx-1 hidden h-6 w-px bg-stone-300 sm:block" />
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))} title="Alejar"><ZoomOut size={16} /></Button>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => setZoom(1)} title="Ajustar"><Maximize size={16} /></Button>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => setZoom((z) => Math.min(4, z * 1.25))} title="Acercar"><ZoomIn size={16} /></Button>
          <div className="mx-1 hidden h-6 w-px bg-stone-300 sm:block" />
          <Button size="sm" onClick={() => setAdaptOpen(true)} title="Otro formato o variante"><Shuffle size={14} /><span className="hidden sm:inline">Otro formato</span></Button>
          <Button size="sm" onClick={() => save()} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}<span className="hidden sm:inline">{dirty ? 'Guardar' : 'Guardado'}</span>
          </Button>
          <Button size="sm" variant="gold" onClick={() => setExportOpen(true)}><Download size={14} /> Descargar</Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* lienzo */}
        <div className="min-h-[45vh] min-w-0 flex-1 lg:min-h-0">
          <DesignCanvas
            ref={canvasRef}
            width={project.width}
            height={project.height}
            elements={project.elements}
            interactive
            selectedId={selectedId}
            onSelect={onSelect}
            onChange={onChange}
            zoom={zoom}
          />
        </div>

        {/* panel lateral */}
        <aside className="flex max-h-[55vh] w-full flex-col border-t border-stone-300 bg-white lg:max-h-none lg:w-[340px] lg:border-l lg:border-t-0">
          <div className="grid grid-cols-3 border-b border-stone-200">
            {([['add', 'Agregar', Plus], ['props', 'Propiedades', SlidersHorizontal], ['layers', 'Capas', Layers]] as const).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold ${tab === k ? 'border-b-2 border-amola-700 text-amola-800' : 'text-stone-500'}`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === 'add' && <AddPanel />}
            {tab === 'props' && <PropertiesPanel />}
            {tab === 'layers' && <LayersPanel />}
          </div>
        </aside>
      </div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} canvas={canvasRef} name={project.name} width={project.width} height={project.height} />
      <AdaptDialog open={adaptOpen} onClose={() => setAdaptOpen(false)} />
    </div>
  );
}

// ───────────────────────── Exportar ─────────────────────────
function ExportDialog({
  open, onClose, canvas, name, width, height,
}: { open: boolean; onClose: () => void; canvas: React.RefObject<CanvasHandle>; name: string; width: number; height: number }) {
  const [mime, setMime] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [quality, setQuality] = useState(0.95);
  const [mult, setMult] = useState(1);
  const [busy, setBusy] = useState(false);
  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp';
  const slug = (name || 'diseno').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

  const go = async () => {
    if (!canvas.current) return;
    setBusy(true);
    try {
      useEditor.getState().select(null);
      await new Promise((r) => setTimeout(r, 60)); // deja que se oculte la selección
      const blob = await canvas.current.exportBlob(mime, quality, mult);
      if (blob.type !== mime) {
        toast(`Este navegador no exporta ${ext.toUpperCase()}; se generó ${blob.type.split('/')[1].toUpperCase()}.`, 'info');
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}-${width * mult}x${height * mult}.${blob.type.split('/')[1].replace('jpeg', 'jpg')}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast(`Descargado ${Math.round(blob.size / 1024)} KB`);
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Descargar imagen">
      <div className="space-y-4">
        <Field label="Formato de archivo">
          <div className="grid grid-cols-3 gap-2">
            {(['image/png', 'image/jpeg', 'image/webp'] as const).map((m) => (
              <Button key={m} variant={mime === m ? 'primary' : 'secondary'} onClick={() => setMime(m)}>
                {m === 'image/png' ? 'PNG' : m === 'image/jpeg' ? 'JPG' : 'WebP'}
              </Button>
            ))}
          </div>
        </Field>
        {mime !== 'image/png' && (
          <Field label={`Calidad ${Math.round(quality * 100)}%`}>
            <input type="range" min={0.6} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-amola-700" />
          </Field>
        )}
        <Field label="Resolución">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={mult === 1 ? 'primary' : 'secondary'} onClick={() => setMult(1)}>{width}×{height} (exacta)</Button>
            <Button variant={mult === 2 ? 'primary' : 'secondary'} onClick={() => setMult(2)}>{width * 2}×{height * 2} (alta)</Button>
          </div>
        </Field>
        <Notice tone="info">PNG: máxima nitidez para textos. JPG: archivos livianos para WhatsApp. WebP: liviano y nítido para web.</Notice>
        <Button variant="gold" size="lg" className="w-full" onClick={go} disabled={busy}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Descargar {ext.toUpperCase()}
        </Button>
      </div>
    </Modal>
  );
}

// ───────────────────────── Otro formato / variante ─────────────────────────
function AdaptDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useEditor((s) => s.project)!;
  const navigate = useNavigate();
  const [formatId, setFormatId] = useState(project.formatId === CUSTOM_FORMAT_ID ? 'ig-story' : project.formatId);
  const [styleId, setStyleId] = useState<Exclude<StyleId, 'ia'>>(project.styleId === 'ia' ? 'premium' : project.styleId);
  const [variant, setVariant] = useState(project.variant);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const f = getFormat(formatId);
      const p = await generateProposal(project.input, styleId, variant, f.id, f.width, f.height);
      const now = Date.now();
      const id = newId();
      await db.projects.put({
        id, name: `${project.name} · ${f.label}`, formatId: f.id, width: f.width, height: f.height, styleId, variant,
        input: project.input, elements: p.elements, createdAt: now, updatedAt: now,
      });
      onClose();
      navigate(`/editor/${id}`);
      toast('Nueva versión creada. El diseño original quedó guardado.');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Crear otra versión">
      <div className="space-y-4">
        <p className="text-sm text-stone-600">
          Se arma una pieza nueva con los mismos datos (fotos, línea, textos y teléfonos). Los ajustes manuales de este diseño no se trasladan.
        </p>
        <Field label="Formato">
          <Select value={formatId} onChange={(e) => setFormatId(e.target.value)}>
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label} · {f.width}×{f.height}</option>)}
          </Select>
        </Field>
        <Field label="Estilo">
          <Select value={styleId} onChange={(e) => { setStyleId(e.target.value as Exclude<StyleId, 'ia'>); setVariant(0); }}>
            {(['campana', 'premium', 'impacto', 'catalogo', 'redes'] as const).map((s) => <option key={s} value={s}>{STYLE_INFO[s].name}</option>)}
          </Select>
        </Field>
        <Field label="Variante">
          <Select value={variant} onChange={(e) => setVariant(Number(e.target.value))}>
            {Array.from({ length: variantCount(styleId) }, (_, i) => <option key={i} value={i}>{STYLE_INFO[styleId].variants[i]}</option>)}
          </Select>
        </Field>
        <Button variant="primary" size="lg" className="w-full" onClick={create} disabled={busy}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Shuffle size={18} />} Crear versión
        </Button>
      </div>
    </Modal>
  );
}
