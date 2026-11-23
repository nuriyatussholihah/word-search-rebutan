# Word Search Rebutan 🔍

Game word search realtime kolaboratif untuk 20-30 orang anggota tim **Squad Limo** (PM, DS, Dev, QA) di sesi sharing online / WFH. 
Semua pemain berada dalam **satu tim**, mencari kata bersama-sama di grid yang sama melawan timer, **tanpa poin dan tanpa ranking kompetitif**.

---

## 🚀 Fitur Utama (Sesuai PRD)

1. **Lobby & Nama Unik**: Pemain masuk dengan nama panggilan unik (tidak boleh kosong atau kembar). Ruang tunggu menampilkan jumlah dan daftar pemain yang hadir secara realtime.
2. **Panel Host Ber-PIN (`/host`)**: Dilindungi PIN rahasia (default: `limo123`). Host dapat memulai, melewati (skip), menambah waktu (+30 detik), pause/resume timer, memberikan petunjuk (hint 1x per kategori), dan mengakhiri sesi.
3. **8 Kategori & Durasi Fleksibel**: 8 kategori istilah kerja tim (Dev, QA, WFH, PM & Data, Meeting, Camilan, Data & AI, Dunia Aplikasi) dengan 9 kata per kategori (total 72 kata). Durasi default 3 menit per kategori (bisa diatur host 2-5 menit).
4. **Grid 15x15 Server-Generated**: Grid 15x15 yang sama untuk semua pemain, digenerate oleh server dengan penempatan kata horizontal, vertikal, dan diagonal (bisa terbalik/mundur). Dijamin semua kata muat tanpa tabrakan.
5. **Drag Selection Halus (Mobile & Desktop)**: Drag dengan mouse di laptop dan sentuhan jari di HP. Dilengkapi pencegah scroll liar di HP (`touch-action: none` & `preventDefault`) dan snap 8 arah otomatis.
6. **Sinkronisasi Highlight & Penemu Realtime**: Kata yang ditemukan langsung di-highlight warna-warni di layar seluruh pemain beserta nama penemunya. Kata yang sudah ditemukan tidak bisa diklaim ulang. Dilengkapi suara arpeggio lembut dan tombol mute.
7. **Timer Sinkron**: Timer hitung mundur sinkron dari server. Berubah warna merah dan berkedip saat sisa waktu <= 30 detik. Kategori selesai otomatis jika waktu habis atau semua kata ketemu.
8. **Daftar Kata Interaktif**: Kata belum ketemu tampil berupa kotak kosong sesuai jumlah huruf (misal `_ _ _ _ _ _`). Saat hint digunakan, huruf pertama satu kata yang belum ketemu terbuka untuk semua orang. Kata ketemu tampil dengan warna dan badge penemu.
9. **Rekap per Kategori & Ringkasan Total**: Rekap di akhir tiap kategori ("Kita menemukan X dari Y kata!"). Di akhir sesi, jika kata ditemukan >= 80% dari total, muncul pesan perayaan; jika tidak, muncul pesan semangat.
10. **3 Penghargaan Lucu di Akhir (Bukan Ranking)**:
    - 🦅 **Si Mata Elang**: Penemu kata terbanyak secara keseluruhan.
    - ⚡ **Penyelamat Detik Terakhir**: Penemu kata di 10 detik terakhir sebuah kategori.
    - 🏹 **Pemburu Kata Panjang**: Penemu kata terpanjang.
    *(Tampil hanya nama pemainnya, tanpa angka. Jika seri, menampilkan semua nama yang seri).*
