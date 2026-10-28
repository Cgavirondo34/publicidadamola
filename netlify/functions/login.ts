import { createToken, getConfig, json, safeEqual, sessionCookie } from '../lib/auth';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const cfg = getConfig();

  let body: { user?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request', message: 'Solicitud inválida.' }, 400);
  }
  const user = typeof body.user === 'string' ? body.user.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  // se comparan ambos siempre (sin cortocircuito) para no revelar si el usuario existe
  const okUser = safeEqual(user, cfg.user.toLowerCase());
  const okPass = cfg.checkPassword(password);
  if (!(okUser && okPass)) {
    await wait(900); // frena los intentos automáticos de adivinar la contraseña
    return json({ error: 'invalid_credentials', message: 'Usuario o contraseña incorrectos.' }, 401);
  }
  return json({ user: cfg.user }, 200, { 'set-cookie': sessionCookie(createToken(cfg.user, cfg.secret), req) });
};

export const config = { path: '/api/login' };
