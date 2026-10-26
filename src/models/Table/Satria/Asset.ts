import db from '../../../utils/db';

export class AssetModel {
  static async getAll(limit = 10) {
    return await db.mst_asset.findMany({
      take: Number(limit),
    });
  }
}