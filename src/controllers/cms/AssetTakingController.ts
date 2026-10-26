import { Request, Response } from 'express';
import { AssetTakingModel } from '../../models/Table/Satria/AssetTaking';
import { PdfService } from '../../services/PdfService';

export class AssetTakingController {
  // Ambil daftar Schedule unik (Untuk Tabel Utama di FE)
  static async getSchedules(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const schedules = await AssetTakingModel.getSchedules(limit);

      return res.status(200).json({
        success: true,
        message: 'Berhasil mengambil daftar schedule asset taking',
        data: schedules,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: String(error) });
    }
  }

  static async index(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const records = await AssetTakingModel.getAll(limit);

      return res.status(200).json({
        success: true,
        message: 'Berhasil mengambil riwayat asset taking',
        data: records,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: String(error) });
    }
  }

  static async store(req: Request, res: Response) {
    try {
      const newRecord = await AssetTakingModel.create(req.body);

      return res.status(201).json({
        success: true,
        message: 'Data Asset Taking berhasil disimpan!',
        data: newRecord,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: String(error) });
    }
  }

  static async getReport(req: Request, res: Response) {
    try {
      const { scheduleId } = req.params;
      const reportData = await AssetTakingModel.getReportByScheduleId(Number(scheduleId));

      if (!reportData) {
        return res.status(404).json({
          success: false,
          message: 'Jadwal audit / report tidak ditemukan',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Berhasil generate data form laporan asset taking',
        data: reportData,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: String(error) });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updatedRecord = await AssetTakingModel.update(Number(id), req.body);

      return res.status(200).json({
        success: true,
        message: 'Data Asset Taking berhasil diperbarui!',
        data: updatedRecord,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: String(error) });
    }
  }

  static async approveSignature(req: Request, res: Response) {
    try {
      const { signatureId } = req.body;
      const userId = (req as any).user?.id;

      if (!signatureId) {
        return res.status(400).json({
          success: false,
          message: 'signatureId wajib diisi',
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User belum terautentikasi / token tidak valid',
        });
      }

      const updatedSig = await AssetTakingModel.approveSequential({
        signatureId: Number(signatureId),
        userId: Number(userId),
      });

      return res.status(200).json({
        success: true,
        message: 'Digital Signature berhasil disetujui!',
        data: updatedSig,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message || String(error) });
    }
  }

  static async downloadPdf(req: Request, res: Response) {
    try {
      const { scheduleId } = req.params;
      const reportData = await AssetTakingModel.getReportByScheduleId(Number(scheduleId));

      if (!reportData) {
        return res.status(404).json({
          success: false,
          message: 'Data laporan tidak ditemukan',
        });
      }

      const pdfBuffer = await PdfService.generateBaPdf(reportData);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=Berita_Acara_${scheduleId}.pdf`);
      return res.send(pdfBuffer);
    } catch (error) {
      return res.status(500).json({ success: false, error: String(error) });
    }
  }
}