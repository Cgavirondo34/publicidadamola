import { clearCookie, json } from '../lib/auth';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  return json({ ok: true }, 200, { 'set-cookie': clearCookie(req) });
};

export const config = { path: '/api/logout' };
