import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { db, newId } from '../lib/db';
import { STYLE_INFO } from '../lib/layout';
import { getFormat } from '../lib/formats';
import { Button, Input, PageHeader, toast } from '../components/ui';
import type { Project } from '../types';

export default function Gallery() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), []);
  const list = (projects ?? []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  const duplicate = async (p: Project) => {
    const now = Date.now();
    const id = newId();
    await db.projects.put({ ...p, id, name: `${p.name} (copia)`, createdAt: now, updatedAt: now });
    toast('Diseño duplicado');
  };
  const remove = async (p: Project) => {
    if (!confirm(`¿Eliminar “${p.name}”? No se puede deshacer.`)) return;
    await db.projects.delete(p.id);
    toast('Diseño eliminado');
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <PageHeader
        title="Galería"
        subtitle="Historial de diseños. Se guardan en este navegador."
        actions={<Button variant="primary" onClick={() => navigate('/nuevo')}><Plus size={16} /> Nueva publicidad</Button>}
      />
      <div className="relative mb-5 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre…" className="pl-9" />
      </div>
      {projects && list.length === 0 && <div className="card p-8 text-center text-sm text-stone-600">No hay diseños{q ? ' con ese nombre' : ''}.</div>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((p) => (
          <div key={p.id} className="card flex flex-col overflow-hidden">
            <Link to={`/editor/${p.id}`} className="flex aspect-square items-center justify-center bg-stone-200">
              {p.thumbnail ? <img src={p.thumbnail} alt={p.name} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-stone-500">Sin vista previa</span>}
            </Link>
            <div className="flex flex-1 flex-col p-3">
              <div className="truncate text-sm font-semibold">{p.name}</div>
              <div className="truncate text-xs text-stone-500">{STYLE_INFO[p.styleId].name} · {getFormat(p.formatId, p.width, p.height).label}</div>
              <div className="text-[11px] text-stone-400">{new Date(p.updatedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</div>
              <div className="mt-2 grid grid-cols-4 gap-1">
                <IconLink to={`/editor/${p.id}`} title="Editar"><Pencil size={15} /></IconLink>
                <IconLink to={`/editor/${p.id}?export=1`} title="Descargar"><Download size={15} /></IconLink>
                <button onClick={() => duplicate(p)} title="Duplicar" className="flex justify-center rounded-lg py-1.5 text-stone-600 hover:bg-stone-100"><Copy size={15} /></button>
                <button onClick={() => remove(p)} title="Eliminar" className="flex justify-center rounded-lg py-1.5 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IconLink({ to, title, children }: { to: string; title: string; children: React.ReactNode }) {
  return <Link to={to} title={title} className="flex justify-center rounded-lg py-1.5 text-stone-600 hover:bg-stone-100">{children}</Link>;
}
