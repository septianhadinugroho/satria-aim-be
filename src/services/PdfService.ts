import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Pemetaan Nama Pejabat Default berdasarkan Jabatan/Role
const DEFAULT_ROLE_SIGNERS: Record<string, string> = {
  'PIC Internal Audit': 'Dicky N',
  'PIC Accounting': 'Avida Ayu M',
  'PIC Budget Owner': 'Baiq Vera',
  'PIC User': 'Maula Ubaidilah',
  'User Dept. Head': 'Rifi Prasetyo',
  'User Div. Head': 'Firda Amelia',
  'Budget Owner Dept. Head': 'R. Moh Fachrudin',
  'Budget Owner Div. Head': 'Bakti Prasetyo',
  'Internal Audit Dept. Head': 'Andrio P. W.',
  'Accounting Dept. Head': 'Reza Arizona',
  'C. FAP Division Head': 'C. FAP Div Head',
};

export class PdfService {
  private static getLogoBase64(): string {
    const logoPath = path.join(__dirname, '../assets/utpe-logo.png');
    if (fs.existsSync(logoPath)) {
      const bitmap = fs.readFileSync(logoPath);
      return `data:image/png;base64,${bitmap.toString('base64')}`;
    }
    return '';
  }

  private static async getImageUrlToBase64(url: string): Promise<string> {
    if (!url) return '';
    try {
      if (fs.existsSync(url)) {
        const bitmap = fs.readFileSync(url);
        return `data:image/png;base64,${bitmap.toString('base64')}`;
      }

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 3000,
      });
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      return `data:${contentType};base64,${base64}`;
    } catch {
      return url;
    }
  }

  private static formatDate(dateString: string | Date): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  static async generateBaPdf(reportData: any): Promise<Buffer> {
    const logoBase64 = this.getLogoBase64();
    const formattedDate = this.formatDate(reportData.header.tanggal);

    const imageList: string[] = [];
    for (const item of reportData.items) {
      if (item.images && item.images.length > 0) {
        for (const imgUrl of item.images) {
          if (imgUrl) {
            const processedImg = await this.getImageUrlToBase64(imgUrl);
            imageList.push(processedImg);
          }
        }
      }
    }

    // Helper 1: Render Kotak Stamp / Status Signature (Baris Tengah)
    const renderSigStamp = (sig: any) => {
      if (!sig) return '<div class="sig-blank"></div>';
      if (sig.status === 'APPROVED') {
        const signedDate = sig.signed_at
          ? new Date(sig.signed_at).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }).replace(/\./g, ':')
          : '';
        return `
          <div class="sig-approved">
            <span class="badge-approved">DIGITAL SIGNATURE</span>
            <div class="sig-date">${signedDate}</div>
          </div>
        `;
      }
      return '<div class="sig-pending">Menunggu Approval</div>';
    };

    // Helper 2: Render Nama Penandatangan (Baris Bawah Terpisah) - Selalu Tampil Nama Pejabat
    const renderSigName = (sig: any, roleTitle: string) => {
      if (sig && sig.signer_name && sig.signer_name !== '-') {
        return sig.signer_name;
      }
      return DEFAULT_ROLE_SIGNERS[roleTitle] || '-';
    };

    const getSigByRole = (roleTitle: string) => {
      const allSigs = [
        ...(reportData.signatures.created_by || []),
        ...(reportData.signatures.acknowledged_by || []),
      ];
      return allSigs.find((s: any) => s.role === roleTitle);
    };

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

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 8.5pt;
            color: #000;
            line-height: 1.25;
            margin: 0;
            padding: 0;
          }
          
          .page-border {
            border: 1.5px solid #000;
            padding: 12px;
            width: 100%;
          }

          .header-container {
            position: relative;
            text-align: center;
            margin-bottom: 6px;
            width: 100%;
          }
          .title-main {
            font-size: 11pt;
            font-weight: bold;
            margin: 0;
          }
          .title-sub {
            font-size: 9pt;
            font-weight: bold;
            margin-top: 2px;
          }
          .title-note {
            font-size: 7.5pt;
            font-style: italic;
            margin-top: 1px;
          }
          .logo-header {
            position: absolute;
            right: 0;
            top: 0;
            height: 40px;
            object-fit: contain;
          }
          .divider {
            border-bottom: 2px solid #000;
            margin: 6px 0 10px 0;
          }

          .salutation {
            font-weight: bold;
            margin-bottom: 3px;
          }
          .intro-p {
            margin: 2px 0;
          }

          table.data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            font-size: 7pt;
          }
          table.data-table th, table.data-table td {
            border: 1px solid #000;
            padding: 3px 2px;
            text-align: center;
            vertical-align: middle;
            word-wrap: break-word;
          }
          table.data-table th {
            background-color: #d9d9d9;
            font-weight: bold;
            text-transform: uppercase;
          }

          .doc-container {
            border: 1px solid #000;
            padding: 6px;
            margin-top: 8px;
            min-height: 80px;
          }
          .doc-title {
            font-weight: bold;
            margin-bottom: 6px;
          }
          .doc-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
          }
          .doc-img {
            max-height: 110px;
            max-width: 220px;
            border: 1px solid #ccc;
            object-fit: contain;
          }

          .closing-text {
            margin-top: 10px;
            margin-bottom: 10px;
          }
          .section-sig-title {
            font-weight: bold;
            margin-top: 8px;
            margin-bottom: 3px;
          }

          table.sig-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 7pt;
            margin-bottom: 8px;
            table-layout: fixed;
          }
          table.sig-table th, table.sig-table td {
            border: 1px solid #000;
            text-align: center;
            vertical-align: middle;
            padding: 3px 2px;
          }
          table.sig-table th {
            font-weight: bold;
            background-color: #e9ecef;
            height: 20px;
            line-height: 1.1;
          }
          table.sig-table tr.sig-stamp-row td {
            height: 48px;
          }
          table.sig-table tr.sig-name-row td {
            height: 22px;
            font-weight: bold;
            font-size: 7pt;
            background-color: #fafafa;
          }

          .sig-approved {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
          }
          .badge-approved {
            color: #198754;
            font-weight: bold;
            font-size: 6.5pt;
            letter-spacing: 0.3px;
          }
          .sig-date { font-size: 6pt; color: #555; margin-top: 2px; }
          .sig-pending {
            color: #888;
            font-style: italic;
            font-size: 6.5pt;
          }
        </style>
      </head>
      <body>

        <div class="page-border">
          <div class="header-container">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-header" />` : ''}
            <div class="title-main">Form Laporan Hasil Pengecekan Aset atau Asset Taking</div>
            <div class="title-sub">NO : ${reportData.header.no_ba}</div>
            <div class="title-note">(Nomor BA diisi oleh Masing-Masing Budget Owner)</div>
          </div>
          <div class="divider"></div>

          <div class="salutation">Dengan Hormat</div>
          <div class="intro-p">
            Pada tanggal ${formattedDate} telah dilakukan <b>pengecekan aset/ asset taking</b> untuk area Plant ${reportData.header.plant || '-'}
          </div>
          <div class="intro-p">
            Dengan ini kami sampaikan hasil pengecekan aset/asset taking dengan rincian sebagai berikut:
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 20px;">NO</th>
                <th style="width: 55px;">NOMOR ASET</th>
                <th style="width: 25px;">SUB</th>
                <th>DESKRIPSI</th>
                <th style="width: 25px;">QTY FISIK</th>
                <th style="width: 25px;">QTY SAP</th>
                <th style="width: 25px;">QTY DIFF</th>
                <th>LOKASI ASET FISIK</th>
                <th>LOKASI ASET SAP</th>
                <th>KONDISI ASET</th>
                <th>UTILISASI ASET</th>
                <th>TEKNOLOGI ASET</th>
                <th>LISENSI ASET</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.items
                .map(
                  (item: any, idx: number) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${item.nomor_aset}</td>
                  <td>${item.sub_number}</td>
                  <td style="text-align: left;">${item.deskripsi}</td>
                  <td>${item.qty_fisik}</td>
                  <td>${item.qty_sap}</td>
                  <td>${item.qty_diff}</td>
                  <td>${item.lokasi_aset_fisik}</td>
                  <td>${item.lokasi_aset_sap}</td>
                  <td>${item.kondisi_aset}</td>
                  <td>${item.utilisasi_aset}</td>
                  <td>${item.teknologi_aset}</td>
                  <td>${item.lisensi_aset}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <div class="doc-container">
            <div class="doc-title">Dokumentasi :</div>
            <div class="doc-grid">
              ${
                imageList.length > 0
                  ? imageList
                      .map((src) => `<img src="${src}" class="doc-img" />`)
                      .join('')
                  : '<span style="color: #888;">Tidak ada foto dokumentasi</span>'
              }
            </div>
          </div>

          <div class="closing-text">
            Demikian laporan ini kami buat, atas perhatian Bapak / Ibu kami mengucapkan terima kasih.
            <br /><br />
            Cikarang, ${formattedDate}
          </div>

          <!-- SIGNATURES CREATED BY -->
          <div class="section-sig-title">Created by,</div>
          <table class="sig-table">
            <thead>
              <tr>
                ${createdByRolesOrder.map((role) => `<th>${role}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr class="sig-stamp-row">
                ${createdByRolesOrder
                  .map((role) => `<td>${renderSigStamp(getSigByRole(role))}</td>`)
                  .join('')}
              </tr>
              <tr class="sig-name-row">
                ${createdByRolesOrder
                  .map((role) => `<td>${renderSigName(getSigByRole(role), role)}</td>`)
                  .join('')}
              </tr>
            </tbody>
          </table>

          <!-- SIGNATURES ACKNOWLEDGED BY -->
          <div class="section-sig-title">Acknowledged by,</div>
          <table class="sig-table">
            <thead>
              <tr>
                ${acknowledgedByRolesOrder.map((role) => `<th>${role}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr class="sig-stamp-row">
                ${acknowledgedByRolesOrder
                  .map((role) => `<td>${renderSigStamp(getSigByRole(role))}</td>`)
                  .join('')}
              </tr>
              <tr class="sig-name-row">
                ${acknowledgedByRolesOrder
                  .map((role) => `<td>${renderSigName(getSigByRole(role), role)}</td>`)
                  .join('')}
              </tr>
            </tbody>
          </table>
        </div>

      </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
    });

    await browser.close();
    return Buffer.from(pdfBuffer);
  }
}