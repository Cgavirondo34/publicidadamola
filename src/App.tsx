import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Building2, FileText, GalleryVerticalEnd, Home, Loader2, LogOut, PlusCircle, Sprout } from 'lucide-react';
import { ensureSeed } from './lib/db';
import { ensureFonts } from './lib/generate';
import { Toasts } from './components/ui';
import Dashboard from './pages/Dashboard';
import NewDesign from './pages/NewDesign';
import Editor from './pages/Editor';
import Brands from './pages/Brands';
import Settings from './pages/Settings';
import Gallery from './pages/Gallery';
// Presupuestos (incluye el generador de PDF): se descarga solo al abrir la sección
const QuotesList = lazy(() => import('./pages/Quotes').then((m) => ({ default: m.QuotesList })));
const QuoteEditor = lazy(() => import('./pages/Quotes').then((m) => ({ default: m.QuoteEditor })));
const Loading = () => <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-stone-400" /></div>;
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AuthNotConfigured, AuthOffline, LoginPage } from './pages/Login';

const NAV = [
  { to: '/', label: 'Inicio', short: 'Inicio', icon: Home, end: true },
  { to: '/nuevo', label: 'Crear publicidad', short: 'Crear', icon: PlusCircle },
  { to: '/presupuestos', label: 'Presupuestos', short: 'Presup.', icon: FileText },
  { to: '/galeria', label: 'Galería', short: 'Galería', icon: GalleryVerticalEnd },
  { to: '/lineas', label: 'Líneas', short: 'Líneas', icon: Sprout },
  { to: '/configuracion', label: 'Empresa', short: 'Empresa', icon: Building2 },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/seed/amola-logo-blanco.png" alt="Amola Germinados" className="h-9 w-auto" />
      <div className="border-l border-white/20 pl-2.5 leading-tight">
        <div className="font-display text-[15px] font-black tracking-tight text-white">Estudio</div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-amola-200">Publicidad</div>
      </div>
    </div>
  );
}

/** Puerta de acceso: nada de la app se monta sin sesión válida. */
export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { status } = useAuth();
  if (status === 'not_configured') return <AuthNotConfigured />;
  if (status === 'offline') return <AuthOffline />;
  if (status === 'loading')
    return (
      <div className="flex h-full items-center justify-center bg-amola-800 text-amola-200">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (status === 'out') return <LoginPage />;
  return <MainApp />;
}

function UserBox({ compact }: { compact?: boolean }) {
  const { user, logout: signOut } = useAuth();
  const email = user ?? '';
  if (compact)
    return (
      <button onClick={signOut} className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-amola-200 hover:bg-amola-700" aria-label="Cerrar sesión">
        <LogOut size={16} /> Salir
      </button>
    );
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl px-1 text-xs">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mostaza-500 font-bold uppercase text-tierra-900">{email.slice(0, 1)}</div>
      <div className="min-w-0 flex-1 truncate text-amola-200" title={email}>{email}</div>
      <button onClick={signOut} title="Cerrar sesión" aria-label="Cerrar sesión" className="rounded-lg p-1.5 text-amola-300 hover:bg-amola-700 hover:text-white">
        <LogOut size={16} />
      </button>
    </div>
  );
}

function MainApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const loc = useLocation();
  const inEditor = loc.pathname.startsWith('/editor');

  useEffect(() => {
    Promise.all([ensureSeed(), ensureFonts()])
      .then(() => setReady(true))
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  if (error) return <div className="p-8 text-red-700">No se pudo iniciar el almacenamiento local: {error}</div>;
  if (!ready)
    return (
      <div className="flex h-full items-center justify-center bg-amola-800 text-amola-200">
        <div className="animate-pulse font-display text-lg font-bold">Preparando AMOLA Estudio…</div>
      </div>
    );

  return (
    <div className="flex h-full">
      {/* barra lateral (escritorio) */}
      {!inEditor && (
        <aside className="hidden w-60 shrink-0 flex-col bg-amola-800 px-4 py-5 lg:flex">
          <Logo />
          <nav className="mt-8 space-y-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    isActive ? 'bg-amola-600 text-white' : 'text-amola-100 hover:bg-amola-700 hover:text-white'
                  }`
                }
              >
                <Icon size={18} /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto rounded-xl bg-amola-700 p-3 text-xs text-amola-200">
            <div className="font-semibold text-white">Fase 1 · MVP</div>
            Plantillas con la identidad AMOLA, editor y exportación. La IA de imagen llega en la Fase 2.
          </div>
          <UserBox />
        </aside>
      )}

      <main className={`min-w-0 flex-1 ${inEditor ? '' : 'overflow-y-auto pb-20 lg:pb-0'}`}>
        {!inEditor && (
          <header className="flex items-center bg-amola-800 px-4 py-3 lg:hidden">
            <Logo />
            <UserBox compact />
          </header>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nuevo" element={<NewDesign />} />
          <Route path="/editor/:id" element={<Editor />} />
          <Route path="/galeria" element={<Gallery />} />
          <Route path="/presupuestos" element={<Suspense fallback={<Loading />}><QuotesList /></Suspense>} />
          <Route path="/presupuestos/:id" element={<Suspense fallback={<Loading />}><QuoteEditor /></Suspense>} />
          <Route path="/lineas" element={<Brands />} />
          <Route path="/marcas" element={<Navigate to="/lineas" replace />} />
          <Route path="/configuracion" element={<Settings />} />
          <Route path="*" element={<div className="p-8">Página no encontrada.</div>} />
        </Routes>
      </main>

      {/* navegación inferior (celular) */}
      {!inEditor && (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-stone-200 bg-white lg:hidden">
          {NAV.map(({ to, short, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive ? 'text-amola-700' : 'text-stone-500'}`
              }
            >
              <Icon size={20} />
              {short}
            </NavLink>
          ))}
        </nav>
      )}
      <Toasts />
    </div>
  );
}
