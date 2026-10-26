import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import apiRoutes from './routes/api';

dotenv.config();

// Global Handler agar BigInt bisa di-convert ke JSON Response
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();
const PORT = process.env.PORT;

app.use(cors());

// 1. Set limit payload JSON ke 2MB (cukup aman untuk Base64 Canvas TTD)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 2. Buka folder 'uploads' agar file .png TTD bisa diakses via HTTP URL
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 3. Register Router API
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});