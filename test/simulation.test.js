// Skrip Uji Coba Simulasi Penuh Game Word Search Rebutan
const assert = require('assert');
const config = require('../config');
const categories = require('../categories');
const GameManager = require('../gameState');

async function runTests() {
  console.log('--- MEMULAI PENGUJIAN WORD SEARCH REBUTAN ---');

  // Mock IO untuk pengujian game manager
  const emittedEvents = [];
  const mockIo = {
    emit: (event, data) => {
      emittedEvents.push({ event, data });
    }
  };

  const game = new GameManager(mockIo);

  // 1. Test Estimasi Waktu Sesi (PRD Poin 12)
  console.log('\n--- Test 1: Formula Estimasi Waktu Sesi ---');
  // Formula: (jumlah kategori × (durasi + 1 menit rekap)) + 7 menit pembukaan dan penutup
  // Default: 8 kategori, durasi 3 menit -> (8 * (3 + 1)) + 7 = 32 + 7 = 39 menit
  const estDefault = game.getEstimatedDurationMinutes();
  assert.strictEqual(estDefault, 39, `Estimasi default harus 39 menit, dapat ${estDefault}`);
  console.log(`✓ Estimasi default 8 kategori, 3 menit = ${estDefault} menit (Cocok dengan PRD 39 menit!)`);

  // Ubah ke 5 kategori, 2 menit -> (5 * (2 + 1)) + 7 = 15 + 7 = 22 menit
  game.configureSession({ categoryIds: [1, 2, 3, 4, 5], durationMinutes: 2 });
  const estCustom = game.getEstimatedDurationMinutes();
  assert.strictEqual(estCustom, 22, `Estimasi custom harus 22 menit, dapat ${estCustom}`);
  console.log(`✓ Estimasi custom 5 kategori, 2 menit = ${estCustom} menit (Sesuai formula!)`);

  // Reset kembali ke default
  game.configureSession({ categoryIds: categories.map(c => c.id), durationMinutes: 3 });

  // 2. Test Registrasi Pemain & Validasi Nama (PRD Poin 1)
  console.log('\n--- Test 2: Registrasi Pemain & Keunikan Nama ---');
  const reg1 = game.registerPlayer('');
  assert.strictEqual(reg1.success, false, 'Nama kosong harus ditolak');
  console.log('✓ Nama kosong berhasil ditolak');

  const reg2 = game.registerPlayer('Budi');
  assert.strictEqual(reg2.success, true, 'Nama "Budi" harus berhasil didaftarkan');
  const budiToken = reg2.token;

  const reg3 = game.registerPlayer('budi'); // case-insensitive check
  assert.strictEqual(reg3.success, false, 'Nama kembar ("budi") harus ditolak');
  console.log('✓ Nama kembar berhasil ditolak');

  const reg4 = game.registerPlayer('Ani');
  assert.strictEqual(reg4.success, true, 'Nama "Ani" harus berhasil didaftarkan');
  const aniToken = reg4.token;

  const reg5 = game.registerPlayer('Candra');
  const candraToken = reg5.token;
  console.log('✓ Pemain Budi, Ani, dan Candra berhasil didaftarkan');

  // 3. Test Reconnect (PRD Poin 11)
  console.log('\n--- Test 3: Reconnect Pemain via Token ---');
  const recResult = game.reconnectPlayer(budiToken, 'socket_dummy_123');
  assert.strictEqual(recResult.success, true, 'Reconnect dengan token valid harus berhasil');
  assert.strictEqual(recResult.player.name, 'Budi');
  console.log('✓ Reconnect pemain berhasil mempertahankan nama dan identitas');

  // 4. Test Mulai Kategori & Grid Generator 15x15 (PRD Poin 3, 4)
  console.log('\n--- Test 4: Memulai Kategori & Verifikasi Grid 15x15 ---');
  game.startCategory(0); // Kategori 1: "Istilah Dev"
  assert.strictEqual(game.status, 'PLAYING');
  assert.strictEqual(game.currentCategory.name, 'Istilah Dev');
  assert.strictEqual(game.grid.length, 15);
  assert.strictEqual(game.grid[0].length, 15);
  assert.strictEqual(Object.keys(game.placedWords).length, 9, 'Semua 9 kata harus terpasang di grid');
  console.log('✓ Grid 15x15 digenerate dengan 9 kata lengkap tanpa tabrakan');

  // 5. Test Validasi Drag Pemilihan Kata (PRD Poin 5, 6)
  console.log('\n--- Test 5: Drag & Submit Kata Valid dan Invalid ---');
  const firstWordKey = Object.keys(game.placedWords)[0];
  const placement = game.placedWords[firstWordKey];

  // Submit kata yang benar oleh Budi
  const submitValid = game.submitWord(budiToken, placement.start, placement.end);
  assert.strictEqual(submitValid.success, true, `Kata ${firstWordKey} harus valid`);
  assert.strictEqual(submitValid.word, firstWordKey);
  assert.strictEqual(game.foundWords.length, 1);
  console.log(`✓ Budi berhasil menemukan kata "${firstWordKey}"`);

  // Submit kata yang sama oleh Ani (tidak boleh diklaim ulang)
  const submitDuplicate = game.submitWord(aniToken, placement.start, placement.end);
  assert.strictEqual(submitDuplicate.success, false, 'Kata yang sudah ketemu tidak boleh diklaim ulang');
  console.log('✓ Kata yang sudah ditemukan tidak dapat diklaim ulang oleh pemain lain');

  // Submit koordinat acak yang tidak membentuk kata
  const submitInvalid = game.submitWord(aniToken, { r: 0, c: 0 }, { r: 0, c: 1 });
  assert.strictEqual(submitInvalid.success, false);
  console.log('✓ Kata tidak terdaftar berhasil ditolak');

  // 6. Test Fitur Hint (PRD Poin 2, 8)
  console.log('\n--- Test 6: Fitur Hint (Maksimal 1x per Kategori) ---');
  assert.strictEqual(game.hintUsed, false);
  const hintResult1 = game.useHint();
  assert.strictEqual(hintResult1.success, true);
  assert.strictEqual(game.hintUsed, true);
  console.log(`✓ Hint berhasil digunakan: Huruf pertama "${hintResult1.hint.firstLetter}" untuk kata "${hintResult1.hint.word}"`);

  const hintResult2 = game.useHint();
  assert.strictEqual(hintResult2.success, false, 'Hint kedua kali pada kategori yang sama harus ditolak');
  console.log('✓ Hint kedua kali berhasil ditolak (maksimal 1x per kategori)');

  // 7. Test Timer Controls (Add Time & Pause)
  console.log('\n--- Test 7: Timer Controls (+30 Detik & Pause) ---');
  const timeBefore = game.remainingSeconds;
  game.addTime(30);
  assert.strictEqual(game.remainingSeconds, timeBefore + 30);
  console.log(`✓ Tambah 30 detik berhasil: ${timeBefore}s -> ${game.remainingSeconds}s`);

  assert.strictEqual(game.isPaused, false);
  game.togglePause();
  assert.strictEqual(game.isPaused, true);
  game.togglePause();
  assert.strictEqual(game.isPaused, false);
  console.log('✓ Toggle pause/resume timer berfungsi');

  // 8. Selesaikan kata di Kategori 1 untuk simulasi
  console.log('\n--- Test 8: Penyelesaian Kategori & Transisi ke Rekap ---');
  const remainingWordKeys = Object.keys(game.placedWords).slice(1);

  // Ani menemukan kata di detik terakhir (simulasi remainingSeconds <= 10)
  game.remainingSeconds = 8;
  const wordAni = remainingWordKeys[0];
  const pAni = game.placedWords[wordAni];
  game.submitWord(aniToken, pAni.start, pAni.end);

  // Candra menemukan kata terpanjang
  let longestWord = '';
  let longestPlacement = null;
  remainingWordKeys.slice(1).forEach(w => {
    if (w.length > longestWord.length) {
      longestWord = w;
      longestPlacement = game.placedWords[w];
    }
  });

  if (longestPlacement) {
    game.submitWord(candraToken, longestPlacement.start, longestPlacement.end);
  }

  // Budi menemukan sisa kata lainnya
  remainingWordKeys.forEach(w => {
    if (w !== wordAni && w !== longestWord) {
      const p = game.placedWords[w];
      game.submitWord(budiToken, p.start, p.end);
    }
  });

  // Akhiri kategori 1
  game.endCurrentCategory('Selesai');
  assert.strictEqual(game.status, 'CATEGORY_RECAP');
  assert.strictEqual(game.history.length, 1);
  console.log(`✓ Kategori 1 selesai dengan ${game.history[0].foundCount}/${game.history[0].totalWords} kata ditemukan`);

  // 9. Test Akhiri Sesi & Penghargaan Lucu (PRD Poin 9, 10)
  console.log('\n--- Test 9: Ringkasan Akhir & 3 Penghargaan Lucu ---');
  game.finishSession();
  assert.strictEqual(game.status, 'FINAL_SUMMARY');

  const summary = game.calculateFinalSummary();
  console.log(`✓ Total kata ditemukan: ${summary.totalFoundWords}/${summary.totalPlayedWords} (${summary.percentage}%)`);
  console.log(`✓ Pesan tim: "${summary.message}" (Perayaan: ${summary.isCelebration})`);

  // Verifikasi 3 Penghargaan Lucu (HANYA NAMA, TANPA ANGKA)
  console.log('Penghargaan yang diperoleh:');
  console.log(`- ${summary.awards.mataElang.title}: ${summary.awards.mataElang.names.join(', ')}`);
  console.log(`- ${summary.awards.penyelamatDetikTerakhir.title}: ${summary.awards.penyelamatDetikTerakhir.names.join(', ')}`);
  console.log(`- ${summary.awards.pemburuKataPanjang.title}: ${summary.awards.pemburuKataPanjang.names.join(', ')}`);

  assert.ok(summary.awards.mataElang.names.length > 0, 'Si Mata Elang harus ada');
  assert.ok(summary.awards.penyelamatDetikTerakhir.names.includes('Ani'), 'Ani harus mendapat Penyelamat Detik Terakhir');
  assert.ok(summary.awards.pemburuKataPanjang.names.length > 0, 'Pemburu Kata Panjang harus ada');

  // Pastikan tidak ada angka di dalam array names
  [...summary.awards.mataElang.names, ...summary.awards.penyelamatDetikTerakhir.names, ...summary.awards.pemburuKataPanjang.names].forEach(name => {
    assert.strictEqual(typeof name, 'string', 'Nama penghargaan harus bertipe string');
    assert.strictEqual(/\d/.test(name), false, `Nama "${name}" tidak boleh mengandung angka`);
  });

  game.stopTimer();

  console.log('\n===============================================');
  console.log('SEMUA 9 UJI COBA OTOMATIS BERHASIL DENGAN SUKSES! 🎉');
  console.log('===============================================');
}

runTests().catch(err => {
  console.error('Test gagal:', err);
  process.exit(1);
});
