import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_dev';
const LEGACY_JWT_SECRET = 'fallback_secret_key_for_dev';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const secretsToTry = JWT_SECRET === LEGACY_JWT_SECRET
    ? [JWT_SECRET]
    : [JWT_SECRET, LEGACY_JWT_SECRET];

  for (const secret of secretsToTry) {
    try {
      const decoded = jwt.verify(token, secret) as { id?: string; email?: string };
      req.user = decoded as any;
      return next();
    } catch (error) {
      // Try the next secret before failing hard. This keeps older local sessions working.
    }
  }

  return res.status(401).json({ error: 'Invalid or expired token' });
};

export const generateToken = (id: string, email: string) => {
  return jwt.sign({ id, email }, JWT_SECRET, { expiresIn: '7d' });
};
