// Server Express & Socket.IO untuk Word Search Rebutan
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const config = require('./config');
const categories = require('./categories');
const GameManager = require('./gameState');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware & folder aset statis
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inisialisasi Game Manager
const game = new GameManager(io);

// Endpoint API sederhana untuk mendapatkan info awal kategori dan status
app.get('/api/initial-data', (req, res) => {
  res.json({
    categories: categories.map(c => ({ id: c.id, name: c.name, wordCount: c.words.length })),
    durationOptions: config.DURATION_OPTIONS_MINUTES,
    defaultDuration: config.DEFAULT_DURATION_SECONDS / 60
  });
});

// Rute untuk halaman host
app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

// Rute fallback ke index.html untuk pemain
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===================== SOCKET.IO EVENT HANDLERS =====================

io.on('connection', (socket) => {
  let playerToken = null;
  let isHostAuthenticated = false;

  // 1. Pemain mencoba Reconnect dengan token dari localStorage
  socket.on('player_reconnect', ({ token }) => {
    if (!token) {
      socket.emit('reconnect_failed', { message: 'Token tidak ditemukan' });
      return;
    }

    const result = game.reconnectPlayer(token, socket.id);
    if (result.success) {
      playerToken = token;
      socket.emit('reconnect_success', {
        player: { id: result.player.id, name: result.player.name },
        gameState: game.getPublicGameState(),
        history: game.history,
        finalSummary: game.status === 'FINAL_SUMMARY' ? game.calculateFinalSummary() : null,
        recapData: game.status === 'CATEGORY_RECAP' ? game.history[game.history.length - 1] : null
      });
    } else {
      socket.emit('reconnect_failed', { message: result.message });
    }
  });

  // 2. Pemain Masuk ke Lobby
  socket.on('join_lobby', ({ name, existingToken }) => {
    const result = game.registerPlayer(name, existingToken);
    if (result.success) {
      playerToken = result.token;
      result.player.socketId = socket.id;

      socket.emit('join_success', {
        token: result.token,
        player: { id: result.player.id, name: result.player.name },
        gameState: game.getPublicGameState(),
        history: game.history,
        finalSummary: game.status === 'FINAL_SUMMARY' ? game.calculateFinalSummary() : null,
        recapData: game.status === 'CATEGORY_RECAP' ? game.history[game.history.length - 1] : null
      });
    } else {
      socket.emit('join_failed', { message: result.message });
    }
  });

  // 3. Pemain Drag & Submit Kata
  socket.on('submit_word', ({ start, end }) => {
    if (!playerToken) {
      socket.emit('submit_word_result', { success: false, message: 'Harap masuk ke lobby terlebih dahulu.' });
      return;
    }

    const result = game.submitWord(playerToken, start, end);
    socket.emit('submit_word_result', result);
  });

  // 4. Autentikasi Host dengan PIN
  socket.on('host_auth', ({ pin }) => {
    if (pin === config.HOST_PIN) {
      isHostAuthenticated = true;
      socket.join('host_room');
      socket.emit('host_auth_success', {
        gameState: game.getPublicGameState(),
        players: game.getPlayerList(),
        categories: categories,
        selectedCategoryIds: game.selectedCategoryIds,
        durationMinutes: game.durationMinutes,
        estimatedMinutes: game.getEstimatedDurationMinutes(),
        history: game.history,
        finalSummary: game.status === 'FINAL_SUMMARY' ? game.calculateFinalSummary() : null
      });
    } else {
      socket.emit('host_auth_failed', { message: 'PIN Host salah! Silakan coba lagi.' });
    }
  });

  // 5. Host Mengatur Sesi (Kategori & Durasi)
  socket.on('host_configure', (settings) => {
    if (!isHostAuthenticated) return;
    const result = game.configureSession(settings);
    socket.emit('host_action_result', result);
  });

  // 6. Host Mulai Kategori
  socket.on('host_start_category', ({ categoryIndex } = {}) => {
    if (!isHostAuthenticated) return;
    game.startCategory(categoryIndex !== undefined ? categoryIndex : null);
  });

  // 7. Host Skip Kategori
  socket.on('host_skip_category', () => {
    if (!isHostAuthenticated) return;
    game.skipCategory();
  });

  // 8. Host Kategori Berikutnya
  socket.on('host_next_category', () => {
    if (!isHostAuthenticated) return;
    game.nextCategory();
  });

  // 9. Host Tambah 30 Detik
  socket.on('host_add_time', ({ seconds = 30 } = {}) => {
    if (!isHostAuthenticated) return;
    game.addTime(seconds);
  });

  // 10. Host Pause / Resume
  socket.on('host_toggle_pause', () => {
    if (!isHostAuthenticated) return;
    game.togglePause();
  });

  // 11. Host Gunakan Hint (1x per kategori)
  socket.on('host_use_hint', () => {
    if (!isHostAuthenticated) return;
    const result = game.useHint();
    socket.emit('host_action_result', result);
  });

  // 12. Host Akhiri Sesi Sekarang
  socket.on('host_end_session', () => {
    if (!isHostAuthenticated) return;
    game.finishSession();
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    if (playerToken) {
      game.disconnectPlayer(socket.id);
    }
  });
});

// Menjalankan server
const PORT = config.PORT;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`Word Search Rebutan Server aktif di port ${PORT}`);
  console.log(`Buka game pemain : http://localhost:${PORT}`);
  console.log(`Buka panel host  : http://localhost:${PORT}/host`);
  console.log(`Default Host PIN : ${config.HOST_PIN}`);
  console.log(`===============================================`);
});
