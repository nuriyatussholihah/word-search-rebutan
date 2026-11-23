// Logika State Game Word Search Rebutan
const config = require('./config');
const defaultCategories = require('./categories');
const { generateGrid, getCellsBetween, getWordFromCells } = require('./wordsearch');

// Palet warna unik untuk 9 kata di setiap kategori
const WORD_COLORS = [
  '#0284c7', // Sky Blue
  '#16a34a', // Emerald Green
  '#ea580c', // Orange
  '#9333ea', // Purple
  '#e11d48', // Rose Red
  '#0d9488', // Teal
  '#d97706', // Amber
  '#4f46e5', // Indigo
  '#db2777'  // Pink
];

class GameManager {
  constructor(io) {
    this.io = io;

    // Registrasi pemain: Map<token, Player>
    // Player: { id, name, socketId, connected, wordsFound: [] }
    this.players = new Map();

    // Status permainan: 'LOBBY' | 'PLAYING' | 'CATEGORY_RECAP' | 'FINAL_SUMMARY'
    this.status = 'LOBBY';

    // Konfigurasi sesi aktif
    this.categories = JSON.parse(JSON.stringify(defaultCategories)); // clone
    this.selectedCategoryIds = defaultCategories.map(c => c.id); // default semua 8
    this.durationMinutes = 3; // default 3 menit
    this.durationSeconds = 180;

    // Kategori yang sedang aktif
    this.currentCategoryIndex = -1; // index dalam array kategori terpilih
    this.currentCategory = null;
    this.grid = null;
    this.placedWords = {};
    this.foundWords = []; // [{ word, finderName, finderId, cells, color, remainingSeconds }]
    this.hintUsed = false;
    this.hintData = null; // { word, firstLetter, startCell }

    // Timer
    this.timerInterval = null;
    this.remainingSeconds = 180;
    this.isPaused = false;

    // Rekap per kategori yang sudah selesai
    // [{ categoryId, categoryName, totalWords, foundCount, foundWords: [...] }]
    this.history = [];
  }

  // ===================== PENGATURAN SESI (HOST) =====================

  configureSession(settings) {
    if (this.status !== 'LOBBY') return { success: false, message: 'Game sudah berjalan' };

    // Validasi durasi
    if (settings.durationMinutes && config.DURATION_OPTIONS_MINUTES.includes(Number(settings.durationMinutes))) {
      this.durationMinutes = Number(settings.durationMinutes);
      this.durationSeconds = this.durationMinutes * 60;
    }

    // Validasi urutan & pilihan kategori (1 sampai 8 kategori)
    if (Array.isArray(settings.categoryIds) && settings.categoryIds.length >= 1 && settings.categoryIds.length <= defaultCategories.length) {
      // Pastikan semua id valid
      const validIds = settings.categoryIds.filter(id => defaultCategories.some(c => c.id === Number(id)));
      if (validIds.length >= 1) {
        this.selectedCategoryIds = validIds.map(Number);
      }
    }

    this.broadcastSessionConfig();
    return { success: true };
  }

  getEstimatedDurationMinutes() {
    const count = this.selectedCategoryIds.length;
    return (count * (this.durationMinutes + config.RECAP_DURATION_MINUTES)) + config.INTRO_OUTRO_MINUTES;
  }

  broadcastSessionConfig() {
    this.io.emit('session_config_updated', {
      selectedCategoryIds: this.selectedCategoryIds,
      durationMinutes: this.durationMinutes,
      estimatedMinutes: this.getEstimatedDurationMinutes()
    });
  }

  // ===================== MANAJEMEN PEMAIN & RECONNECT =====================

