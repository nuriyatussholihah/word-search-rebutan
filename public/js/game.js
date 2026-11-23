// Logika Klien Pemain untuk Word Search Rebutan
(function() {
  const socket = io();

  // State Klien
  let myPlayer = null;
  let currentGameState = null;
  let isDragging = false;
  let dragStart = null;
  let dragCurrent = null;
  let activeSelectedCells = [];

  // Elemen DOM
  const screens = {
    join: document.getElementById('screen-join'),
    lobby: document.getElementById('screen-lobby'),
    playing: document.getElementById('screen-playing'),
    recap: document.getElementById('screen-recap'),
    final: document.getElementById('screen-final')
  };

  const playerNameInput = document.getElementById('player-name-input');
  const btnJoin = document.getElementById('btn-join');
  const joinError = document.getElementById('join-error');
  const myNameBadge = document.getElementById('my-name-badge');
  const btnMute = document.getElementById('btn-mute');
  const toastContainer = document.getElementById('toast-container');

  // Elemen Lobby
  const lobbyPlayerCount = document.getElementById('lobby-player-count');
  const lobbyPlayersList = document.getElementById('lobby-players-list');

  // Elemen Playing
  const categoryNumberLabel = document.getElementById('category-number-label');
  const categoryTitle = document.getElementById('category-title');
  const timerDisplay = document.getElementById('timer-display');
  const gridBoard = document.getElementById('grid-board');
  const selectionIndicator = document.getElementById('selection-indicator');
  const wordItemsList = document.getElementById('word-items-list');
  const foundCounter = document.getElementById('found-counter');

  // Elemen Recap
  const recapCategoryTitle = document.getElementById('recap-category-title');
  const recapHighlight = document.getElementById('recap-highlight');
  const recapWordsList = document.getElementById('recap-words-list');

  // Elemen Final
  const finalScoreRatio = document.getElementById('final-score-ratio');
  const celebrationBanner = document.getElementById('celebration-banner');
  const awardMataElang = document.getElementById('award-mata-elang');
  const awardDetikTerakhir = document.getElementById('award-detik-terakhir');
  const awardKataPanjang = document.getElementById('award-kata-panjang');

  // ===================== INISIALISASI & MUTE =====================

  function updateMuteButton() {
    if (window.sounds) {
      btnMute.textContent = window.sounds.isMuted ? '🔇' : '🔊';
      btnMute.title = window.sounds.isMuted ? 'Batal bisukan suara' : 'Bisukan suara';
    }
  }
  updateMuteButton();

  btnMute.addEventListener('click', () => {
    if (window.sounds) {
      window.sounds.toggleMute();
      updateMuteButton();
    }
  });

  // Notifikasi Toast
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3200);
  }

  // Ganti Layar
  function showScreen(name) {
    Object.keys(screens).forEach(key => {
      if (screens[key]) {
        screens[key].classList.toggle('active', key === name);
      }
    });
  }

  // ===================== RECONNECT & AUTENTIKASI =====================

  const savedToken = localStorage.getItem('ws_token');
  const savedName = localStorage.getItem('ws_name');

  if (savedToken) {
    socket.emit('player_reconnect', { token: savedToken });
  } else {
    showScreen('join');
  }

  // Tombol Masuk Lobby
  btnJoin.addEventListener('click', handleJoin);
  playerNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleJoin();
  });

  function handleJoin() {
    const name = playerNameInput.value.trim();
    if (!name) {
      joinError.textContent = 'Harap masukkan nama Anda.';
      joinError.style.display = 'block';
      return;
    }
    joinError.style.display = 'none';
    btnJoin.disabled = true;
    socket.emit('join_lobby', { name, existingToken: savedToken });
  }

  socket.on('join_success', (data) => {
    btnJoin.disabled = false;
    myPlayer = data.player;
    localStorage.setItem('ws_token', data.token);
    localStorage.setItem('ws_name', data.player.name);
    myNameBadge.textContent = myPlayer.name;
    myNameBadge.style.display = 'inline-block';
    handleSyncGameState(data.gameState, data.recapData, data.finalSummary);
  });

  socket.on('join_failed', (data) => {
    btnJoin.disabled = false;
    joinError.textContent = data.message || 'Gagal masuk lobby.';
    joinError.style.display = 'block';
  });

  socket.on('reconnect_success', (data) => {
    myPlayer = data.player;
    myNameBadge.textContent = myPlayer.name;
    myNameBadge.style.display = 'inline-block';
    handleSyncGameState(data.gameState, data.recapData, data.finalSummary);
  });

  socket.on('reconnect_failed', () => {
    localStorage.removeItem('ws_token');
    showScreen('join');
  });

  // ===================== SINKRONISASI GAME STATE =====================

  function handleSyncGameState(state, recapData = null, finalSummary = null) {
    if (!state) return;
    currentGameState = state;

    if (state.status === 'LOBBY') {
      showScreen('lobby');
    } else if (state.status === 'PLAYING') {
      showScreen('playing');
      renderPlayingScreen(state);
    } else if (state.status === 'CATEGORY_RECAP') {
      showScreen('recap');
      if (recapData) renderRecapScreen(recapData);
    } else if (state.status === 'FINAL_SUMMARY') {
      showScreen('final');
      if (finalSummary) renderFinalScreen(finalSummary);
    }
  }

  // Pembaruan daftar pemain
  socket.on('player_list_updated', (data) => {
    lobbyPlayerCount.textContent = `${data.count} Pemain`;
    lobbyPlayersList.innerHTML = '';
    data.players.forEach(p => {
      const chip = document.createElement('div');
      chip.className = 'lobby-player-chip' + (myPlayer && p.id === myPlayer.id ? ' is-me' : '');
      chip.textContent = p.name + (myPlayer && p.id === myPlayer.id ? ' (Kamu)' : '');
      lobbyPlayersList.appendChild(chip);
    });
  });

  // Notifikasi Global
  socket.on('notification', (data) => {
    showToast(data.message);
  });

  // Mulai Kategori Baru
  socket.on('category_started', (state) => {
    currentGameState = state;
    showScreen('playing');
    renderPlayingScreen(state);
    showToast(`Kategori ${state.category.number}: ${state.category.name} dimulai!`);
  });

  // Timer Tick
  socket.on('timer_tick', (data) => {
    if (!currentGameState) return;
    currentGameState.timer = data;
    updateTimerDisplay(data.remainingSeconds, data.isPaused);
  });

  function updateTimerDisplay(remainingSeconds, isPaused) {
    const mins = Math.floor(Math.max(0, remainingSeconds) / 60);
    const secs = Math.max(0, remainingSeconds) % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    timerDisplay.textContent = formatted;
    timerDisplay.classList.toggle('urgent', remainingSeconds <= 30 && remainingSeconds > 0);
    timerDisplay.classList.toggle('paused', isPaused);

    if (remainingSeconds <= 10 && remainingSeconds > 0 && !isPaused) {
      if (window.sounds) window.sounds.playUrgentTick();
    }
  }

  // ===================== RENDER PLAYING SCREEN =====================

  function renderPlayingScreen(state) {
    if (!state || !state.category) return;

    categoryNumberLabel.textContent = `Kategori ${state.category.number} dari ${state.category.total}`;
    categoryTitle.textContent = state.category.name;
    updateTimerDisplay(state.timer.remainingSeconds, state.timer.isPaused);

    renderGrid(state.grid, state.foundWords, state.hintData);
    renderWordList(state.category.words, state.hintData);
  }

  // Render Grid 15x15
  function renderGrid(grid, foundWords = [], hintData = null) {
    gridBoard.innerHTML = '';
    if (!grid) return;

    // Buat map sel yang sudah ditemukan untuk pewarnaan cepat
    const cellFoundMap = new Map();
    foundWords.forEach(fw => {
      fw.cells.forEach(c => {
        const key = `${c.r}_${c.c}`;
        cellFoundMap.set(key, fw.color);
      });
    });

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.textContent = grid[r][c];

        const key = `${r}_${c}`;
        if (cellFoundMap.has(key)) {
          cell.style.backgroundColor = cellFoundMap.get(key);
          cell.style.color = 'white';
        }

        // Tampilkan kilau hint jika ada
        if (hintData && hintData.startCell && hintData.startCell.r === r && hintData.startCell.c === c) {
          cell.classList.add('hint-glow');
        }

        gridBoard.appendChild(cell);
      }
    }
  }

  // Render Word List
  function renderWordList(words, hintData = null) {
    wordItemsList.innerHTML = '';
    let foundCount = 0;

    words.forEach(item => {
      const el = document.createElement('div');

      if (item.isFound) {
        foundCount++;
        el.className = 'word-item found';
        el.style.backgroundColor = item.color || '#0d9488';
        el.innerHTML = `
          <span>${item.word}</span>
          <span class="finder-badge">oleh ${escapeHtml(item.finderName)}</span>
        `;
      } else {
        el.className = 'word-item unfound';
        // Format kotak kosong sesuai jumlah huruf, misal "_ _ _ _ _ _"
        let displayMask = item.word.split('').map(() => '_').join(' ');

        // Jika kata ini mendapatkan hint, buka huruf pertamanya!
        if (hintData && hintData.word === item.word) {
          const chars = item.word.split('').map(() => '_');
          chars[0] = hintData.firstLetter;
          displayMask = chars.join(' ');
          el.style.borderColor = '#0284c7';
        }

        el.innerHTML = `
          <span>${displayMask}</span>
          <span class="length-tag">${item.length} huruf</span>
        `;
      }

      wordItemsList.appendChild(el);
    });

    foundCounter.textContent = `${foundCount} / ${words.length}`;
  }

  // Kata berhasil ditemukan (Event Realtime dari server)
  socket.on('word_found', (data) => {
    const { foundEntry, totalFound, totalWords } = data;

    // Mainkan suara sukses
    if (window.sounds) window.sounds.playWordFound();

    // Notifikasi toast
    showToast(`🎉 ${foundEntry.finderName} menemukan "${foundEntry.word}"!`);

    // Tambahkan ke foundWords di state lokal
    if (currentGameState) {
      if (!currentGameState.foundWords) currentGameState.foundWords = [];
      currentGameState.foundWords.push(foundEntry);

      if (currentGameState.category && currentGameState.category.words) {
        const targetWord = currentGameState.category.words.find(w => w.word === foundEntry.word);
        if (targetWord) {
          targetWord.isFound = true;
          targetWord.finderName = foundEntry.finderName;
          targetWord.color = foundEntry.color;
        }
      }
    }

    // Warnai sel-sel pada grid
    foundEntry.cells.forEach(c => {
      const cell = gridBoard.querySelector(`[data-r="${c.r}"][data-c="${c.c}"]`);
      if (cell) {
        cell.classList.remove('hint-glow');
        cell.style.backgroundColor = foundEntry.color;
        cell.style.color = 'white';
        // Animasi pop kecil
        cell.style.transform = 'scale(1.2)';
        setTimeout(() => { cell.style.transform = ''; }, 300);
      }
    });

    // Re-render daftar kata
    if (currentGameState && currentGameState.category) {
      renderWordList(currentGameState.category.words, currentGameState.hintData);
    }
  });

  // Hint Terbuka (Event Realtime dari server)
  socket.on('hint_revealed', (hintData) => {
    if (window.sounds) window.sounds.playHint();
    if (currentGameState) {
      currentGameState.hintData = hintData;
      currentGameState.hintUsed = true;
    }

    // Beri kilau pada sel awal kata
    if (hintData && hintData.startCell) {
      const cell = gridBoard.querySelector(`[data-r="${hintData.startCell.r}"][data-c="${hintData.startCell.c}"]`);
      if (cell) {
        cell.classList.add('hint-glow');
      }
    }

    if (currentGameState && currentGameState.category) {
      renderWordList(currentGameState.category.words, hintData);
    }
  });

  // ===================== DRAG & SELECTION LOGIC =====================

  function getCellCoords(element) {
    if (!element || !element.classList.contains('grid-cell')) return null;
    return {
      r: parseInt(element.dataset.r, 10),
      c: parseInt(element.dataset.c, 10)
    };
  }

  // Hitung sel garis lurus di antara 2 titik (8 arah)
  function calculateLineCells(start, end) {
    if (!start || !end) return [];
    const dr = end.r - start.r;
    const dc = end.c - start.c;
    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);

    // Kunci ke 8 arah terdekat
    let stepR = 0;
    let stepC = 0;
    let steps = 0;

    if (absDr === 0 && absDc === 0) {
      return [start];
    }

    if (absDr === 0) {
      // Horizontal
      stepC = dc > 0 ? 1 : -1;
      steps = absDc;
    } else if (absDc === 0) {
      // Vertikal
      stepR = dr > 0 ? 1 : -1;
      steps = absDr;
    } else if (absDr === absDc) {
      // Diagonal sempurna
      stepR = dr > 0 ? 1 : -1;
      stepC = dc > 0 ? 1 : -1;
      steps = absDr;
    } else {
      // Snap ke arah terdekat: horizontal, vertikal, atau diagonal
      if (absDr > absDc * 2) {
        // Lebih dekat ke vertikal
        stepR = dr > 0 ? 1 : -1;
        steps = absDr;
      } else if (absDc > absDr * 2) {
        // Lebih dekat ke horizontal
        stepC = dc > 0 ? 1 : -1;
        steps = absDc;
      } else {
        // Lebih dekat ke diagonal
        stepR = dr > 0 ? 1 : -1;
        stepC = dc > 0 ? 1 : -1;
        steps = Math.min(absDr, absDc);
      }
    }

    const cells = [];
    for (let i = 0; i <= steps; i++) {
      const r = start.r + i * stepR;
      const c = start.c + i * stepC;
      if (r >= 0 && r < 15 && c >= 0 && c < 15) {
        cells.push({ r, c });
      }
    }
    return cells;
  }

  function updateDragVisuals() {
    // Hapus kelas selected sebelumnya
    gridBoard.querySelectorAll('.grid-cell.selected').forEach(c => c.classList.remove('selected'));

    if (!isDragging || !dragStart || !dragCurrent) {
      selectionIndicator.textContent = '';
      selectionIndicator.classList.remove('active');
      activeSelectedCells = [];
      return;
    }

    activeSelectedCells = calculateLineCells(dragStart, dragCurrent);

    let spelled = '';
    activeSelectedCells.forEach(pos => {
      const cell = gridBoard.querySelector(`[data-r="${pos.r}"][data-c="${pos.c}"]`);
      if (cell) {
        cell.classList.add('selected');
        spelled += cell.textContent.trim();
      }
    });

    if (spelled.length > 0) {
      selectionIndicator.textContent = spelled.split('').join(' - ');
      selectionIndicator.classList.add('active');
    } else {
      selectionIndicator.textContent = '';
      selectionIndicator.classList.remove('active');
    }
  }

  function submitDragSelection() {
    if (!isDragging) return;
    isDragging = false;

    if (activeSelectedCells.length >= 2) {
      const start = activeSelectedCells[0];
      const end = activeSelectedCells[activeSelectedCells.length - 1];

      socket.emit('submit_word', { start, end });
    }

    dragStart = null;
    dragCurrent = null;
    activeSelectedCells = [];
    updateDragVisuals();
  }

  // --- MOUSE EVENTS ---
  gridBoard.addEventListener('mousedown', (e) => {
    const coords = getCellCoords(e.target);
    if (!coords) return;
    isDragging = true;
    dragStart = coords;
    dragCurrent = coords;
    updateDragVisuals();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const cellUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
    const coords = getCellCoords(cellUnderMouse);
    if (coords && (coords.r !== dragCurrent.r || coords.c !== dragCurrent.c)) {
      dragCurrent = coords;
      updateDragVisuals();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) submitDragSelection();
  });

  // --- TOUCH EVENTS UNTUK MOBILE ---
  gridBoard.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const cellUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
    const coords = getCellCoords(cellUnderTouch);
    if (!coords) return;

    isDragging = true;
    dragStart = coords;
    dragCurrent = coords;
    updateDragVisuals();
  }, { passive: false });

  gridBoard.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault(); // Sangat penting: mencegah scroll halaman saat drag kata di HP!

    const touch = e.touches[0];
    const cellUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
    const coords = getCellCoords(cellUnderTouch);
    if (coords && (!dragCurrent || coords.r !== dragCurrent.r || coords.c !== dragCurrent.c)) {
      dragCurrent = coords;
      updateDragVisuals();
    }
  }, { passive: false });

  gridBoard.addEventListener('touchend', (e) => {
    if (isDragging) {
      submitDragSelection();
    }
  });

  gridBoard.addEventListener('touchcancel', () => {
    if (isDragging) {
      isDragging = false;
      dragStart = null;
      dragCurrent = null;
      activeSelectedCells = [];
      updateDragVisuals();
    }
  });

  // ===================== RECAP KATEGORI =====================

  socket.on('category_ended', (recapData) => {
    showScreen('recap');
    renderRecapScreen(recapData);
  });

  function renderRecapScreen(data) {
    recapCategoryTitle.textContent = `Kategori ${data.categoryNumber}: ${data.categoryName}`;
    recapHighlight.textContent = `Kita menemukan ${data.foundCount} dari ${data.totalWords} kata!`;

    recapWordsList.innerHTML = '';
    data.allWords.forEach(word => {
      const foundItem = data.foundWords.find(fw => fw.word === word);
      const pill = document.createElement('div');

      if (foundItem) {
        pill.className = 'recap-word-pill found';
        pill.innerHTML = `
          <strong>✓ ${word}</strong>
          <span class="finder-label">oleh ${escapeHtml(foundItem.finderName)}</span>
        `;
      } else {
        pill.className = 'recap-word-pill missed';
        pill.innerHTML = `
          <span>✕ ${word}</span>
          <span class="finder-label">belum ketemu</span>
        `;
      }
      recapWordsList.appendChild(pill);
    });
  }

  // ===================== RINGKASAN AKHIR & PENGHARGAAN =====================

  socket.on('session_finished', (summary) => {
    showScreen('final');
    renderFinalScreen(summary);
  });

  function renderFinalScreen(summary) {
    if (window.sounds) window.sounds.playCelebration();

    finalScoreRatio.textContent = `Kita berhasil menemukan ${summary.totalFoundWords} dari total ${summary.totalPlayedWords} kata (${summary.percentage}%)`;

    celebrationBanner.textContent = summary.message;
    celebrationBanner.className = 'celebration-banner ' + (summary.isCelebration ? 'celebration' : 'encouragement');

    // 3 Penghargaan Lucu: BUKAN RANKING, HANYA NAMA TANPA ANGKA
    renderAward(awardMataElang, summary.awards.mataElang.names);
    renderAward(awardDetikTerakhir, summary.awards.penyelamatDetikTerakhir.names);
    renderAward(awardKataPanjang, summary.awards.pemburuKataPanjang.names);
  }

  function renderAward(container, names) {
    container.innerHTML = '';
    if (!names || names.length === 0) {
      container.innerHTML = '<span style="color: #94a3b8; font-weight: 500;">-</span>';
      return;
    }

    names.forEach(name => {
      const badge = document.createElement('span');
      badge.className = 'award-player-name';
      badge.textContent = name;
      container.appendChild(badge);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
