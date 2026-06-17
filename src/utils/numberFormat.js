/**
 * Utilitas untuk memformat angka dengan standar Indonesia (titik ribuan, koma desimal).
 */

/**
 * Memformat string input pengguna secara real-time saat mengetik.
 * - Mengizinkan angka, satu koma untuk pecahan desimal.
 * - Otomatis menambahkan titik sebagai pemisah ribuan.
 */
export const formatIndonesianInput = (val) => {
  if (val === undefined || val === null) return '';
  
  let str = val.toString();
  // Hapus semua karakter kecuali angka dan koma (tanda titik manual dilarang)
  let clean = str.replace(/[^0-9,]/g, '');
  
  // Pisahkan bagian integer dan desimal berdasarkan koma pertama
  const parts = clean.split(',');
  let integerPart = parts[0];
  let decimalPart = parts[1] !== undefined ? ',' + parts[1].replace(/[.,]/g, '') : '';
  
  // Jika bagian desimal ada lebih dari satu koma, gabungkan sisanya
  if (parts.length > 2) {
    decimalPart = ',' + parts.slice(1).join('').replace(/[.,]/g, '');
  }
  
  // Bersihkan semua titik ribuan lama di bagian integer untuk dihitung ulang
  integerPart = integerPart.replace(/\./g, '');
  
  // Tambahkan titik sebagai pemisah ribuan
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return integerPart + decimalPart;
};

/**
 * Mengubah string berformat Indonesia (titik ribuan, koma desimal) menjadi
 * string desimal standar JavaScript (tanpa ribuan, titik desimal) sebelum disimpan.
 */
export const parseToStandardNumber = (val) => {
  if (val === undefined || val === null || val === '') return '0';
  
  let str = val.toString().trim();
  // Hapus titik ribuan
  str = str.replace(/\./g, '');
  // Ubah koma desimal menjadi titik desimal
  str = str.replace(/,/g, '.');
  
  // Pastikan output adalah string numerik valid
  if (isNaN(parseFloat(str))) return '0';
  return str;
};

/**
 * Memformat nilai mentah dari database (desimal titik) ke format Indonesia (koma desimal dan titik ribuan)
 * untuk ditampilkan di form edit.
 */
export const formatNumberForDisplay = (rawVal) => {
  if (rawVal === undefined || rawVal === null || rawVal === '') return '0';
  
  // Ubah tipe data number ke string, lalu ubah desimal titik menjadi koma desimal
  let str = rawVal.toString().replace(/\./g, ',');
  
  // Gunakan formatIndonesianInput untuk menambahkan pemisah ribuan
  return formatIndonesianInput(str);
};
