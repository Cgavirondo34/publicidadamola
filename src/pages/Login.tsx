import { useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, Loader2, LogIn, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Button, Field, Input, Notice } from '../components/ui';

/** Marco común: foto del packaging a la izquierda (escritorio) y formulario a la derecha. */
function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full bg-stone-100">
      <div className="relative hidden flex-1 overflow-hidden bg-white lg:block">
        <img src="/seed/amola-legumbres.jpg" alt="" className="absolute inset-0 h-full w-full object-contain object-top" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-amola-700 via-amola-700/85 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-mostaza-300">AMOLA Estudio</p>
          <h2 className="mt-2 max-w-lg font-display text-4xl font-black leading-tight">
            Piezas AMOLA listas para redes, en minutos.
          </h2>
          <p className="mt-3 max-w-md text-amola-50">Logo, colores y tono del manual de marca, en diseños editables.</p>
        </div>
      </div>
      <div className="flex w-full items-center justify-center p-6 lg:w-[480px] lg:shrink-0 lg:bg-white">
        <div className="w-full max-w-sm">
          <img src="/seed/amola-logo.png" alt="Amola Germinados" className="mb-8 h-16 w-auto" />
          {children}
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const err = await login(user, password);
    setBusy(false);
    if (err) {
      setError(err);
      setPassword('');
    }
  };

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-extrabold">Ingresar</h1>
      <p className="mt-1 text-sm text-stone-600">Acceso para el equipo de AMOLA Germinados.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Usuario">
          <Input id="user" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required autoFocus />
        </Field>
        <Field label="Contraseña">
          <div className="relative">
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-500 hover:text-stone-800"
              aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />} Ingresar
        </Button>
      </form>
    </AuthShell>
  );
}

/** Faltan las variables en Netlify: la app NO se abre sin protección. */
export function AuthNotConfigured() {
  const { retry } = useAuth();
  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-extrabold">Falta configurar el acceso</h1>
      <p className="mt-2 text-sm text-stone-600">Cargá estas dos variables en Netlify y volvé a publicar:</p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-tierra-900 p-3 text-xs text-amola-200">AUTH_USER{'\n'}AUTH_PASSWORD</pre>
      <p className="mt-3 text-xs text-stone-500">Netlify → Site configuration → Environment variables → después: Deploys → Trigger deploy.</p>
      <Button className="mt-6 w-full" onClick={retry}><RefreshCw size={16} /> Reintentar</Button>
    </AuthShell>
  );
}

export function AuthOffline() {
  const { retry } = useAuth();
  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-extrabold">Sin conexión con el servidor</h1>
      <p className="mt-2 text-sm text-stone-600">No se pudo verificar el acceso. Revisá tu conexión a internet.</p>
      <Button className="mt-6 w-full" onClick={retry}><RefreshCw size={16} /> Reintentar</Button>
    </AuthShell>
  );
}
