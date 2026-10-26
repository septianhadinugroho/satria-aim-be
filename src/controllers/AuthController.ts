import { Request, Response } from 'express';
import db from '../utils/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'UTPE_SATRIA_SECRET_KEY_2026';

export class AuthController {
  // SIGNUP
  static async signup(req: Request, res: Response) {
    try {
      const { name, email, password, personal_number } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Nama, email, dan password wajib diisi!',
        });
      }

      const existingUser = await db.users.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email sudah terdaftar!',
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await db.users.create({
        data: {
          name,
          email,
          password: hashedPassword,
          personal_number: personal_number || null,
          is_blocked: 0,
          is_active: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Registrasi akun berhasil!',
        data: {
          id: Number(newUser.id),
          name: newUser.name,
          email: newUser.email,
          personal_number: newUser.personal_number,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || String(error) });
    }
  }

  // LOGIN
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email dan password wajib diisi!',
        });
      }

      const user = await db.users.findUnique({ where: { email } });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan!',
        });
      }

      if (user.is_blocked === 1 || user.is_active === 0) {
        return res.status(403).json({
          success: false,
          message: 'Akun Anda diblokir atau tidak aktif!',
        });
      }

      let isPasswordValid = false;
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        isPasswordValid = await bcrypt.compare(password, user.password);
      } else {
        isPasswordValid = user.password === password;
      }

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Password salah!',
        });
      }

      const payload = {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        personal_number: user.personal_number || null,
      };

      const token = jwt.sign(payload, JWT_SECRET as string, { expiresIn: '1d' });

      return res.status(200).json({
        success: true,
        message: 'Login berhasil!',
        data: {
          token,
          user: payload,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || String(error) });
    }
  }
}