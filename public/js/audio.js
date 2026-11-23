// Modul Suara Word Search Rebutan menggunakan Web Audio API
// Ringan, bebas dependensi file eksternal, dan dilengkapi kontrol mute

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.isMuted = localStorage.getItem('ws_muted') === 'true';
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('ws_muted', this.isMuted);
    return this.isMuted;
  }

  // Suara kecil saat kata berhasil ditemukan
  playWordFound() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (chord C Major)
      notes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0, this.audioCtx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, this.audioCtx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(this.audioCtx.currentTime + idx * 0.08);
        osc.stop(this.audioCtx.currentTime + idx * 0.08 + 0.4);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Suara lembut saat hint dibuka
  playHint() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, this.audioCtx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.35);
    } catch (e) {}
  }

  // Suara peringatan detik terakhir (10s)
  playUrgentTick() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.12);
    } catch (e) {}
  }

  // Fanfare di akhir sesi permainan
  playCelebration() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const chords = [
        [523.25, 659.25, 783.99], // C
        [587.33, 739.99, 880.00], // D
        [659.25, 830.61, 987.77], // E
        [783.99, 987.77, 1174.66] // G
      ];

      chords.forEach((chord, i) => {
        chord.forEach(freq => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + i * 0.18);

          gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime + i * 0.18);
          gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + i * 0.18 + 0.45);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(this.audioCtx.currentTime + i * 0.18);
          osc.stop(this.audioCtx.currentTime + i * 0.18 + 0.5);
        });
      });
    } catch (e) {}
  }
}

window.sounds = new SoundManager();
