import { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.header('x-admin-token');
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'ADMIN_TOKEN not configured' });
  }
  if (!header || header !== token) {
    return res.status(403).json({ error: 'Forbidden: admin token required' });
  }
  (req as any).adminUserId = 0; // placeholder for auditing when using static token
  next();
}
