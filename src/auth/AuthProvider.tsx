import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Status = 'loading' | 'in' | 'out' | 'not_configured' | 'offline';

interface AuthState {
  status: Status;
  user: string | null;
  login: (user: string, password: string) => Promise<string | null>; // devuelve mensaje de error o null
  logout: () => Promise<void>;
  retry: () => void;
}

const Ctx = createContext<AuthState | null>(null);

/** La sesión vive en una cookie HttpOnly que firma el servidor: el navegador no puede leerla ni falsificarla. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<string | null>(null);

  const check = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setStatus('in');
      } else if (res.status === 503) setStatus('not_configured');
      else if (res.status === 401) setStatus('out');
      else setStatus('offline');
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      retry: check,
      login: async (u, p) => {
        try {
          const res = await fetch('/api/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ user: u, password: p }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            setUser(data.user);
            setStatus('in');
            return null;
          }
          if (res.status === 503) {
            setStatus('not_configured');
            return null;
          }
          return data.message ?? 'No se pudo ingresar.';
        } catch {
          return 'No hay conexión con el servidor. Revisá tu internet.';
        }
      },
      logout: async () => {
        await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
        setUser(null);
        setStatus('out');
      },
    }),
    [status, user, check],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuera de AuthProvider');
  return v;
}
