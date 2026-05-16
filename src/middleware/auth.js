import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'missing token' });

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.sub).lean();
    if (!user) return res.status(401).json({ error: 'invalid token' });

    req.user = user;
    req.organizationId = user.organization;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}
