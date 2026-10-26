import db from '../../../utils/db';

export class AssetTakingModel {
  // Method baru: Mengambil daftar Schedule Master (Agar FE merender 1 schedule = 1 baris)
  static async getSchedules(limit = 10) {
    return await db.asset_taking_schedules.findMany({
      take: Number(limit),
      include: {
        mst_asset: true,
        asset_taking_record: {
          include: {
            mst_asset: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  static async getAll(limit = 10) {
    return await db.asset_taking_record.findMany({
      take: Number(limit),
      include: {
        mst_asset: true,
        asset_taking_schedules: true,
        asset_taking_image: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  // Mencegah Duplicate Record saat submit (UPSERT Logic)
  static async create(data: {
    asset_id: number | string;
    schedule_id?: number | string;
    pic?: number | string;
    asset_condition?: number;
    note?: string;
    image_url?: string;
  }) {
    const scheduleId = data.schedule_id ? BigInt(data.schedule_id) : null;
    const assetId = BigInt(data.asset_id);

    // 1. Cek apakah record pengecekan untuk schedule + asset ini sudah pernah dibuat
    if (scheduleId) {
      const existingRecord = await db.asset_taking_record.findFirst({
        where: {
          schedule_id: scheduleId,
          asset_id: assetId,
        },
      });

      // Jika sudah ada, LAKUKAN UPDATE (Jangan buat record baru)
      if (existingRecord) {
        const updated = await db.asset_taking_record.update({
          where: { id: existingRecord.id },
          data: {
            pic: data.pic ? BigInt(data.pic) : existingRecord.pic,
            asset_condition: data.asset_condition !== undefined ? Number(data.asset_condition) : existingRecord.asset_condition,
            note: data.note || existingRecord.note,
            image_url: data.image_url || existingRecord.image_url,
            updated_at: new Date(),
          },
        });

        // Simpan gambar baru jika ada
        if (data.image_url) {
          await db.asset_taking_image.create({
            data: {
              record_id: updated.id,
              image_path: data.image_url,
              uploaded_by: data.pic ? BigInt(data.pic) : null,
              uploaded_at: new Date(),
            },
          });
        }

        return updated;
      }
    }

    // 2. Jika belum ada, LAKUKAN CREATE BARU
    const newRecord = await db.asset_taking_record.create({
      data: {
        asset_id: assetId,
        schedule_id: scheduleId,
        pic: data.pic ? BigInt(data.pic) : null,
        asset_condition: data.asset_condition ? Number(data.asset_condition) : null,
        note: data.note || null,
        image_url: data.image_url || null,
        taken_at: new Date(),
        created_at: new Date(),
      },
    });

    if (data.image_url) {
      await db.asset_taking_image.create({
        data: {
          record_id: newRecord.id,
          image_path: data.image_url,
          uploaded_by: data.pic ? BigInt(data.pic) : null,
          uploaded_at: new Date(),
        },
      });
    }

    return newRecord;
  }

  static async update(
    id: number,
    data: {
      asset_condition?: number;
      note?: string;
      image_url?: string;
      pic?: number;
    }
  ) {
    return await db.asset_taking_record.update({
      where: { id: BigInt(id) },
      data: {
        ...(data.asset_condition !== undefined && { asset_condition: Number(data.asset_condition) }),
        ...(data.note !== undefined && { note: data.note }),
        ...(data.image_url !== undefined && { image_url: data.image_url }),
        ...(data.pic !== undefined && { pic: BigInt(data.pic) }),
        updated_at: new Date(),
      },
    });
  }

  // Auto-approve Step 1 & Step 2 saat inisialisasi
  static async initScheduleSignatures(scheduleId: number, schedulePicId?: number) {
    let picUser = null;
    if (schedulePicId) {
      picUser = await db.users.findUnique({
        where: { id: BigInt(schedulePicId) },
      });
    }

    const defaultRoles = [
      // CREATED BY (Step 1 - 4)
      {
        type: 'CREATED',
        role_title: 'PIC User',
        step: 1,
        user_id: schedulePicId ? BigInt(schedulePicId) : null,
        signer_name: picUser?.name || 'Maula Ubaidilah',
        signer_nik: picUser?.personal_number || '202601001',
        status: 'APPROVED',
        signed_at: new Date(),
      },
      {
        type: 'CREATED',
        role_title: 'PIC Budget Owner',
        step: 2,
        user_id: null,
        signer_name: 'Baiq Vera',
        signer_nik: '202601002',
        status: 'APPROVED',
        signed_at: new Date(),
      },
      { type: 'CREATED', role_title: 'PIC Accounting', step: 3, status: 'PENDING' },
      { type: 'CREATED', role_title: 'PIC Internal Audit', step: 4, status: 'PENDING' },

      // ACKNOWLEDGED BY (Step 5 - 11)
      { type: 'ACKNOWLEDGED', role_title: 'User Dept. Head', step: 5, status: 'PENDING' },
      { type: 'ACKNOWLEDGED', role_title: 'User Div. Head', step: 6, status: 'PENDING' },
      { type: 'ACKNOWLEDGED', role_title: 'Budget Owner Dept. Head', step: 7, status: 'PENDING' },
      { type: 'ACKNOWLEDGED', role_title: 'Budget Owner Div. Head', step: 8, status: 'PENDING' },
      { type: 'ACKNOWLEDGED', role_title: 'Internal Audit Dept. Head', step: 9, status: 'PENDING' },
      { type: 'ACKNOWLEDGED', role_title: 'Accounting Dept. Head', step: 10, status: 'PENDING' },
      { type: 'ACKNOWLEDGED', role_title: 'C. FAP Division Head', step: 11, status: 'PENDING' },
    ];

    const signaturesData = defaultRoles.map((role) => ({
      schedule_id: BigInt(scheduleId),
      type: role.type,
      role_title: role.role_title,
      user_id: role.user_id || null,
      signer_name: role.signer_name || null,
      signer_nik: role.signer_nik || null,
      status: role.status || 'PENDING',
      signed_at: role.signed_at || null,
      notes: String(role.step),
    }));

    await db.asset_taking_signatures.createMany({
      data: signaturesData,
    });
  }

  // Approval sekuensial berdasarkan Token Login User
  static async approveSequential(data: { signatureId: number; userId: number }) {
    const targetSig = await db.asset_taking_signatures.findUnique({
      where: { id: BigInt(data.signatureId) },
    });

    if (!targetSig) throw new Error('Data tanda tangan tidak ditemukan');
    if (targetSig.status === 'APPROVED') throw new Error('Posisi ini sudah ditandatangani');

    const currentStep = Number(targetSig.notes || 1);

    if (currentStep > 1) {
      const allSigs = await db.asset_taking_signatures.findMany({
        where: { schedule_id: targetSig.schedule_id },
      });

      const unapprovedPrevious = allSigs.filter((s: any) => {
        const step = Number(s.notes || 0);
        return step < currentStep && s.status !== 'APPROVED';
      });

      if (unapprovedPrevious.length > 0) {
        throw new Error('Approval harus berurutan! Harap tunggu antrean sebelumnya selesai ditandatangani.');
      }
    }

    const user = await db.users.findUnique({
      where: { id: BigInt(data.userId) },
    });

    if (!user) {
      throw new Error('User penandatangan tidak terdaftar di database');
    }

    const updatedSig = await db.asset_taking_signatures.update({
      where: { id: BigInt(data.signatureId) },
      data: {
        user_id: user.id,
        signer_name: user.name,
        signer_nik: user.personal_number,
        status: 'APPROVED',
        signed_at: new Date(),
        updated_at: new Date(),
      },
    });

    const remainingPending = await db.asset_taking_signatures.count({
      where: {
        schedule_id: targetSig.schedule_id,
        status: 'PENDING',
      },
    });

    if (remainingPending === 0) {
      await db.asset_taking_schedules.update({
        where: { id: targetSig.schedule_id },
        data: { status: 'APPROVED', updated_at: new Date() },
      });
    }

    return updatedSig;
  }

  static async getReportByScheduleId(scheduleId: number) {
    const schedule = await db.asset_taking_schedules.findUnique({
      where: { id: BigInt(scheduleId) },
    });

    if (!schedule) return null;

    const records = await db.asset_taking_record.findMany({
      where: { schedule_id: BigInt(scheduleId) },
      include: {
        mst_asset: true,
        asset_taking_image: true,
      },
    });

    let signatures = await db.asset_taking_signatures.findMany({
      where: { schedule_id: BigInt(scheduleId) },
    });

    if (signatures.length === 0) {
      await this.initScheduleSignatures(scheduleId, Number(schedule.pic));
      signatures = await db.asset_taking_signatures.findMany({
        where: { schedule_id: BigInt(scheduleId) },
      });
    }

    const pendingSteps = signatures
      .filter((s: any) => s.status === 'PENDING')
      .map((s: any) => Number(s.notes || 99))
      .sort((a, b) => a - b);

    const activeStep = pendingSteps.length > 0 ? pendingSteps[0] : 999;

    const createdByRolesOrder = [
      'PIC Internal Audit',
      'PIC Accounting',
      'PIC Budget Owner',
      'PIC User',
    ];
    const acknowledgedByRolesOrder = [
      'C. FAP Division Head',
      'Accounting Dept. Head',
      'Internal Audit Dept. Head',
      'Budget Owner Div. Head',
      'Budget Owner Dept. Head',
      'User Div. Head',
      'User Dept. Head',
    ];

    const mapSignatureData = (roleName: string) => {
      const sig = signatures.find((s: any) => s.role_title === roleName);
      if (!sig) return null;
      const step = Number(sig.notes || 0);

      return {
        id: sig.id,
        role: sig.role_title,
        signer_name: sig.signer_name || '-',
        signer_nik: sig.signer_nik || '-',
        status: sig.status,
        signed_at: sig.signed_at,
        step_order: step,
        can_sign: sig.status === 'PENDING' && step === activeStep,
      };
    };

    return {
      header: {
        no_ba: `BA/UTE/IT/${schedule.period_year || new Date().getFullYear()}/${schedule.id}`,
        tanggal: schedule.created_at,
        plant: schedule.plant,
        company_code: schedule.company_code,
        status: schedule.status,
      },
      items: records.map((rec) => ({
        id: rec.id,
        nomor_aset: rec.mst_asset?.asset_num || '-',
        sub_number: rec.mst_asset?.sub_asset_num || '-',
        deskripsi: rec.mst_asset?.asset_desc || '-',
        qty_fisik: rec.mst_asset?.asset_qty || 1,
        qty_sap: rec.mst_asset?.asset_qty || 1,
        qty_diff: 0,
        lokasi_aset_fisik: rec.mst_asset?.location || '-',
        lokasi_aset_sap: rec.mst_asset?.location || '-',
        kondisi_aset: rec.asset_condition === 1 ? 'Baik' : 'Perlu Penggantian',
        utilisasi_aset: 'Physical Availability Rate',
        teknologi_aset: 'Active',
        lisensi_aset: 'Active',
        catatan: rec.note,
        images: rec.asset_taking_image.map((img) => img.image_path),
      })),
      signatures: {
        created_by: createdByRolesOrder.map(mapSignatureData).filter(Boolean),
        acknowledged_by: acknowledgedByRolesOrder.map(mapSignatureData).filter(Boolean),
      },
    };
  }
}