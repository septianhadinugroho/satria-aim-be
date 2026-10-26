import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'UTPE_SATRIA_SECRET_KEY_2026';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak! Token autentikasi tidak ditemukan.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as any;
    req.user = {
      id: Number(decoded.id),
      name: decoded.name,
      email: decoded.email,
      personal_number: decoded.personal_number || null,
    };
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Token tidak valid atau sudah kadaluwarsa.',
    });
  }
};