  registerPlayer(name, existingToken = null) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return { success: false, message: 'Nama tidak boleh kosong.' };
    }

    // Cek apakah ada pemain lain yang menggunakan nama yang sama (case-insensitive)
    for (const [token, player] of this.players.entries()) {
      if (existingToken && token === existingToken) continue;
      if (player.name.toLowerCase() === trimmedName.toLowerCase()) {
        return { success: false, message: 'Nama sudah digunakan oleh pemain lain. Silakan pilih nama lain.' };
      }
    }

    let token = existingToken;
    let player = token ? this.players.get(token) : null;

    if (player) {
      // Reconnect pemain lama yang ganti nama atau konfirmasi nama
      player.name = trimmedName;
      player.connected = true;
    } else {
      // Pemain baru
      token = 'user_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      player = {
        id: token,
        name: trimmedName,
        socketId: null,
        connected: true,
        wordsFound: [] // [{ categoryId, word, length, remainingSeconds }]
      };
      this.players.set(token, player);
    }

    this.broadcastPlayerList();
    return { success: true, token, player };
  }

  reconnectPlayer(token, socketId) {
    if (!token || !this.players.has(token)) {
      return { success: false, message: 'Token tidak valid' };
    }

    const player = this.players.get(token);
    player.socketId = socketId;
    player.connected = true;

    this.broadcastPlayerList();
    return { success: true, player };
  }

  disconnectPlayer(socketId) {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        player.connected = false;
        player.socketId = null;
        break;
      }
    }
    this.broadcastPlayerList();
  }

  getPlayerList() {
    return Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      foundCount: p.wordsFound.length
    }));
  }

  broadcastPlayerList() {
    const playerList = this.getPlayerList();
    this.io.emit('player_list_updated', {
      players: playerList,
      count: playerList.filter(p => p.connected).length,
      totalRegistered: playerList.length
    });
  }

  // ===================== ALUR PERMAINAN =====================

  startCategory(categoryIndex = null) {
    if (categoryIndex !== null) {
      this.currentCategoryIndex = categoryIndex;
    } else {
      this.currentCategoryIndex++;
    }

    if (this.currentCategoryIndex >= this.selectedCategoryIds.length) {
      this.finishSession();
      return;
    }

    const catId = this.selectedCategoryIds[this.currentCategoryIndex];
    const categoryInfo = defaultCategories.find(c => c.id === catId);
    if (!categoryInfo) {
      this.finishSession();
      return;
    }

    this.currentCategory = categoryInfo;
    this.foundWords = [];
    this.hintUsed = false;
    this.hintData = null;

    // Generate grid 15x15 di server
    const { grid, placedWords } = generateGrid(categoryInfo.words, config.GRID_SIZE);
    this.grid = grid;
    this.placedWords = placedWords;

    // Reset dan mulai timer
    this.remainingSeconds = this.durationSeconds;
    this.isPaused = false;
    this.status = 'PLAYING';

    this.startTimer();

    // Broadcast ke semua pemain
    this.io.emit('category_started', this.getPublicGameState());
  }

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        this.remainingSeconds--;
        this.io.emit('timer_tick', {
          remainingSeconds: this.remainingSeconds,
          isPaused: this.isPaused
        });

        if (this.remainingSeconds <= 0) {
          this.endCurrentCategory('Waktu habis!');
        }
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  addTime(seconds = 30) {
    if (this.status !== 'PLAYING') return;
    this.remainingSeconds += seconds;
    this.io.emit('timer_tick', {
      remainingSeconds: this.remainingSeconds,
      isPaused: this.isPaused,
      added: seconds
    });
    this.io.emit('notification', { message: `Host menambahkan +${seconds} detik!` });
  }

  togglePause() {
    if (this.status !== 'PLAYING') return;
    this.isPaused = !this.isPaused;
    this.io.emit('timer_tick', {
      remainingSeconds: this.remainingSeconds,
      isPaused: this.isPaused
    });
    this.io.emit('notification', {
      message: this.isPaused ? 'Timer dijeda oleh Host' : 'Timer dilanjutkan oleh Host'
    });
  }

  useHint() {
    if (this.status !== 'PLAYING') return { success: false, message: 'Game tidak sedang berjalan' };
    if (this.hintUsed) return { success: false, message: 'Hint sudah digunakan untuk kategori ini' };

    // Cari kata yang belum ditemukan
    const foundSet = new Set(this.foundWords.map(fw => fw.word));
    const unfoundWords = this.currentCategory.words.filter(w => !foundSet.has(w));

    if (unfoundWords.length === 0) {
      return { success: false, message: 'Semua kata sudah ditemukan!' };
    }

    // Pilih satu kata yang belum ketemu
    const targetWord = unfoundWords[Math.floor(Math.random() * unfoundWords.length)];
    const placement = this.placedWords[targetWord];

    this.hintUsed = true;
    this.hintData = {
      word: targetWord,
      firstLetter: targetWord[0],
      startCell: placement.start
    };

    this.io.emit('hint_revealed', this.hintData);
    this.io.emit('notification', {
      message: `💡 Hint terbuka! Huruf pertama untuk salah satu kata adalah '${this.hintData.firstLetter}'.`
    });

    return { success: true, hint: this.hintData };
  }

  skipCategory() {
    if (this.status !== 'PLAYING') return;
    this.endCurrentCategory('Kategori dilewati oleh Host');
  }

  endCurrentCategory(reason = '') {
    this.stopTimer();
    this.status = 'CATEGORY_RECAP';

    // Simpan rekap kategori ke history
    const recapData = {
      categoryIndex: this.currentCategoryIndex,
      categoryNumber: this.currentCategoryIndex + 1,
      totalCategories: this.selectedCategoryIds.length,
      categoryId: this.currentCategory.id,
      categoryName: this.currentCategory.name,
      totalWords: this.currentCategory.words.length,
      foundCount: this.foundWords.length,
      foundWords: [...this.foundWords],
      allWords: this.currentCategory.words,
      reason
    };

    // Update atau push history
    const existingIdx = this.history.findIndex(h => h.categoryId === this.currentCategory.id);
    if (existingIdx >= 0) {
      this.history[existingIdx] = recapData;
    } else {
      this.history.push(recapData);
    }

    this.io.emit('category_ended', recapData);
  }

  nextCategory() {
    if (this.status !== 'CATEGORY_RECAP') return;
    if (this.currentCategoryIndex + 1 >= this.selectedCategoryIds.length) {
      this.finishSession();
    } else {
      this.startCategory();
    }
  }

  finishSession() {
    this.stopTimer();
    this.status = 'FINAL_SUMMARY';

    const finalSummary = this.calculateFinalSummary();
    this.io.emit('session_finished', finalSummary);
  }

  // ===================== VALIDASI KATA DARI PEMAIN =====================

  submitWord(playerToken, start, end) {
    if (this.status !== 'PLAYING') {
      return { success: false, message: 'Kategori belum atau sudah tidak aktif.' };
    }

    const player = this.players.get(playerToken);
    if (!player) {
      return { success: false, message: 'Pemain tidak terdaftar.' };
    }

    const cells = getCellsBetween(start, end);
    if (!cells || cells.length < 2) {
      return { success: false, message: 'Pilihan harus berupa garis lurus minimal 2 huruf.' };
    }

    const wordForward = getWordFromCells(this.grid, cells);
    const wordBackward = wordForward.split('').reverse().join('');

    // Cek apakah forward atau backward cocok dengan salah satu kata di kategori
    let matchedWord = null;
    let finalCells = cells;

    if (this.currentCategory.words.includes(wordForward)) {
      matchedWord = wordForward;
      finalCells = cells;
    } else if (this.currentCategory.words.includes(wordBackward)) {
      matchedWord = wordBackward;
      finalCells = [...cells].reverse();
    }

    if (!matchedWord) {
      return { success: false, message: 'Kata tidak cocok dengan daftar kata kategori ini.' };
    }

    // Cek apakah kata sudah pernah ditemukan sebelumnya
    const alreadyFound = this.foundWords.some(fw => fw.word === matchedWord);
    if (alreadyFound) {
      return { success: false, message: `Kata "${matchedWord}" sudah ditemukan sebelumnya!` };
    }

    // Kata VALID dan BELUM pernah diklaim!
    // Ambil warna unik untuk kata ini
    const colorIndex = this.foundWords.length % WORD_COLORS.length;
    const color = WORD_COLORS[colorIndex];

    const foundEntry = {
      word: matchedWord,
      finderName: player.name,
      finderId: player.id,
      cells: finalCells,
      color: color,
      remainingSeconds: this.remainingSeconds
    };

    this.foundWords.push(foundEntry);

    // Update kontribusi pemain untuk penghargaan di akhir
    player.wordsFound.push({
      categoryId: this.currentCategory.id,
      word: matchedWord,
      length: matchedWord.length,
      remainingSeconds: this.remainingSeconds
    });

    // Broadcast ke semua pemain
    this.io.emit('word_found', {
      foundEntry,
      totalFound: this.foundWords.length,
      totalWords: this.currentCategory.words.length
    });

    // Cek apakah semua 9 kata sudah ketemu
    if (this.foundWords.length >= this.currentCategory.words.length) {
      setTimeout(() => {
        if (this.status === 'PLAYING') {
          this.endCurrentCategory('Hebat! Semua kata berhasil ditemukan!');
        }
      }, 1200);
    }

    return { success: true, word: matchedWord };
  }

  // ===================== REKAP AKHIR & PENGHARGAAN LUCU =====================

  calculateFinalSummary() {
    let totalPlayedWords = 0;
    let totalFoundWords = 0;

    for (const h of this.history) {
      totalPlayedWords += h.totalWords;
      totalFoundWords += h.foundCount;
    }

    const percentage = totalPlayedWords > 0
      ? Math.round((totalFoundWords / totalPlayedWords) * 100)
      : 0;

    const isCelebration = percentage >= config.CELEBRATION_THRESHOLD_PERCENT;
    const message = isCelebration
      ? "Luar biasa! Kerja sama tim Squad Limo sangat solid! 🎉"
      : "Kerja bagus tim Squad Limo! Tetap semangat dan selalu kompak! 💪";

    // Hitung 3 Penghargaan Lucu (BUKAN RANKING, HANYA NAMA TANPA ANGKA)
    // 1. "Si Mata Elang" (penemu kata terbanyak)
    // 2. "Penyelamat Detik Terakhir" (penemu kata di 10 detik terakhir sebuah kategori)
    // 3. "Pemburu Kata Panjang" (penemu kata terpanjang)
    const awards = this.calculateAwards();

    return {
      totalPlayedCategories: this.history.length,
      totalPlannedCategories: this.selectedCategoryIds.length,
      totalPlayedWords,
      totalFoundWords,
      percentage,
      isCelebration,
      message,
      awards,
      history: this.history
    };
  }

  calculateAwards() {
    const playersList = Array.from(this.players.values());

    // 1. Si Mata Elang: penemu kata terbanyak secara keseluruhan
    let maxFoundCount = 0;
    for (const p of playersList) {
      if (p.wordsFound.length > maxFoundCount) {
        maxFoundCount = p.wordsFound.length;
      }
    }
    const mataElang = maxFoundCount > 0
      ? playersList.filter(p => p.wordsFound.length === maxFoundCount).map(p => p.name)
      : [];

    // 2. Penyelamat Detik Terakhir: penemu kata di 10 detik terakhir (remainingSeconds <= 10)
    const lastSecondFinders = new Set();
    for (const p of playersList) {
      const foundInLast10s = p.wordsFound.some(w => w.remainingSeconds <= 10 && w.remainingSeconds >= 0);
      if (foundInLast10s) {
        lastSecondFinders.add(p.name);
      }
    }
    const penyelamatDetikTerakhir = Array.from(lastSecondFinders);

    // 3. Pemburu Kata Panjang: penemu kata terpanjang yang ditemukan
    let maxLength = 0;
    for (const p of playersList) {
      for (const w of p.wordsFound) {
        if (w.length > maxLength) {
          maxLength = w.length;
        }
      }
    }
    const longWordFinders = new Set();
    if (maxLength > 0) {
      for (const p of playersList) {
        if (p.wordsFound.some(w => w.length === maxLength)) {
          longWordFinders.add(p.name);
        }
      }
    }
    const pemburuKataPanjang = Array.from(longWordFinders);

    return {
      mataElang: {
        title: "Si Mata Elang",
        description: "Penemu kata terbanyak",
        names: mataElang
      },
      penyelamatDetikTerakhir: {
        title: "Penyelamat Detik Terakhir",
        description: "Penemu kata di 10 detik terakhir",
        names: penyelamatDetikTerakhir
      },
      pemburuKataPanjang: {
        title: "Pemburu Kata Panjang",
        description: "Penemu kata terpanjang",
        names: pemburuKataPanjang
      }
    };
  }

  // ===================== STATE SERIALIZATION UNTUK CLIENT =====================

  getPublicGameState() {
    const totalSelected = this.selectedCategoryIds.length;
    const currentNumber = this.currentCategoryIndex + 1;

    let categoryPayload = null;
    if (this.currentCategory && this.status === 'PLAYING') {
      categoryPayload = {
        id: this.currentCategory.id,
        name: this.currentCategory.name,
        index: this.currentCategoryIndex,
        number: currentNumber,
        total: totalSelected,
        words: this.currentCategory.words.map(w => ({
          word: w,
          length: w.length,
          isFound: this.foundWords.some(fw => fw.word === w),
          finderName: this.foundWords.find(fw => fw.word === w)?.finderName || null,
          color: this.foundWords.find(fw => fw.word === w)?.color || null
        }))
      };
    }

    return {
      status: this.status,
      category: categoryPayload,
      grid: this.grid,
      foundWords: this.foundWords,
      hintUsed: this.hintUsed,
      hintData: this.hintData,
      timer: {
        remainingSeconds: this.remainingSeconds,
        durationSeconds: this.durationSeconds,
        isPaused: this.isPaused
      },
      categoryProgress: {
        current: currentNumber,
        total: totalSelected
      },
      historyCount: this.history.length
    };
  }
}

module.exports = GameManager;
