import { getConfig, json, readCookie, verifyToken } from '../lib/auth';

export default async (req: Request): Promise<Response> => {
  const cfg = getConfig();
  const user = verifyToken(readCookie(req), cfg);
  return user ? json({ user }) : json({ error: 'unauthenticated' }, 401);
};

export const config = { path: '/api/session' };
