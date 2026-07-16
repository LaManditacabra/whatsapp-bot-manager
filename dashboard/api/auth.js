import jwt from 'jsonwebtoken';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-bot-secret-change-me';

export function generateToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const decoded = verifyToken(header.slice(7));
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

export function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin only' });
  }
  next();
}
