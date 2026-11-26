// Logika Panel Host Word Search Rebutan
(function() {
  const socket = io();

  // State Host
  let isAuthenticated = false;
  let allCategories = [];
  let orderedCategoryIds = [];
  let currentDurationMinutes = 3;
  let currentDifficulty = 'medium';
  let currentGameState = null;

  // Kunci Jawaban State
  let currentAnswerKey = null;
  let currentAnswerGrid = null;
  let isAnswerGridOpen = false;
  let inspectedWord = null;

  // Elemen DOM
  const hostAuthOverlay = document.getElementById('host-auth-overlay');
  const hostPinInput = document.getElementById('host-pin-input');
  const btnAuth = document.getElementById('btn-auth');
  const authError = document.getElementById('auth-error');
  const hostDashboard = document.getElementById('host-dashboard');

  // Status & Timer
  const hostStatusBadge = document.getElementById('host-status-badge');
  const liveCategoryName = document.getElementById('live-category-name');
  const liveCategoryProgress = document.getElementById('live-category-progress');
  const liveTimer = document.getElementById('live-timer');
  const liveFoundCount = document.getElementById('live-found-count');

  // Kontrol Tombol
  const btnStartCategory = document.getElementById('btn-start-category');
  const btnNextCategory = document.getElementById('btn-next-category');
  const btnHint = document.getElementById('btn-hint');
  const btnAddTime = document.getElementById('btn-add-time');
  const btnPauseResume = document.getElementById('btn-pause-resume');
  const btnSkipCategory = document.getElementById('btn-skip-category');
  const btnEndSession = document.getElementById('btn-end-session');
  const btnResetSession = document.getElementById('btn-reset-session');

  // Konfigurasi
  const categoryConfigList = document.getElementById('category-config-list');
  const durationChipsContainer = document.getElementById('duration-chips');
  const difficultyChipsContainer = document.getElementById('difficulty-chips');
  const difficultyDesc = document.getElementById('difficulty-desc');
  const estimatedTimeDisplay = document.getElementById('estimated-time-display');
  const configSection = document.getElementById('config-section');

  // Kunci Jawaban Host
  const hostAnswerKeyCard = document.getElementById('host-answer-key-card');
  const btnToggleAnswerGrid = document.getElementById('btn-toggle-answer-grid');
  const hostAnswerWordsList = document.getElementById('host-answer-words-list');
  const hostAnswerGridContainer = document.getElementById('host-answer-grid-container');
  const hostAnswerGrid = document.getElementById('host-answer-grid');

  // Pemain & Log
  const hostPlayerTableBody = document.getElementById('host-player-table-body');
  const hostPlayerCountBadge = document.getElementById('host-player-count-badge');
  const activityLog = document.getElementById('activity-log');

  function canConfigure() {
    return !currentGameState || currentGameState.status === 'LOBBY' || currentGameState.status === 'CATEGORY_RECAP';
  }

  // ===================== AUTENTIKASI PIN =====================

  const savedPin = sessionStorage.getItem('host_pin');
  if (savedPin) {
    socket.emit('host_auth', { pin: savedPin });
  }

  btnAuth.addEventListener('click', handleAuth);
  hostPinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAuth();
  });

  function handleAuth() {
    const pin = hostPinInput.value.trim();
    if (!pin) {
      authError.textContent = 'Harap masukkan PIN Host.';
      authError.style.display = 'block';
      return;
    }
    authError.style.display = 'none';
    btnAuth.disabled = true;
    socket.emit('host_auth', { pin });
  }

  socket.on('host_auth_success', (data) => {
    isAuthenticated = true;
    btnAuth.disabled = false;
    sessionStorage.setItem('host_pin', hostPinInput.value.trim() || savedPin);
    hostAuthOverlay.style.display = 'none';
    hostDashboard.style.display = 'block';

    allCategories = data.categories || [];
    orderedCategoryIds = data.selectedCategoryIds || allCategories.map(c => c.id);
    currentDurationMinutes = data.durationMinutes || 3;
    currentDifficulty = data.difficulty || 'medium';
    currentGameState = data.gameState;

    renderDurationChips();
    renderDifficultyChips();
    renderCategoryConfigList();
    updateEstimatedTime();
    renderPlayerList(data.players || []);
    syncControls(data.gameState);
    addLog('Panel Host berhasil diakses.');
  });

  socket.on('host_auth_failed', (data) => {
    btnAuth.disabled = false;
    authError.textContent = data.message || 'PIN Host salah!';
    authError.style.display = 'block';
    sessionStorage.removeItem('host_pin');
  });

  // ===================== PENGATURAN SESI =====================

  function renderDurationChips() {
    durationChipsContainer.innerHTML = '';
    const isConfigurable = canConfigure();

    [2, 3, 4, 5].forEach(min => {
      const chip = document.createElement('div');
      chip.className = 'duration-chip' + (min === currentDurationMinutes ? ' selected' : '');
      if (!isConfigurable) chip.style.opacity = '0.5';
      chip.textContent = `${min} Menit`;
      chip.addEventListener('click', () => {
        if (!canConfigure()) return;
        currentDurationMinutes = min;
        renderDurationChips();
        emitConfigChange();
      });
      durationChipsContainer.appendChild(chip);
    });
  }

  function renderDifficultyChips() {
    if (!difficultyChipsContainer) return;
    const isConfigurable = canConfigure();

    difficultyChipsContainer.querySelectorAll('.duration-chip').forEach(chip => {
      const diff = chip.dataset.diff;
      chip.classList.toggle('selected', diff === currentDifficulty);
      chip.style.opacity = isConfigurable ? '1' : '0.5';
    });
    updateDifficultyDesc();
  }

  function updateDifficultyDesc() {
    if (!difficultyDesc) return;
    if (currentDifficulty === 'easy') {
      difficultyDesc.textContent = '🟢 Mudah: Hanya Horizontal & Vertikal maju (tanpa terbalik & tanpa diagonal).';
    } else if (currentDifficulty === 'hard') {
      difficultyDesc.textContent = '🔴 Sulit: 8 Arah Lengkap! Maju, mundur, terbalik & diagonal naik/turun.';
    } else {
      difficultyDesc.textContent = '🟡 Sedang: Horizontal (maju/mundur), Vertikal (maju/mundur) & Diagonal turun maju.';
    }
  }

  if (difficultyChipsContainer) {
    difficultyChipsContainer.querySelectorAll('.duration-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (!canConfigure()) return;
        currentDifficulty = chip.dataset.diff;
        renderDifficultyChips();
        emitConfigChange();
      });
    });
  }

  function renderCategoryConfigList() {
    categoryConfigList.innerHTML = '';

    // Susun berdasarkan urutan di orderedCategoryIds
    const orderedList = [];
    orderedCategoryIds.forEach(id => {
      const cat = allCategories.find(c => c.id === id);
      if (cat) orderedList.push({ ...cat, enabled: true });
    });

    // Tambahkan sisa yang tidak dicentang
    allCategories.forEach(cat => {
      if (!orderedCategoryIds.includes(cat.id)) {
        orderedList.push({ ...cat, enabled: false });
      }
    });

    const isConfigurable = canConfigure();

    orderedList.forEach((cat, index) => {
      const item = document.createElement('div');
      item.className = 'category-config-item' + (!cat.enabled ? ' disabled' : '');

      const left = document.createElement('div');
      left.className = 'cat-info-left';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = cat.enabled;
      checkbox.disabled = !isConfigurable;
      checkbox.addEventListener('change', () => {
        if (!canConfigure()) return;
        if (checkbox.checked) {
          if (!orderedCategoryIds.includes(cat.id)) {
            orderedCategoryIds.push(cat.id);
          }
        } else {
          // Minimal 1 kategori harus aktif
          if (orderedCategoryIds.length <= 1) {
            alert('Minimal 1 kategori harus dimainkan!');
            checkbox.checked = true;
            return;
          }
          orderedCategoryIds = orderedCategoryIds.filter(id => id !== cat.id);
        }
        renderCategoryConfigList();
        emitConfigChange();
      });

      const label = document.createElement('span');
      label.style.fontWeight = '700';
      label.textContent = `${cat.id}. ${cat.name} (${cat.wordCount || (cat.words && cat.words.length) || 9} kata)`;

      left.appendChild(checkbox);
      left.appendChild(label);

      // Tombol urutan naik / turun
      const controls = document.createElement('div');
      controls.className = 'cat-order-controls';

      if (cat.enabled && isConfigurable) {
        const btnUp = document.createElement('button');
        btnUp.className = 'btn-mini-arrow';
        btnUp.textContent = '▲';
        btnUp.title = 'Pindah ke atas';
        btnUp.disabled = index === 0;
        btnUp.addEventListener('click', () => {
          moveCategoryOrder(cat.id, -1);
        });

        const btnDown = document.createElement('button');
        btnDown.className = 'btn-mini-arrow';
        btnDown.textContent = '▼';
        btnDown.title = 'Pindah ke bawah';
        btnDown.disabled = index === orderedCategoryIds.length - 1;
        btnDown.addEventListener('click', () => {
          moveCategoryOrder(cat.id, 1);
        });

        controls.appendChild(btnUp);
        controls.appendChild(btnDown);
      }

      item.appendChild(left);
      item.appendChild(controls);
      categoryConfigList.appendChild(item);
    });
  }

  function moveCategoryOrder(catId, delta) {
    const idx = orderedCategoryIds.indexOf(catId);
    if (idx < 0) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= orderedCategoryIds.length) return;

    const temp = orderedCategoryIds[idx];
    orderedCategoryIds[idx] = orderedCategoryIds[newIdx];
    orderedCategoryIds[newIdx] = temp;

    renderCategoryConfigList();
    emitConfigChange();
  }

  function emitConfigChange() {
    socket.emit('host_configure', {
      categoryIds: orderedCategoryIds,
      durationMinutes: currentDurationMinutes,
      difficulty: currentDifficulty
    });
    updateEstimatedTime();
  }

  function updateEstimatedTime() {
    const count = orderedCategoryIds.length;
    // Formula PRD: (jumlah kategori × (durasi + 1 menit rekap)) + 7 menit pembukaan dan penutup
    const totalEst = (count * (currentDurationMinutes + 1)) + 7;
    estimatedTimeDisplay.textContent = `±${totalEst} Menit`;
  }

  socket.on('session_config_updated', (data) => {
    orderedCategoryIds = data.selectedCategoryIds;
    currentDurationMinutes = data.durationMinutes;
    renderDurationChips();
    renderCategoryConfigList();
    estimatedTimeDisplay.textContent = `±${data.estimatedMinutes} Menit`;
  });

  // ===================== KONTROL GAME =====================

  btnStartCategory.addEventListener('click', () => {
    socket.emit('host_start_category');
  });

  btnNextCategory.addEventListener('click', () => {
    socket.emit('host_next_category');
  });

  btnHint.addEventListener('click', () => {
    socket.emit('host_use_hint');
  });

  btnAddTime.addEventListener('click', () => {
    socket.emit('host_add_time', { seconds: 30 });
  });

  btnPauseResume.addEventListener('click', () => {
    socket.emit('host_toggle_pause');
  });

  btnSkipCategory.addEventListener('click', () => {
    if (confirm('Yakin ingin melewati kategori ini?')) {
      socket.emit('host_skip_category');
    }
  });

  btnEndSession.addEventListener('click', () => {
    if (confirm('Yakin ingin mengakhiri sesi sekarang dan langsung melihat ringkasan akhir?')) {
      socket.emit('host_end_session');
    }
  });

  if (btnResetSession) {
    btnResetSession.addEventListener('click', () => {
      if (confirm('Yakin ingin me-reset seluruh sesi ke Ruang Tunggu (Lobby)? Pemain akan kembali ke Ruang Tunggu dan bisa mulai lagi dari awal.')) {
        socket.emit('host_reset_session');
      }
    });
  }

  // ===================== SINKRONISASI STATE & UI =====================

  function syncControls(state) {
    if (!state) return;
    currentGameState = state;

    hostStatusBadge.textContent = state.status;

    // Refresh kontrol konfigurasi agar responsif saat di Lobby maupun di Rekap Kategori
    renderDurationChips();
    renderDifficultyChips();
    renderCategoryConfigList();

    if (state.status === 'LOBBY') {
      btnStartCategory.style.display = 'block';
      btnStartCategory.disabled = false;
      btnNextCategory.style.display = 'none';
      btnHint.disabled = true;
      btnAddTime.disabled = true;
      btnPauseResume.disabled = true;
      btnSkipCategory.disabled = true;
      btnEndSession.disabled = true;
      if (btnResetSession) btnResetSession.disabled = true;
      if (hostAnswerKeyCard) hostAnswerKeyCard.style.display = 'none';

      liveCategoryName.textContent = 'Menunggu di Lobby';
      liveCategoryProgress.textContent = `Total ${orderedCategoryIds.length} Kategori`;
      liveTimer.textContent = formatTime(currentDurationMinutes * 60);
      liveFoundCount.textContent = '0 / 0';
    } else if (state.status === 'PLAYING') {
      btnStartCategory.style.display = 'none';
      btnNextCategory.style.display = 'none';
      btnHint.disabled = state.hintUsed;
      btnAddTime.disabled = false;
      btnPauseResume.disabled = false;
      btnPauseResume.textContent = state.timer.isPaused ? '▶️ Resume' : '⏸️ Pause';
      btnSkipCategory.disabled = false;
      btnEndSession.disabled = false;
      if (btnResetSession) btnResetSession.disabled = false;

      if (state.category) {
        liveCategoryName.textContent = state.category.name;
        liveCategoryProgress.textContent = `Kategori ${state.category.number} dari ${state.category.total}`;
        liveFoundCount.textContent = `${state.foundWords ? state.foundWords.length : 0} / ${state.category.words.length}`;
      }
      updateTimer(state.timer.remainingSeconds, state.timer.isPaused);
      renderAnswerKeyCard();
    } else if (state.status === 'CATEGORY_RECAP') {
      btnStartCategory.style.display = 'none';
      btnNextCategory.style.display = 'block';
      btnNextCategory.disabled = false;
      btnHint.disabled = true;
      btnAddTime.disabled = true;
      btnPauseResume.disabled = true;
      btnSkipCategory.disabled = true;
      btnEndSession.disabled = false;
      if (btnResetSession) btnResetSession.disabled = false;
      if (hostAnswerKeyCard) hostAnswerKeyCard.style.display = 'none';

      liveCategoryName.textContent = 'Rekap Kategori Selesai (Bisa Atur Ronde Berikutnya)';
      liveTimer.textContent = '00:00';
    } else if (state.status === 'FINAL_SUMMARY') {
      btnStartCategory.style.display = 'none';
      btnNextCategory.style.display = 'none';
      btnHint.disabled = true;
      btnAddTime.disabled = true;
      btnPauseResume.disabled = true;
      btnSkipCategory.disabled = true;
      btnEndSession.disabled = true;
      if (btnResetSession) btnResetSession.disabled = false;
      if (hostAnswerKeyCard) hostAnswerKeyCard.style.display = 'none';

      liveCategoryName.textContent = 'Sesi Selesai (Ringkasan Akhir)';
      liveTimer.textContent = '00:00';
    }
  }

  socket.on('category_started', (state) => {
    syncControls(state);
    addLog(`Kategori dimulai: ${state.category.name}`);
  });

  socket.on('session_reset', (state) => {
    currentAnswerKey = null;
    currentAnswerGrid = null;
    inspectedWord = null;
    if (hostAnswerKeyCard) hostAnswerKeyCard.style.display = 'none';
    syncControls(state);
    addLog('🔄 Sesi permainan telah di-reset ke Ruang Tunggu.');
  });

  socket.on('timer_tick', (data) => {
    if (!currentGameState) return;
    currentGameState.timer = data;
    updateTimer(data.remainingSeconds, data.isPaused);
    if (btnPauseResume) {
      btnPauseResume.textContent = data.isPaused ? '▶️ Resume' : '⏸️ Pause';
    }
  });

  function updateTimer(remainingSeconds, isPaused) {
    liveTimer.textContent = formatTime(remainingSeconds);
    liveTimer.classList.toggle('urgent', remainingSeconds <= 30 && remainingSeconds > 0);
  }

  function formatTime(totalSecs) {
    const s = Math.max(0, totalSecs);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  socket.on('word_found', (data) => {
    if (currentGameState && currentGameState.category) {
      if (!currentGameState.foundWords) currentGameState.foundWords = [];
      currentGameState.foundWords.push(data.foundEntry);
      liveFoundCount.textContent = `${data.totalFound} / ${data.totalWords}`;
    }
    renderAnswerWordsList();
    if (isAnswerGridOpen) renderAnswerGrid();
    addLog(`Kata ditemukan: "${data.foundEntry.word}" oleh ${data.foundEntry.finderName}`);
  });

  socket.on('hint_revealed', (hintData) => {
    btnHint.disabled = true;
    addLog(`💡 Hint dibuka: Huruf pertama kata "${hintData.word}" adalah '${hintData.firstLetter}'`);
  });

  socket.on('category_ended', (data) => {
    syncControls({ ...currentGameState, status: 'CATEGORY_RECAP' });
    addLog(`Kategori "${data.categoryName}" selesai. Menemukan ${data.foundCount}/${data.totalWords} kata.`);
  });

  socket.on('session_finished', (summary) => {
    syncControls({ ...currentGameState, status: 'FINAL_SUMMARY' });
    addLog(`Sesi selesai! Menemukan ${summary.totalFoundWords}/${summary.totalPlayedWords} kata (${summary.percentage}%).`);
  });

  // ===================== KUNCI JAWABAN HOST =====================

  socket.on('host_answer_key', (data) => {
    currentAnswerKey = data.placedWords;
    currentAnswerGrid = data.grid;
    renderAnswerKeyCard();
  });

  function renderAnswerKeyCard() {
    if (!hostAnswerKeyCard) return;
    if (!currentAnswerKey || (currentGameState && currentGameState.status !== 'PLAYING')) {
      hostAnswerKeyCard.style.display = 'none';
      return;
    }

    hostAnswerKeyCard.style.display = 'block';
    renderAnswerWordsList();
    if (isAnswerGridOpen) {
      renderAnswerGrid();
    }
  }

  function getDirectionLabel(dirName) {
    switch (dirName) {
      case 'horizontal-kanan': return '➡️ Kanan';
      case 'horizontal-kiri': return '⬅️ Kiri';
      case 'vertikal-bawah': return '⬇️ Bawah';
      case 'vertikal-atas': return '⬆️ Atas';
      case 'diagonal-turun-kanan': return '↘️ Miring Bawah Kanan';
      case 'diagonal-turun-kiri': return '↙️ Miring Bawah Kiri';
      case 'diagonal-naik-kanan': return '↗️ Miring Atas Kanan';
      case 'diagonal-naik-kiri': return '↖️ Miring Atas Kiri';
      default: return dirName || 'Lurus';
    }
  }

  function renderAnswerWordsList() {
    if (!hostAnswerWordsList || !currentAnswerKey) return;
    hostAnswerWordsList.innerHTML = '';

    const foundWordsList = (currentGameState && currentGameState.foundWords) ? currentGameState.foundWords : [];

    Object.keys(currentAnswerKey).forEach(word => {
      const placement = currentAnswerKey[word];
      const isFound = foundWordsList.some(fw => fw.word === word);
      const foundItem = foundWordsList.find(fw => fw.word === word);

      const item = document.createElement('div');
      item.className = 'host-answer-item' + (isFound ? ' found' : '') + (inspectedWord === word ? ' highlighted' : '');

      const dirLabel = placement.direction ? getDirectionLabel(placement.direction.name) : 'Lurus';
      const startCoord = `B${placement.start.r + 1}, K${placement.start.c + 1}`;

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="host-answer-word">${word}</span>
          <span class="host-answer-dir">${dirLabel}</span>
          <span style="font-size: 0.72rem; color: #94a3b8;">(${startCoord})</span>
        </div>
        <div class="host-answer-status ${isFound ? 'found' : 'unfound'}">
          ${isFound ? `✅ ${foundItem ? foundItem.finderName : 'Ditemukan'}` : '⏳ Belum'}
        </div>
      `;

      item.addEventListener('click', () => {
        if (inspectedWord === word) {
          inspectedWord = null;
        } else {
          inspectedWord = word;
          if (!isAnswerGridOpen) {
            isAnswerGridOpen = true;
            hostAnswerGridContainer.style.display = 'block';
            btnToggleAnswerGrid.textContent = '🙈 Tutup Papan Kunci';
          }
        }
        renderAnswerWordsList();
        renderAnswerGrid();
      });

      hostAnswerWordsList.appendChild(item);
    });
  }

  function renderAnswerGrid() {
    if (!hostAnswerGrid || !currentAnswerGrid || !currentAnswerKey) return;
    hostAnswerGrid.innerHTML = '';

    const foundWordsList = (currentGameState && currentGameState.foundWords) ? currentGameState.foundWords : [];

    // Map koordinat sel mana saja yang memuat kata
    const wordCellsMap = new Map();
    Object.keys(currentAnswerKey).forEach(word => {
      const placement = currentAnswerKey[word];
      const isFound = foundWordsList.some(fw => fw.word === word);
      placement.cells.forEach(c => {
        const key = `${c.r}_${c.c}`;
        if (!wordCellsMap.has(key)) {
          wordCellsMap.set(key, []);
        }
        wordCellsMap.get(key).push({ word, isFound });
      });
    });

    const inspectedCells = inspectedWord && currentAnswerKey[inspectedWord]
      ? new Set(currentAnswerKey[inspectedWord].cells.map(c => `${c.r}_${c.c}`))
      : new Set();

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.textContent = currentAnswerGrid[r][c];

        const key = `${r}_${c}`;
        if (wordCellsMap.has(key)) {
          cell.classList.add('answer-cell');
          const entries = wordCellsMap.get(key);
          if (entries.some(e => e.isFound)) {
            cell.classList.add('is-found');
          }
        }

        if (inspectedCells.has(key)) {
          cell.classList.add('active-inspect');
        }

        hostAnswerGrid.appendChild(cell);
      }
    }
  }

  if (btnToggleAnswerGrid) {
    btnToggleAnswerGrid.addEventListener('click', () => {
      isAnswerGridOpen = !isAnswerGridOpen;
      hostAnswerGridContainer.style.display = isAnswerGridOpen ? 'block' : 'none';
      btnToggleAnswerGrid.textContent = isAnswerGridOpen ? '🙈 Tutup Papan Kunci' : '👁️ Buka Papan Kunci';
      if (isAnswerGridOpen) {
        renderAnswerGrid();
      }
    });
  }

  socket.on('player_list_updated', (data) => {
    renderPlayerList(data.players);
  });

  function renderPlayerList(players) {
    hostPlayerCountBadge.textContent = `${players.filter(p => p.connected).length} Online / ${players.length} Total`;
    hostPlayerTableBody.innerHTML = '';

    if (players.length === 0) {
      hostPlayerTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--text-muted);">Belum ada pemain yang bergabung</td></tr>';
      return;
    }

    players.forEach((p, idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td>
          <span class="status-dot ${p.connected ? 'online' : 'offline'}"></span>
          <strong>${escapeHtml(p.name)}</strong>
        </td>
        <td>${p.foundCount || 0} kata</td>
      `;
      hostPlayerTableBody.appendChild(row);
    });
  }

  function addLog(message) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = new Date().toTimeString().split(' ')[0];
    entry.innerHTML = `<span class="log-time">[${time}]</span> ${escapeHtml(message)}`;
    activityLog.prepend(entry);
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