11. **Reconnect via LocalStorage**: Jika pemain me-refresh browser atau koneksi terputus sesaat, identitas dan kontribusi kata otomatis dipulihkan dari server.
12. **Pengaturan Sesi Dinamis**: Di panel host sebelum mulai, host dapat memilih durasi (2-5 menit), memilih dan mengatur urutan kategori dengan tombol panah naik-turun. Perkiraan durasi sesi dihitung otomatis: `(jumlah kategori × (durasi + 1 menit rekap)) + 7 menit pembukaan dan penutup`. Host juga dapat mengakhiri sesi kapan saja dengan tombol "Akhiri Sesi Sekarang".

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: HTML5, CSS3 murni, JavaScript Vanilla (tanpa framework berat)
- **Audio**: Web Audio API (prosedural, ringan, tanpa file aset mp3 eksternal)
- **Storage**: In-memory server state (tanpa database)
- **Tema Desain**: Teal (`#0d9488`, `#0f766e`) dan Krem (`#fdfbf7`, `#fef3c7`)

---

## 💻 Cara Menjalankan Secara Lokal

### Prasyarat
- Node.js (versi 16 atau lebih baru)
- npm

### Langkah-langkah

1. **Buka Terminal di Direktori Proyek**:
   ```bash
   cd "d:\vibe coding\Word Search Rebutan"
   ```

2. **Instal Dependensi**:
   ```bash
   npm install
   ```

3. **Jalankan Server**:
   ```bash
   npm start
   ```

4. **Akses di Browser**:
   - **Halaman Pemain**: Buka [http://localhost:3000](http://localhost:3000)
   - **Halaman Host**: Buka [http://localhost:3000/host](http://localhost:3000/host)
   - Masukkan PIN Host: `limo123`

---

## 🌐 Panduan Deploy ke Hosting Gratis (Contoh: Render.com)

Aplikasi ini sudah dirancang siap deploy dengan pembacaan port dari `process.env.PORT`.

### Deploy di Render:
1. Push repository proyek ini ke **GitHub** atau **GitLab**.
2. Masuk ke [dashboard.render.com](https://dashboard.render.com/) dan klik **New +** -> **Web Service**.
3. Hubungkan repository GitHub Anda.
4. Masukkan konfigurasi berikut:
   - **Name**: `word-search-rebutan` (atau sesuai keinginan)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
5. *(Opsional)* Pada bagian **Environment Variables**, tambahkan:
   - `HOST_PIN`: PIN rahasia baru untuk host (default jika tidak diisi: `limo123`).
6. Klik **Create Web Service**.
7. Setelah selesai, bagikan URL aplikasi ke seluruh peserta Squad Limo!

> **Tip Sesi WFH**: Karena hosting gratis seperti Render memiliki fitur spin-down (tertidur) saat tidak ada trafik, buka halaman web minimal 10 menit sebelum sesi sharing dimulai untuk memastikan server dalam kondisi aktif.

---

## 📁 Struktur Berkas

```
├── categories.js          # Daftar 8 kategori dan 72 kata UPPERCASE
├── config.js              # Pengaturan port, PIN host, durasi, ukuran grid
├── gameState.js           # Mesin state game, timer, validasi kata, awards
├── wordsearch.js          # Algoritma generator grid 15x15 & kalkulator koordinat
├── server.js              # Server Express & Socket.IO realtime
├── package.json           # Dependensi Express & Socket.IO
├── test/
│   ├── simulation.test.js # Skrip uji coba otomatis alur game & penghargaan
│   └── probe.js           # Skrip uji coba endpoint HTTP
└── public/
    ├── index.html         # Tampilan pemain (Lobby, Playing, Recap, Final)
    ├── host.html          # Tampilan panel kontrol host
    ├── css/
    │   ├── style.css      # Desain tema teal & krem, responsif mobile & desktop
    │   └── host.css       # Desain kontrol panel host
    └── js/
        ├── audio.js       # Synthesizer efek suara Web Audio API & tombol mute
        ├── game.js        # Logika pemain, drag selection touch & mouse
        └── host.js        # Logika host, autentikasi PIN, pengaturan sesi
```

---

## 🧪 Menjalankan Uji Coba

Untuk memastikan seluruh logika kalkulasi grid, validasi drag, keunikan nama, reconnect, dan ketiga penghargaan lucu berjalan dengan benar, jalankan skrip simulasi:

```bash
npm test
# atau
node test/simulation.test.js
```
