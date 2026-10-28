// Lógica de acceso compartida por las funciones. Corre SOLO en el servidor de Netlify:
// el usuario y la contraseña nunca llegan al navegador ni quedan en el repositorio.
import { createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'amola_session';
const SESSION_DAYS = 30;

// Acceso incorporado: usuario "amola". La contraseña NO está escrita en el repositorio: se guarda
// solo su huella scrypt, que no se puede revertir. Si en Netlify se definen AUTH_USER / AUTH_PASSWORD,
// esas variables tienen prioridad y reemplazan este acceso.
const DEFAULT_USER = 'amola';
const DEFAULT_SALT = '734a0e4260d9e4e883fba2cafa2c9ef7';
const DEFAULT_HASH = '6cf49b734572dc724870eaece7cda684b8326a1c7637dcc62841b6cb8eddabd0';
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export interface AuthConfig {
  user: string;
  /** Verifica la contraseña en tiempo constante. */
  checkPassword: (password: string) => boolean;
  secret: string;
}

/** Usa AUTH_USER / AUTH_PASSWORD de Netlify si están; si no, el acceso incorporado. */
export function getConfig(): AuthConfig {
  const envUser = process.env.AUTH_USER?.trim();
  const envPassword = process.env.AUTH_PASSWORD;
  if (envUser && envPassword) {
    // La firma de la sesión depende de la contraseña: si se cambia, todas las sesiones se cierran.
    const secret = process.env.AUTH_SECRET || createHash('sha256').update(`amola|${envUser}|${envPassword}`).digest('hex');
    return { user: envUser, checkPassword: (pw) => safeEqual(pw, envPassword), secret };
  }
  const secret = process.env.AUTH_SECRET || createHash('sha256').update(`amola|${DEFAULT_USER}|${DEFAULT_HASH}`).digest('hex');
  return { user: DEFAULT_USER, checkPassword: scryptChecker(DEFAULT_SALT, DEFAULT_HASH), secret };
}

/** Verificador de contraseña a partir de una huella scrypt (sal + hash en hex). */
export function scryptChecker(salt: string, hashHex: string): (password: string) => boolean {
  const expected = Buffer.from(hashHex, 'hex');
  return (pw) => timingSafeEqual(scryptSync(pw, salt, expected.length, SCRYPT), expected);
}

/** Genera sal + huella para una contraseña nueva (ver README: cambiar el acceso incorporado). */
export function scryptHash(password: string, salt: string): string {
  return scryptSync(password, salt, 32, SCRYPT).toString('hex');
}

const sha = (s: string) => createHash('sha256').update(s).digest();

/** Comparación en tiempo constante (no revela cuántos caracteres coinciden). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha(a), sha(b));
}

const b64url = (s: string) => Buffer.from(s).toString('base64url');
const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export function createToken(user: string, secret: string, now = Date.now()): string {
  const payload = b64url(JSON.stringify({ u: user, exp: now + SESSION_DAYS * 86400_000 }));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyToken(token: string | undefined, cfg: AuthConfig, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload, cfg.secret))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { u: string; exp: number };
    if (data.exp < now || data.u !== cfg.user) return null;
    return data.u;
  } catch {
    return null;
  }
}

export function readCookie(req: Request, name = COOKIE): string | undefined {
  const raw = req.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function sessionCookie(token: string, req: Request): string {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

export function clearCookie(req: Request): string {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
