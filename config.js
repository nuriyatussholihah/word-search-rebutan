// Konfigurasi aplikasi Word Search Rebutan
module.exports = {
  // Port server (menggunakan environment variable PORT untuk deployment gratis seperti Render)
  PORT: process.env.PORT || 3000,

  // PIN rahasia untuk login ke halaman /host
  HOST_PIN: process.env.HOST_PIN || "limo123",

  // Ukuran grid word search (15x15)
  GRID_SIZE: 15,

  // Durasi default per kategori dalam detik (3 menit = 180 detik)
  DEFAULT_DURATION_SECONDS: 180,

  // Pilihan durasi yang tersedia untuk host (dalam menit)
  DURATION_OPTIONS_MINUTES: [2, 3, 4, 5],

  // Durasi rekap per kategori untuk estimasi waktu (1 menit = 60 detik)
  RECAP_DURATION_MINUTES: 1,

  // Waktu pembukaan dan penutup untuk estimasi waktu sesi (7 menit)
  INTRO_OUTRO_MINUTES: 7,

  // Ambang batas persentase kata ditemukan untuk pesan perayaan (80%)
  CELEBRATION_THRESHOLD_PERCENT: 80
};
