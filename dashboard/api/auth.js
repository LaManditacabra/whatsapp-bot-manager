import { SignJWT, jwtVerify } from 'jose';
import db from './db.js';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'whatsapp-bot-secret-change-me');

export async function generateToken(user) {
  return new SignJWT({ userId: user.id, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const decoded = await verifyToken(header.slice(7));
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  const user = db.prepare('SELECT id, email, name, role, plan, plan_bots_limit FROM users WHERE id = ?').get(decoded.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  req.user = user;
  req.userId = user.id;
  next();
}

export async function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin only' });
  }
  next();
}
