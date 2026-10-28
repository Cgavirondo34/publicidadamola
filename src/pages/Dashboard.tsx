import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, ImagePlus, Sparkles, Sprout } from 'lucide-react';
import { db } from '../lib/db';
import { STYLE_INFO } from '../lib/layout';
import { getFormat } from '../lib/formats';
import { Notice } from '../components/ui';

export default function Dashboard() {
  const recent = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().limit(8).toArray(), []);
  const total = useLiveQuery(() => db.projects.count(), []);
  const settings = useLiveQuery(() => db.settings.get('company'));
  const brands = useLiveQuery(() => db.brands.toArray(), []);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <section className="relative overflow-hidden rounded-3xl bg-amola-600 p-6 text-white sm:p-10">
        {/* formas orgánicas como en las etiquetas AMOLA */}
        <div className="pointer-events-none absolute -right-16 -top-10 h-40 w-96 rotate-[28deg] rounded-full bg-mostaza-500/80" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-32 w-80 -rotate-12 rounded-full bg-terracota-500/70" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-28 w-60 rotate-6 rounded-full bg-lenteja-500/70" />
        <img src="/seed/amola-logo-blanco.png" alt="Amola Germinados" className="relative h-12 w-auto" />
        <h1 className="relative mt-4 max-w-2xl font-display text-3xl font-black leading-tight sm:text-5xl">
          Piezas AMOLA listas para redes, en minutos.
        </h1>
        <p className="relative mt-3 max-w-xl text-amola-50">
          Subí la foto, elegí la línea y el estilo. Logo, colores, tipografías y teléfonos salen siempre fieles al manual de marca, en capas editables.
        </p>
        <Link
          to="/nuevo"
          className="relative mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-bold text-amola-800 shadow-sm transition hover:bg-arena-100"
        >
          <ImagePlus size={20} /> Crear publicidad
        </Link>
      </section>

      <div className="mt-6 space-y-2">
        {settings && !settings.logoAssetId && (
          <Notice tone="warn">
            Falta el logo de AMOLA. <Link to="/configuracion" className="font-semibold underline">Cargalo en Empresa</Link>.
          </Notice>
        )}
        {settings && settings.phones.length === 0 && (
          <Notice tone="info">
            Todavía no hay teléfonos ni WhatsApp de pedidos. <Link to="/configuracion" className="font-semibold underline">Cargalos en Empresa</Link> para sumarlos a las piezas.
          </Notice>
        )}
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat to="/galeria" icon={<Sparkles size={18} />} label="Diseños guardados" value={total ?? 0} />
        <Stat to="/lineas" icon={<Sprout size={18} />} label="Líneas de producto" value={brands?.length ?? 0} />
        <Stat to="/configuracion" icon={<Building2 size={18} />} label="Teléfonos comerciales" value={settings?.phones.length ?? 0} />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold">Proyectos recientes</h2>
          <Link to="/galeria" className="flex items-center gap-1 text-sm font-semibold text-amola-700 hover:underline">
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>
        {recent && recent.length === 0 && (
          <div className="card p-8 text-center text-sm text-stone-600">
            Todavía no hay diseños. <Link to="/nuevo" className="font-semibold text-amola-700 underline">Creá el primero</Link>.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {recent?.map((p) => (
            <Link key={p.id} to={`/editor/${p.id}`} className="card group overflow-hidden transition hover:shadow-md">
              <div className="flex aspect-square items-center justify-center bg-stone-200">
                {p.thumbnail ? <img src={p.thumbnail} alt={p.name} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-stone-500">Sin vista previa</span>}
              </div>
              <div className="p-3">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                <div className="truncate text-xs text-stone-500">
                  {STYLE_INFO[p.styleId].name} · {getFormat(p.formatId, p.width, p.height).label}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ to, icon, label, value }: { to: string; icon: React.ReactNode; label: string; value: number }) {
  return (
    <Link to={to} className="card flex items-center gap-4 p-4 transition hover:shadow-md">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amola-100 text-amola-800">{icon}</div>
      <div>
        <div className="font-display text-2xl font-black">{value}</div>
        <div className="text-xs text-stone-600">{label}</div>
      </div>
    </Link>
  );
}
