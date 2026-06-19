import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';

export async function GET() {
  try {
    const wb = xlsx.utils.book_new();

    // Sample data rows
    const sampleRows = [
      {
        "Level": "Tujuan",
        "Teks / Nomenklatur": "Meningkatkan kesiapsiagaan bencana daerah",
        "Indikator Kinerja": "Indeks Ketahanan Daerah (IKD)",
        "Satuan": "Indeks",
        "Tipe Target": "Kondisi Akhir Naik",
        "Target 2025": "0.6",
        "Target 2026": "0.7",
        "Target 2027": "0.8",
        "Target 2028": "0.9",
        "Target 2029": "1.0",
        "Target 2030": "1.0",
        "Target Akhir": "1.0",
        "Anggaran 2025": "",
        "Anggaran 2026": "",
        "Anggaran 2027": "",
        "Anggaran 2028": "",
        "Anggaran 2029": "",
        "Anggaran 2030": "",
        "Anggaran Akhir": "",
        "Bidang Pengampu": "Badan",
        "Kode Master": ""
      },
      {
        "Level": "Sasaran",
        "Teks / Nomenklatur": "Meningkatnya kapasitas penanganan darurat bencana",
        "Indikator Kinerja": "Persentase kejadian bencana yang tertangani dengan cepat",
        "Satuan": "%",
        "Tipe Target": "Kondisi Akhir Naik",
        "Target 2025": "85",
        "Target 2026": "87",
        "Target 2027": "90",
        "Target 2028": "92",
        "Target 2029": "95",
        "Target 2030": "95",
        "Target Akhir": "95",
        "Anggaran 2025": "",
        "Anggaran 2026": "",
        "Anggaran 2027": "",
        "Anggaran 2028": "",
        "Anggaran 2029": "",
        "Anggaran 2030": "",
        "Anggaran Akhir": "",
        "Bidang Pengampu": "Bidang Kedaruratan dan Logistik",
        "Kode Master": ""
      },
      {
        "Level": "", // Empty level means additional indicator for Sasaran
        "Teks / Nomenklatur": "",
        "Indikator Kinerja": "Waktu respon rata-rata penanganan darurat (menit)",
        "Satuan": "Menit",
        "Tipe Target": "Kondisi Akhir Menurun",
        "Target 2025": "30",
        "Target 2026": "25",
        "Target 2027": "20",
        "Target 2028": "15",
        "Target 2029": "15",
        "Target 2030": "15",
        "Target Akhir": "15",
        "Anggaran 2025": "",
        "Anggaran 2026": "",
        "Anggaran 2027": "",
        "Anggaran 2028": "",
        "Anggaran 2029": "",
        "Anggaran 2030": "",
        "Anggaran Akhir": "",
        "Bidang Pengampu": "",
        "Kode Master": ""
      },
      {
        "Level": "Program",
        "Teks / Nomenklatur": "PROGRAM PENCEGAHAN DAN KESIAPSIAGAAN BENCANA",
        "Indikator Kinerja": "Persentase wilayah aman bencana",
        "Satuan": "%",
        "Tipe Target": "Kondisi Akhir Naik",
        "Target 2025": "45",
        "Target 2026": "50",
        "Target 2027": "55",
        "Target 2028": "60",
        "Target 2029": "65",
        "Target 2030": "70",
        "Target Akhir": "70",
        "Anggaran 2025": "",
        "Anggaran 2026": "",
        "Anggaran 2027": "",
        "Anggaran 2028": "",
        "Anggaran 2029": "",
        "Anggaran 2030": "",
        "Anggaran Akhir": "",
        "Bidang Pengampu": "Bidang Pencegahan dan Kesiapsiagaan",
        "Kode Master": ""
      },
      {
        "Level": "Kegiatan",
        "Teks / Nomenklatur": "Pencegahan Bencana Daerah",
        "Indikator Kinerja": "Jumlah kajian risiko bencana yang tersusun",
        "Satuan": "Kajian",
        "Tipe Target": "Akumulatif",
        "Target 2025": "1",
        "Target 2026": "1",
        "Target 2027": "1",
        "Target 2028": "1",
        "Target 2029": "1",
        "Target 2030": "1",
        "Target Akhir": "6",
        "Anggaran 2025": "",
        "Anggaran 2026": "",
        "Anggaran 2027": "",
        "Anggaran 2028": "",
        "Anggaran 2029": "",
        "Anggaran 2030": "",
        "Anggaran Akhir": "",
        "Bidang Pengampu": "Bidang Pencegahan dan Kesiapsiagaan",
        "Kode Master": ""
      },
      {
        "Level": "Subkegiatan",
        "Teks / Nomenklatur": "Penyusunan Rencana Penanggulangan Bencana",
        "Indikator Kinerja": "", // Biarkan kosong, akan otomatis dicocokkan & ditarik dari MasterSubkegiatan
        "Satuan": "",            // Biarkan kosong, akan otomatis dicocokkan & ditarik dari MasterSubkegiatan
        "Tipe Target": "Kondisi Akhir Naik",
        "Target 2025": "100",
        "Target 2026": "100",
        "Target 2027": "100",
        "Target 2028": "100",
        "Target 2029": "100",
        "Target 2030": "100",
        "Target Akhir": "100",
        "Anggaran 2025": "150000000",
        "Anggaran 2026": "160000000",
        "Anggaran 2027": "170000000",
        "Anggaran 2028": "180000000",
        "Anggaran 2029": "190000000",
        "Anggaran 2030": "200000000",
        "Anggaran Akhir": "1050000000",
        "Bidang Pengampu": "Bidang Pencegahan dan Kesiapsiagaan",
        "Kode Master": "" // Boleh kosong (dicocokkan via Nomenklatur) atau diisi ID Master (misal: '1.02.03.2.01')
      }
    ];

    const ws = xlsx.utils.json_to_sheet(sampleRows);
    xlsx.utils.book_append_sheet(wb, ws, "Template Renstra");

    // Legends sheet
    const legends = [
      {
        "Kolom": "Level",
        "Keterangan": "Tingkat hierarki indikator.",
        "Nilai Valid / Format": "Tujuan, Sasaran, Program, Kegiatan, Subkegiatan, Aktivitas. (Bisa dikosongkan untuk menambahkan indikator tambahan pada baris sebelumnya)."
      },
      {
        "Kolom": "Teks / Nomenklatur",
        "Keterangan": "Nama atau uraian dari level tersebut.",
        "Nilai Valid / Format": "Uraian teks bebas. Contoh: 'Penyusunan Rencana Penanggulangan Bencana'."
      },
      {
        "Kolom": "Indikator Kinerja",
        "Keterangan": "Nama indikator kinerja. Khusus level 'Subkegiatan', kolom ini BOLEH DIKOSONGKAN karena akan diisi otomatis dari database master.",
        "Nilai Valid / Format": "Uraian teks bebas."
      },
      {
        "Kolom": "Satuan",
        "Keterangan": "Satuan pengukuran target. Khusus level 'Subkegiatan', kolom ini BOLEH DIKOSONGKAN karena akan diisi otomatis dari database master.",
        "Nilai Valid / Format": "Contoh: %, Orang, Dokumen, Skala, Indeks, Desa, Rupiah"
      },
      {
        "Kolom": "Tipe Target",
        "Keterangan": "Cara perhitungan target akhir dari tahun-tahun berjalan.",
        "Nilai Valid / Format": "Kondisi Akhir Naik (default), Kondisi Akhir Menurun, Akumulatif"
      },
      {
        "Kolom": "Target 2025 - 2030, Target Akhir",
        "Keterangan": "Target kuantitatif per tahun dan target akhir.",
        "Nilai Valid / Format": "Angka atau nilai target (berupa teks/angka)"
      },
      {
        "Kolom": "Anggaran 2025 - 2030, Anggaran Akhir",
        "Keterangan": "Anggaran per tahun (khusus untuk Subkegiatan).",
        "Nilai Valid / Format": "Angka saja. Contoh: 150000000 (tanpa titik/koma)"
      },
      {
        "Kolom": "Bidang Pengampu",
        "Keterangan": "Bidang penanggung jawab. Bisa diisi lebih dari satu (pisahkan dengan koma).",
        "Nilai Valid / Format": "Badan, Sekretariat, Tata Usaha, Bidang Pencegahan dan Kesiapsiagaan, Bidang Kedaruratan dan Logistik, Bidang Rehabilitasi dan Rekonstruksi"
      },
      {
        "Kolom": "Kode Master",
        "Keterangan": "Kode ID Master (dari Master Program/Kegiatan/Subkegiatan) jika ada.",
        "Nilai Valid / Format": "Kode master, misal: '1.02.03.2.01'. Jika dikosongkan, sistem akan mencoba mencocokkan otomatis berdasarkan Uraian Nomenklatur secara case-insensitive."
      }
    ];

    const wsLegends = xlsx.utils.json_to_sheet(legends);
    xlsx.utils.book_append_sheet(wb, wsLegends, "Panduan Pengisian");

    // Write workbook to buffer
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template_renstra_import.xlsx"',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
