// Generator dan validator Word Search 15x15
// Mendukung 8 arah: horizontal, vertikal, dan diagonal (maju & mundur)

const DIRECTIONS = [
  { dr: 0, dc: 1, name: 'horizontal-kanan' },
  { dr: 0, dc: -1, name: 'horizontal-kiri' },
  { dr: 1, dc: 0, name: 'vertikal-bawah' },
  { dr: -1, dc: 0, name: 'vertikal-atas' },
  { dr: 1, dc: 1, name: 'diagonal-turun-kanan' },
  { dr: 1, dc: -1, name: 'diagonal-turun-kiri' },
  { dr: -1, dc: 1, name: 'diagonal-naik-kanan' },
  { dr: -1, dc: -1, name: 'diagonal-naik-kiri' }
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Menghitung sel di antara koordinat awal dan akhir jika membentuk garis lurus 8 arah.
 * Mengembalikan array [{r, c}] atau null jika tidak lurus.
 */
function getCellsBetween(start, end) {
  if (!start || !end) return null;
  const dr = end.r - start.r;
  const dc = end.c - start.c;
  const absDr = Math.abs(dr);
  const absDc = Math.abs(dc);

  // Harus satu baris, satu kolom, atau diagonal sempurna
  if (absDr === 0 && absDc === 0) {
    return [{ r: start.r, c: start.c }];
  }

  const isHorizontal = absDr === 0 && absDc > 0;
  const isVertical = absDc === 0 && absDr > 0;
  const isDiagonal = absDr === absDc && absDr > 0;

  if (!isHorizontal && !isVertical && !isDiagonal) {
    return null;
  }

  const steps = Math.max(absDr, absDc);
  const stepR = dr === 0 ? 0 : dr / absDr;
  const stepC = dc === 0 ? 0 : dc / absDc;

  const cells = [];
  for (let i = 0; i <= steps; i++) {
    cells.push({
      r: start.r + i * stepR,
      c: start.c + i * stepC
    });
  }
  return cells;
}

/**
 * Mengambil string huruf dari sel-sel pada grid.
 */
function getWordFromCells(grid, cells) {
  if (!cells || cells.length === 0) return '';
  return cells.map(cell => {
    if (grid[cell.r] && grid[cell.r][cell.c]) {
      return grid[cell.r][cell.c];
    }
    return '';
  }).join('');
}

/**
 * Memeriksa apakah sebuah kata dapat diletakkan pada posisi dan arah tertentu.
 */
function canPlaceWord(grid, word, startR, startC, dir, size) {
  const len = word.length;
  const endR = startR + (len - 1) * dir.dr;
  const endC = startC + (len - 1) * dir.dc;

  // Cek batas grid
  if (endR < 0 || endR >= size || endC < 0 || endC >= size) {
    return false;
  }

  // Cek tiap sel: harus kosong (null/'') atau hurufnya sama persis
  for (let i = 0; i < len; i++) {
    const r = startR + i * dir.dr;
    const c = startC + i * dir.dc;
    const existing = grid[r][c];
    if (existing !== null && existing !== word[i]) {
      return false; // Tabrakan huruf berbeda
    }
  }

  return true;
}

/**
 * Meletakkan kata pada grid dan mencatat sel-selnya.
 */
function placeWord(grid, word, startR, startC, dir) {
  const cells = [];
  for (let i = 0; i < word.length; i++) {
    const r = startR + i * dir.dr;
    const c = startC + i * dir.dc;
    grid[r][c] = word[i];
    cells.push({ r, c });
  }
  return {
    word,
    cells,
    start: { r: startR, c: startC },
    end: { r: startR + (word.length - 1) * dir.dr, c: startC + (word.length - 1) * dir.dc },
    dirName: dir.name
  };
}

/**
 * Mengacak array in-place (Fisher-Yates)
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Mencoba membuat grid dengan semua kata muat tanpa ada yang hilang.
 * Mengulang sampai 100 kali jika perlu, menjamin 100% semua kata terpasang.
 */
function generateGrid(words, size = 15) {
  const maxAttempts = 150;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Buat grid kosong ukuran size x size
    const grid = Array.from({ length: size }, () => Array(size).fill(null));
    const placedWords = {};
    let allPlaced = true;

    // Urutkan kata dari yang terpanjang agar kata panjang lebih mudah ditempatkan
    const sortedWords = [...words].sort((a, b) => b.length - a.length);

    for (const word of sortedWords) {
      let placed = false;

      // Buat daftar semua posisi dan arah acak
      const positions = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          positions.push({ r, c });
        }
      }
      shuffleArray(positions);

      const dirs = [...DIRECTIONS];
      shuffleArray(dirs);

      // Cari posisi dan arah yang valid
      posLoop: for (const pos of positions) {
        for (const dir of dirs) {
          if (canPlaceWord(grid, word, pos.r, pos.c, dir, size)) {
            const placement = placeWord(grid, word, pos.r, pos.c, dir);
            placedWords[word] = placement;
            placed = true;
            break posLoop;
          }
        }
      }

      if (!placed) {
        allPlaced = false;
        break; // Gagal menempatkan satu kata, reset dan coba lagi
      }
    }

    if (allPlaced) {
      // Isi sisa sel kosong dengan huruf acak
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (grid[r][c] === null) {
            grid[r][c] = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
          }
        }
      }

      return {
        grid,
        placedWords,
        words: sortedWords
      };
    }
  }

  throw new Error("Gagal menempatkan semua kata ke dalam grid setelah 150 percobaan.");
}

module.exports = {
  DIRECTIONS,
  getCellsBetween,
  getWordFromCells,
  generateGrid
};
