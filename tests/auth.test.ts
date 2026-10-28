import { beforeEach, describe, expect, it } from 'vitest';
import login from '../netlify/functions/login';
import session from '../netlify/functions/session';
import logout from '../netlify/functions/logout';
import { createToken, getConfig, scryptChecker, scryptHash, verifyToken } from '../netlify/lib/auth';

const URL_ = 'https://amola-estudio.netlify.app';
const PASS = 'clave-de-prueba-123';
const post = (path: string, body?: unknown, cookie?: string) =>
  new Request(URL_ + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const get = (path: string, cookie?: string) => new Request(URL_ + path, { headers: cookie ? { cookie } : {} });
const cookieOf = (r: Response) => r.headers.get('set-cookie')!.split(';')[0];

describe('login simple (funciones de Netlify)', () => {
  beforeEach(() => {
    process.env.AUTH_USER = 'amola';
    process.env.AUTH_PASSWORD = PASS;
    delete process.env.AUTH_SECRET;
  });

  it('sin variables en Netlify rige el acceso incorporado "amola" (la contraseña no está en el repo)', async () => {
    delete process.env.AUTH_USER;
    delete process.env.AUTH_PASSWORD;
    expect(getConfig().user).toBe('amola');
    expect((await login(post('/api/login', { user: 'amola', password: PASS }))).status).toBe(401);
    expect((await login(post('/api/login', { user: 'amola', password: '' }))).status).toBe(401);
  });

  it('el verificador scrypt acepta solo la contraseña correcta', () => {
    const salt = '00112233445566778899aabbccddeeff';
    const check = scryptChecker(salt, scryptHash(PASS, salt));
    expect(check(PASS)).toBe(true);
    expect(check(PASS + ' ')).toBe(false);
    expect(check('')).toBe(false);
  });

  it('rechaza contraseña incorrecta con mensaje en español y sin cookie', async () => {
    const r = await login(post('/api/login', { user: 'amola', password: '000000' }));
    expect(r.status).toBe(401);
    expect((await r.json()).message).toBe('Usuario o contraseña incorrectos.');
    expect(r.headers.get('set-cookie')).toBeNull();
  });

  it('rechaza usuario incorrecto', async () => {
    expect((await login(post('/api/login', { user: 'pedro', password: PASS }))).status).toBe(401);
  });

  it('acepta amola (usuario sin distinguir mayúsculas) y da cookie segura', async () => {
    const r = await login(post('/api/login', { user: ' Amola ', password: PASS }));
    expect(r.status).toBe(200);
    const c = r.headers.get('set-cookie')!;
    expect(c).toMatch(/^amola_session=/);
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/Secure/);
    expect(c).toMatch(/SameSite=Lax/);
    const s = await session(get('/api/session', cookieOf(r)));
    expect(s.status).toBe(200);
    expect((await s.json()).user).toBe('amola');
  });

  it('la contraseña nunca aparece en la cookie ni en la respuesta', async () => {
    const r = await login(post('/api/login', { user: 'amola', password: PASS }));
    const all = r.headers.get('set-cookie')! + (await r.text());
    expect(all).not.toContain(PASS);
    expect(Buffer.from(cookieOf(r).split('=')[1].split('.')[0], 'base64url').toString()).not.toContain(PASS);
  });

  it('una cookie falsificada o vencida no sirve', async () => {
    const cfg = getConfig();
    const forged = createToken('amola', 'otro-secreto');
    expect(verifyToken(forged, cfg)).toBeNull();
    const expired = createToken('amola', cfg.secret, Date.now() - 31 * 86400_000);
    expect(verifyToken(expired, cfg)).toBeNull();
    expect((await session(get('/api/session', 'amola_session=basura'))).status).toBe(401);
  });

  it('cambiar la contraseña en Netlify cierra las sesiones abiertas', async () => {
    const r = await login(post('/api/login', { user: 'amola', password: PASS }));
    const c = cookieOf(r);
    process.env.AUTH_PASSWORD = 'nueva-clave';
    expect((await session(get('/api/session', c))).status).toBe(401);
  });

  it('cerrar sesión borra la cookie', async () => {
    const r = await logout(post('/api/logout'));
    expect(r.headers.get('set-cookie')).toMatch(/Max-Age=0/);
  });
});
