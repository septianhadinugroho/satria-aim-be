import { Request, Response } from 'express';
import { AssetModel } from '../../models/Table/Satria/Asset';

export class AssetController {
  static async index(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const assets = await AssetModel.getAll(limit);

      return res.status(200).json({
        success: true,
        message: 'Berhasil mengambil master asset',
        data: assets,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: String(error) });
    }
  }
}