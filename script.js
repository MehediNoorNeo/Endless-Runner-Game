/**
 * ============================================================================
 * Endless Runner - Cyber Horizon
 * A polished, professional 2D Endless Runner built with HTML5 Canvas & Web Audio.
 * 
 * Clean separation of systems:
 * 1. AudioSynthesizer (Web Audio API procedural sound engine)
 * 2. ParticleSystem (Particles, sparks, dust, confetti, floating text)
 * 3. Environment & Parallax (Dynamic Day/Night Cycle, layered scenery)
 * 4. Player Character (Articulated Canvas character, kinematics & animations)
 * 5. Obstacle & Collectible Spawner (Procedural, fair, multiple types)
 * 6. PowerUp System (Shield, Magnet, 2X Multiplier, Speed Boost, Slow-Mo)
 * 7. Game Engine & State Machine (Physics, collision, loop, responsiveness)
 * ============================================================================
 */

'use strict';

// Universal Canvas roundRect polyfill
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    if (!radii) radii = 0;
    const r = typeof radii === 'number' ? radii : (radii[0] || 0);
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
    return this;
  };
}

/* ==========================================================================
   1. CONSTANTS & CONFIGURATION
   ========================================================================== */
const CONFIG = {
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,
  GROUND_Y: 570,
  GRAVITY: 1650,          // px / s^2
  JUMP_FORCE: -680,       // px / s
  DOUBLE_JUMP_FORCE: -600,// px / s
  SLIDE_DURATION: 0.65,   // seconds
  BASE_SPEED: 420,        // px / s
  MAX_SPEED: 920,         // px / s
  SPEED_ACCEL: 3.5,       // px / s per second of gameplay
  DAY_NIGHT_CYCLE_TIME: 80,// seconds per full 24-hr cycle
  COIN_BASE_VALUE: 10,
  MAX_PARTICLES: 250,
  STORAGE_KEYS: {
    BEST_SCORE: 'cyber_runner_best_score',
    BEST_DIST: 'cyber_runner_best_dist',
    SOUND_ENABLED: 'cyber_runner_sound_enabled'
  }
};

const STATES = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER'
};

const POWERUP_TYPES = {
  SHIELD: { id: 'shield', name: 'Energy Shield', icon: '🛡️', duration: 12, color: '#00e5ff' },
  MAGNET: { id: 'magnet', name: 'Coin Magnet', icon: '🧲', duration: 10, color: '#e040fb' },
  MULTIPLIER: { id: 'multiplier', name: '2X Score', icon: '✨', duration: 10, color: '#ffc400' },
  SPEED: { id: 'speed', name: 'Hyper Dash', icon: '⚡', duration: 5, color: '#ff5722' },
  SLOWMO: { id: 'slowmo', name: 'Time Warp', icon: '⏳', duration: 7, color: '#00e676' }
};

/* ==========================================================================
   2. AUDIO SYNTHESIZER (Web Audio API - Zero External Dependencies)
   ========================================================================== */
class AudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.initialized = false;
    
    // Load preference from localStorage
    try {
      const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.SOUND_ENABLED);
      if (saved !== null) {
        this.enabled = saved === 'true';
      }
    } catch (e) {
      this.enabled = true;
    }
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
        this.initialized = true;
      }
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.SOUND_ENABLED, String(this.enabled));
    } catch (e) {}
    if (this.enabled) this.resume();
    return this.enabled;
  }

  // --- Sound Effects ---
  playJump() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.16);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  playDoubleJump() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.22);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  playSlide() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Filtered noise for slide swoosh
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(750, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.22);
    filter.Q.value = 2.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  playCoin() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Pleasant dual chime arpeggio (B5 -> E6)
    const tones = [987.77, 1318.51];
    tones.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.05;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  playPowerup() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Ascending celebratory major fanfare (C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.22, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.26);
    });
  }

  playShieldBreak() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.3);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.32);
  }

  playHit() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.38);
  }

  playGameOver() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Sad minor cadence (G4 -> Eb4 -> C4)
    const tones = [392.00, 311.13, 261.63];
    tones.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.16;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.28, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.32);
    });
  }

  playNewHighScore() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Triumphant arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  }

  playClick() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }
}

/* ==========================================================================
   3. PARTICLE & FLOATING TEXT SYSTEM
   ========================================================================== */
class Particle {
  constructor(x, y, options = {}) {
    this.x = x;
    this.y = y;
    this.vx = options.vx || (Math.random() * 200 - 100);
    this.vy = options.vy || (Math.random() * 200 - 100);
    this.size = options.size || (Math.random() * 4 + 3);
    this.baseSize = this.size;
    this.color = options.color || '#00e5ff';
    this.alpha = options.alpha !== undefined ? options.alpha : 1;
    this.decay = options.decay || (Math.random() * 1.5 + 1.2);
    this.gravity = options.gravity || 0;
    this.shape = options.shape || 'circle'; // 'circle', 'square', 'ring', 'star'
    this.rotation = Math.random() * Math.PI * 2;
    this.vRot = (Math.random() - 0.5) * 8;
    this.life = 1;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.rotation += this.vRot * dt;
    this.life -= this.decay * dt;
    this.alpha = Math.max(0, this.life);
    return this.life > 0;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;

    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.shape === 'square') {
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    } else if (this.shape === 'ring') {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.size * (2 - this.life), 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.shape === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * this.size, -Math.sin((18 + i * 72) * Math.PI / 180) * this.size);
        ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * (this.size * 0.4), -Math.sin((54 + i * 72) * Math.PI / 180) * (this.size * 0.4));
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

class FloatingText {
  constructor(text, x, y, color = '#ffc400', size = 22) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size;
    this.vy = -60;
    this.life = 1;
    this.decay = 1.3;
    this.scale = 0.6;
  }

  update(dt) {
    this.y += this.vy * dt;
    this.life -= this.decay * dt;
    this.scale = Math.min(1.2, this.scale + dt * 4);
    return this.life > 0;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.font = `900 ${Math.round(this.size * this.scale)}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Text shadow / outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(this.text, this.x, this.y);
    
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

class ParticleManager {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
  }

  reset() {
    this.particles = [];
    this.floatingTexts = [];
  }

  add(particle) {
    if (this.particles.length < CONFIG.MAX_PARTICLES) {
      this.particles.push(particle);
    }
  }

  addText(text, x, y, color, size) {
    this.floatingTexts.push(new FloatingText(text, x, y, color, size));
  }

  // --- Particle Presets ---
  emitJumpDust(x, y) {
    for (let i = 0; i < 10; i++) {
      this.add(new Particle(x + (Math.random() * 20 - 10), y, {
        vx: (Math.random() - 0.7) * 120,
        vy: -Math.random() * 45,
        size: Math.random() * 4 + 2,
        color: '#e2e8f0',
        gravity: 80,
        decay: 2.2
      }));
    }
  }

  emitDoubleJumpWave(x, y) {
    this.add(new Particle(x, y, {
      size: 14,
      color: '#00e5ff',
      shape: 'ring',
      decay: 2.5
    }));
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      this.add(new Particle(x, y, {
        vx: Math.cos(angle) * 160,
        vy: Math.sin(angle) * 160,
        size: 3,
        color: '#7c4dff',
        decay: 2.0
      }));
    }
  }

  emitSlideSparks(x, y) {
    for (let i = 0; i < 3; i++) {
      this.add(new Particle(x + (Math.random() * 30 - 15), y - 4, {
        vx: -Math.random() * 180 - 60,
        vy: -Math.random() * 60 - 10,
        size: Math.random() * 3 + 1.5,
        color: Math.random() > 0.4 ? '#ffb300' : '#ff3d00',
        gravity: 120,
        decay: 3.5
      }));
    }
  }

  emitRunDust(x, y) {
    this.add(new Particle(x - 15, y, {
      vx: -Math.random() * 100 - 40,
      vy: -Math.random() * 30,
      size: Math.random() * 3 + 1.5,
      color: '#cbd5e1',
      gravity: 50,
      decay: 3.0
    }));
  }

  emitCoinBurst(x, y) {
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 160 + 60;
      this.add(new Particle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: Math.random() > 0.3 ? '#ffc400' : '#fff59d',
        shape: Math.random() > 0.5 ? 'star' : 'circle',
        decay: 1.8,
        gravity: 90
      }));
    }
  }

  emitPowerupBurst(x, y, color = '#00e5ff') {
    this.add(new Particle(x, y, {
      size: 22,
      color: color,
      shape: 'ring',
      decay: 1.5
    }));
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 220 + 80;
      this.add(new Particle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 5 + 3,
        color: color,
        shape: 'star',
        decay: 1.5,
        gravity: 60
      }));
    }
  }

  emitShieldDeflect(x, y) {
    this.add(new Particle(x, y, {
      size: 35,
      color: '#00e5ff',
      shape: 'ring',
      decay: 2.0
    }));
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 260 + 100;
      this.add(new Particle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4,
        color: '#00e5ff',
        decay: 2.2
      }));
    }
  }

  emitCollision(x, y) {
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 320 + 80;
      this.add(new Particle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 5 + 3,
        color: Math.random() > 0.5 ? '#ff3d71' : '#ff9100',
        shape: 'square',
        decay: 1.2,
        gravity: 240
      }));
    }
  }

  emitConfetti() {
    const colors = ['#00e5ff', '#ffc400', '#ff2a85', '#00e676', '#7c4dff'];
    for (let i = 0; i < 80; i++) {
      this.add(new Particle(
        Math.random() * CONFIG.CANVAS_WIDTH,
        Math.random() * (CONFIG.CANVAS_HEIGHT * 0.4),
        {
          vx: (Math.random() - 0.5) * 180,
          vy: Math.random() * 140 + 60,
          size: Math.random() * 6 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: 'square',
          decay: 0.45,
          gravity: 50
        }
      ));
    }
  }

  update(dt) {
    this.particles = this.particles.filter(p => p.update(dt));
    this.floatingTexts = this.floatingTexts.filter(t => t.update(dt));
  }

  draw(ctx) {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].draw(ctx);
    }
    for (let i = 0; i < this.floatingTexts.length; i++) {
      this.floatingTexts[i].draw(ctx);
    }
  }
}

/* ==========================================================================
   4. ENVIRONMENT & PARALLAX SCENERY (Dynamic Day/Night Cycle)
   ========================================================================== */
class Environment {
  constructor() {
    this.timeOfDay = 0.25; // 0 = Midnight, 0.25 = Day, 0.55 = Sunset, 0.8 = Dusk
    this.cycleTimer = 0;
    this.stars = [];
    this.clouds = [];
    this.mountains = [];
    this.hills = [];
    this.nearFoliage = [];
    this.groundOffset = 0;
    
    this.initStars();
    this.initClouds();
    this.initMountains();
    this.initHills();
    this.initNearFoliage();
  }

  initStars() {
    this.stars = [];
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: Math.random() * CONFIG.CANVAS_WIDTH,
        y: Math.random() * (CONFIG.GROUND_Y - 200),
        size: Math.random() * 2 + 1,
        twinkleSpeed: Math.random() * 3 + 1,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  initClouds() {
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x: Math.random() * CONFIG.CANVAS_WIDTH,
        y: Math.random() * 180 + 30,
        width: Math.random() * 90 + 70,
        height: Math.random() * 35 + 25,
        speedFactor: Math.random() * 0.15 + 0.08,
        opacity: Math.random() * 0.4 + 0.5
      });
    }
  }

  initMountains() {
    this.mountains = [];
    const count = 7;
    const step = CONFIG.CANVAS_WIDTH / (count - 2);
    for (let i = 0; i < count; i++) {
      this.mountains.push({
        x: i * step - 100,
        width: step * 1.6,
        height: Math.random() * 140 + 200
      });
    }
  }

  initHills() {
    this.hills = [];
    const count = 10;
    const step = CONFIG.CANVAS_WIDTH / (count - 2);
    for (let i = 0; i < count; i++) {
      this.hills.push({
        x: i * step - 50,
        width: step * 1.4,
        height: Math.random() * 60 + 90
      });
    }
  }

  initNearFoliage() {
    this.nearFoliage = [];
    for (let i = 0; i < 8; i++) {
      this.nearFoliage.push({
        x: Math.random() * CONFIG.CANVAS_WIDTH,
        type: Math.random() > 0.5 ? 'pine' : 'bush',
        size: Math.random() * 25 + 35
      });
    }
  }

  update(dt, gameSpeed) {
    // Progress Day/Night Cycle
    this.cycleTimer += dt;
    this.timeOfDay = (this.cycleTimer / CONFIG.DAY_NIGHT_CYCLE_TIME) % 1.0;

    // Update parallax clouds
    for (let c of this.clouds) {
      c.x -= gameSpeed * c.speedFactor * dt;
      if (c.x + c.width < 0) {
        c.x = CONFIG.CANVAS_WIDTH + Math.random() * 80;
        c.y = Math.random() * 180 + 30;
      }
    }

    // Scroll mountains (slow factor: 0.12)
    const mtnSpeed = gameSpeed * 0.12 * dt;
    for (let m of this.mountains) {
      m.x -= mtnSpeed;
    }
    const rightmostMtn = Math.max(...this.mountains.map(m => m.x));
    for (let m of this.mountains) {
      if (m.x + m.width < 0) {
        m.x = rightmostMtn + m.width * 0.6;
        m.height = Math.random() * 140 + 200;
      }
    }

    // Scroll hills (mid factor: 0.3)
    const hillSpeed = gameSpeed * 0.3 * dt;
    for (let h of this.hills) {
      h.x -= hillSpeed;
    }
    const rightmostHill = Math.max(...this.hills.map(h => h.x));
    for (let h of this.hills) {
      if (h.x + h.width < 0) {
        h.x = rightmostHill + h.width * 0.7;
        h.height = Math.random() * 60 + 90;
      }
    }

    // Scroll near foliage (near factor: 0.6)
    const folSpeed = gameSpeed * 0.6 * dt;
    for (let f of this.nearFoliage) {
      f.x -= folSpeed;
      if (f.x < -60) {
        f.x = CONFIG.CANVAS_WIDTH + Math.random() * 100;
        f.type = Math.random() > 0.5 ? 'pine' : 'bush';
      }
    }

    // Ground stripe offset
    this.groundOffset = (this.groundOffset + gameSpeed * dt) % 60;
  }

  // Linear color interpolation helper
  lerpColor(a, b, t) {
    const ah = parseInt(a.replace(/#/g, ''), 16);
    const ar = (ah >> 16) & 0xff;
    const ag = (ah >> 8) & 0xff;
    const ab = ah & 0xff;

    const bh = parseInt(b.replace(/#/g, ''), 16);
    const br = (bh >> 16) & 0xff;
    const bg = (bh >> 8) & 0xff;
    const bb = bh & 0xff;

    const rr = Math.round(ar + t * (br - ar));
    const rg = Math.round(ag + t * (bg - ag));
    const rb = Math.round(ab + t * (bb - ab));

    return `rgb(${rr}, ${rg}, ${rb})`;
  }

  getSkyColors() {
    // Day cycle phases: 0.0=Night, 0.25=Dawn, 0.5=Day, 0.75=Sunset, 1.0=Night
    const t = this.timeOfDay;
    let top, bottom, isNight = false;

    if (t < 0.2) { // Deep Night
      top = '#060714';
      bottom = '#10142c';
      isNight = true;
    } else if (t < 0.35) { // Dawn / Sunrise
      const factor = (t - 0.2) / 0.15;
      top = this.lerpColor('#060714', '#1e3c72', factor);
      bottom = this.lerpColor('#10142c', '#f39c12', factor);
    } else if (t < 0.65) { // Day
      top = '#1a73e8';
      bottom = '#87ceeb';
    } else if (t < 0.8) { // Sunset / Dusk
      const factor = (t - 0.65) / 0.15;
      top = this.lerpColor('#1a73e8', '#2b1055', factor);
      bottom = this.lerpColor('#87ceeb', '#ff5e62', factor);
    } else { // Returning to Night
      const factor = (t - 0.8) / 0.2;
      top = this.lerpColor('#2b1055', '#060714', factor);
      bottom = this.lerpColor('#ff5e62', '#10142c', factor);
      isNight = true;
    }

    return { top, bottom, isNight };
  }

  draw(ctx) {
    const { top, bottom, isNight } = this.getSkyColors();

    // 1. Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CONFIG.GROUND_Y);
    skyGrad.addColorStop(0, top);
    skyGrad.addColorStop(1, bottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.GROUND_Y);

    // 2. Stars (Visible at night / dawn / dusk)
    const starAlpha = (this.timeOfDay > 0.75 || this.timeOfDay < 0.3) ? 
      (this.timeOfDay > 0.8 || this.timeOfDay < 0.25 ? 0.9 : 0.4) : 0;

    if (starAlpha > 0) {
      ctx.save();
      for (let s of this.stars) {
        const twinkle = Math.sin(this.cycleTimer * s.twinkleSpeed + s.phase) * 0.3 + 0.7;
        ctx.globalAlpha = starAlpha * twinkle;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Celestial Bodies (Sun & Moon)
    this.drawCelestialBodies(ctx);

    // 4. Parallax Clouds
    this.drawClouds(ctx, isNight);

    // 5. Distant Mountains
    this.drawMountains(ctx, isNight);

    // 6. Midground Rolling Hills
    this.drawHills(ctx, isNight);

    // 7. Near Foliage & Silhouettes
    this.drawNearFoliage(ctx, isNight);

    // 8. Ground & Roadway
    this.drawGround(ctx, isNight);
  }

  drawCelestialBodies(ctx) {
    ctx.save();
    // Sun position arc
    const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.GROUND_Y - 50;
    const orbitRadius = 450;

    const sunX = cx - Math.cos(sunAngle) * orbitRadius;
    const sunY = cy - Math.sin(sunAngle) * (orbitRadius * 0.75);

    // Moon position (opposite to sun)
    const moonX = cx - Math.cos(sunAngle + Math.PI) * orbitRadius;
    const moonY = cy - Math.sin(sunAngle + Math.PI) * (orbitRadius * 0.75);

    // Draw Sun
    if (sunY < CONFIG.GROUND_Y) {
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 65);
      sunGrad.addColorStop(0, '#fffdf0');
      sunGrad.addColorStop(0.3, '#ffcc00');
      sunGrad.addColorStop(1, 'rgba(255, 150, 0, 0)');

      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 65, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Moon
    if (moonY < CONFIG.GROUND_Y) {
      ctx.shadowColor = 'rgba(200, 230, 255, 0.8)';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#f0f4f8';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 32, 0, Math.PI * 2);
      ctx.fill();

      // Moon craters
      ctx.fillStyle = 'rgba(180, 195, 210, 0.4)';
      ctx.beginPath();
      ctx.arc(moonX - 8, moonY - 6, 7, 0, Math.PI * 2);
      ctx.arc(moonX + 10, moonY + 4, 9, 0, Math.PI * 2);
      ctx.arc(moonX - 4, moonY + 12, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawClouds(ctx, isNight) {
    ctx.save();
    for (let c of this.clouds) {
      ctx.fillStyle = isNight ? `rgba(60, 70, 105, ${c.opacity * 0.6})` : `rgba(255, 255, 255, ${c.opacity})`;
      ctx.beginPath();
      const x = c.x;
      const y = c.y;
      const w = c.width;
      const h = c.height;

      // Soft rounded puffy cloud
      ctx.arc(x + w * 0.25, y + h * 0.6, h * 0.45, 0, Math.PI * 2);
      ctx.arc(x + w * 0.5, y + h * 0.4, h * 0.55, 0, Math.PI * 2);
      ctx.arc(x + w * 0.75, y + h * 0.6, h * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawMountains(ctx, isNight) {
    ctx.save();
    const mtnColor = isNight ? '#161b33' : '#3d527a';
    const snowColor = isNight ? '#3a4468' : '#e0e8f5';

    for (let m of this.mountains) {
      const peakX = m.x + m.width / 2;
      const peakY = CONFIG.GROUND_Y - m.height;

      // Mountain body
      ctx.fillStyle = mtnColor;
      ctx.beginPath();
      ctx.moveTo(m.x, CONFIG.GROUND_Y);
      ctx.lineTo(peakX, peakY);
      ctx.lineTo(m.x + m.width, CONFIG.GROUND_Y);
      ctx.closePath();
      ctx.fill();

      // Snowcap
      ctx.fillStyle = snowColor;
      ctx.beginPath();
      ctx.moveTo(peakX - m.width * 0.15, peakY + m.height * 0.25);
      ctx.lineTo(peakX, peakY);
      ctx.lineTo(peakX + m.width * 0.15, peakY + m.height * 0.25);
      ctx.lineTo(peakX + m.width * 0.06, peakY + m.height * 0.32);
      ctx.lineTo(peakX, peakY + m.height * 0.22);
      ctx.lineTo(peakX - m.width * 0.08, peakY + m.height * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawHills(ctx, isNight) {
    ctx.save();
    const hillColor = isNight ? '#0e242b' : '#2d7a5b';
    ctx.fillStyle = hillColor;

    for (let h of this.hills) {
      ctx.beginPath();
      ctx.moveTo(h.x, CONFIG.GROUND_Y);
      ctx.quadraticCurveTo(h.x + h.width / 2, CONFIG.GROUND_Y - h.height, h.x + h.width, CONFIG.GROUND_Y);
      ctx.fill();
    }
    ctx.restore();
  }

  drawNearFoliage(ctx, isNight) {
    ctx.save();
    const treeColor = isNight ? '#0b1c20' : '#1e5e43';
    ctx.fillStyle = treeColor;

    for (let f of this.nearFoliage) {
      if (f.type === 'pine') {
        // Stylized pine tree
        const topY = CONFIG.GROUND_Y - f.size;
        ctx.beginPath();
        ctx.moveTo(f.x, topY);
        ctx.lineTo(f.x + f.size * 0.4, topY + f.size * 0.4);
        ctx.lineTo(f.x + f.size * 0.2, topY + f.size * 0.4);
        ctx.lineTo(f.x + f.size * 0.5, topY + f.size * 0.75);
        ctx.lineTo(f.x + f.size * 0.25, topY + f.size * 0.75);
        ctx.lineTo(f.x + f.size * 0.6, CONFIG.GROUND_Y);
        ctx.lineTo(f.x - f.size * 0.6, CONFIG.GROUND_Y);
        ctx.lineTo(f.x - f.size * 0.25, topY + f.size * 0.75);
        ctx.lineTo(f.x - f.size * 0.5, topY + f.size * 0.75);
        ctx.lineTo(f.x - f.size * 0.2, topY + f.size * 0.4);
        ctx.lineTo(f.x - f.size * 0.4, topY + f.size * 0.4);
        ctx.closePath();
        ctx.fill();
      } else {
        // Bush
        ctx.beginPath();
        ctx.arc(f.x, CONFIG.GROUND_Y - f.size * 0.35, f.size * 0.4, 0, Math.PI * 2);
        ctx.arc(f.x + f.size * 0.3, CONFIG.GROUND_Y - f.size * 0.3, f.size * 0.32, 0, Math.PI * 2);
        ctx.arc(f.x - f.size * 0.3, CONFIG.GROUND_Y - f.size * 0.3, f.size * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawGround(ctx, isNight) {
    ctx.save();
    const roadY = CONFIG.GROUND_Y;
    const roadHeight = CONFIG.CANVAS_HEIGHT - roadY;

    // Grass verge edge
    ctx.fillStyle = isNight ? '#103024' : '#388e3c';
    ctx.fillRect(0, roadY - 14, CONFIG.CANVAS_WIDTH, 14);

    // Road asphalt
    const roadGrad = ctx.createLinearGradient(0, roadY, 0, CONFIG.CANVAS_HEIGHT);
    if (isNight) {
      roadGrad.addColorStop(0, '#151724');
      roadGrad.addColorStop(1, '#0c0d16');
    } else {
      roadGrad.addColorStop(0, '#2d3244');
      roadGrad.addColorStop(1, '#1b1e2b');
    }
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, roadY, CONFIG.CANVAS_WIDTH, roadHeight);

    // Road Dash Lines (moving left)
    ctx.fillStyle = isNight ? '#00e5ff' : '#ffc400';
    ctx.shadowColor = isNight ? 'rgba(0, 229, 255, 0.6)' : 'rgba(255, 196, 0, 0.4)';
    ctx.shadowBlur = 8;
    const dashWidth = 36;
    const dashGap = 24;
    const dashY = roadY + 55;

    for (let x = -this.groundOffset; x < CONFIG.CANVAS_WIDTH + 60; x += (dashWidth + dashGap)) {
      ctx.fillRect(x, dashY, dashWidth, 6);
    }

    // Lower curb/gravel
    ctx.shadowBlur = 0;
    ctx.fillStyle = isNight ? '#07080e' : '#141620';
    ctx.fillRect(0, CONFIG.CANVAS_HEIGHT - 35, CONFIG.CANVAS_WIDTH, 35);

    // Foreground grass blades for deep 3D depth
    ctx.fillStyle = isNight ? '#091c15' : '#225928';
    for (let x = -this.groundOffset * 1.5; x < CONFIG.CANVAS_WIDTH + 40; x += 35) {
      ctx.beginPath();
      ctx.moveTo(x, CONFIG.CANVAS_HEIGHT);
      ctx.lineTo(x + 6, CONFIG.CANVAS_HEIGHT - 18);
      ctx.lineTo(x + 12, CONFIG.CANVAS_HEIGHT);
      ctx.fill();
    }

    ctx.restore();
  }
}

/* ==========================================================================
   5. PLAYER CHARACTER (Canvas Articulated Kinematics & Animations)
   ========================================================================== */
class Player {
  constructor() {
    this.x = 180;
    this.y = CONFIG.GROUND_Y;
    this.vy = 0;
    this.width = 46;
    this.height = 84;
    
    // States
    this.isGrounded = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.jumpCount = 0; // Double jump support (max 2)
    this.isHit = false;
    this.hitTimer = 0;
    this.isGameOver = false;

    // Active Powerups map: { type: remainingSeconds }
    this.activePowerups = new Map();

    // Animation cycle timers
    this.runCycle = 0;
    this.dustTimer = 0;
    this.spinRotation = 0; // For double jump flip
    this.blinkTimer = Math.random() * 3 + 2;
    this.isBlinking = false;
  }

  reset() {
    this.x = 180;
    this.y = CONFIG.GROUND_Y;
    this.vy = 0;
    this.width = 46;
    this.height = 84;
    this.isGrounded = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.jumpCount = 0;
    this.isHit = false;
    this.hitTimer = 0;
    this.isGameOver = false;
    this.activePowerups.clear();
    this.runCycle = 0;
    this.dustTimer = 0;
    this.spinRotation = 0;
  }

  jump(audio, particles) {
    if (this.isGameOver) return;

    if (this.isGrounded) {
      // First Jump
      this.vy = CONFIG.JUMP_FORCE;
      this.isGrounded = false;
      this.jumpCount = 1;
      this.isSliding = false;
      audio.playJump();
      particles.emitJumpDust(this.x + this.width / 2, CONFIG.GROUND_Y);
    } else if (this.jumpCount === 1) {
      // Double Jump
      this.vy = CONFIG.DOUBLE_JUMP_FORCE;
      this.jumpCount = 2;
      this.spinRotation = 0;
      audio.playDoubleJump();
      particles.emitDoubleJumpWave(this.x + this.width / 2, this.y - this.height / 2);
    }
  }

  slide(audio, particles) {
    if (this.isGameOver || !this.isGrounded || this.isSliding) return;
    this.isSliding = true;
    this.slideTimer = CONFIG.SLIDE_DURATION;
    audio.playSlide();
    particles.emitSlideSparks(this.x + this.width / 2, CONFIG.GROUND_Y);
  }

  applyPowerup(powerupType, audio, particles) {
    this.activePowerups.set(powerupType.id, {
      type: powerupType,
      timeLeft: powerupType.duration,
      duration: powerupType.duration
    });
    audio.playPowerup();
    particles.emitPowerupBurst(this.x + this.width / 2, this.y - this.height / 2, powerupType.color);
    particles.addText(powerupType.name.toUpperCase(), this.x + this.width / 2, this.y - this.height - 20, powerupType.color, 24);
  }

  hasPowerup(id) {
    return this.activePowerups.has(id);
  }

  getHitbox() {
    // Fair hitboxes: Slide shrinks height; Jump elevates box
    if (this.isSliding) {
      return {
        x: this.x + 4,
        y: this.y - 40,
        width: this.width + 14,
        height: 38
      };
    }
    return {
      x: this.x + 8,
      y: this.y - this.height + 6,
      width: this.width - 14,
      height: this.height - 10
    };
  }

  update(dt, gameSpeed, audio, particles) {
    // 1. Update Powerup Timers
    for (const [id, p] of this.activePowerups.entries()) {
      p.timeLeft -= dt;
      if (p.timeLeft <= 0) {
        this.activePowerups.delete(id);
      }
    }

    // 2. Slide countdown
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      } else {
        // Slide particles
        particles.emitSlideSparks(this.x + this.width * 0.7, CONFIG.GROUND_Y);
      }
    }

    // 3. Physics & Gravity
    if (!this.isGrounded) {
      this.vy += CONFIG.GRAVITY * dt;
      this.y += this.vy * dt;

      // Double jump spin animation
      if (this.jumpCount === 2) {
        this.spinRotation += dt * 14;
      }

      // Check ground landing
      if (this.y >= CONFIG.GROUND_Y) {
        this.y = CONFIG.GROUND_Y;
        this.vy = 0;
        this.isGrounded = true;
        this.jumpCount = 0;
        this.spinRotation = 0;
        particles.emitJumpDust(this.x + this.width / 2, CONFIG.GROUND_Y);
      }
    } else if (!this.isSliding && !this.isGameOver) {
      // Ground running dust
      this.dustTimer += dt;
      if (this.dustTimer > 0.16) {
        this.dustTimer = 0;
        particles.emitRunDust(this.x + 10, CONFIG.GROUND_Y);
      }
    }

    // 4. Run Cycle Animation
    const animRate = (gameSpeed / CONFIG.BASE_SPEED) * 12;
    this.runCycle += dt * animRate;

    // 5. Blinking Animation
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      if (this.blinkTimer < -0.15) {
        this.isBlinking = false;
        this.blinkTimer = Math.random() * 4 + 2;
      }
    }

    // 6. Hit Recovery Flash
    if (this.isHit) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) {
        this.isHit = false;
      }
    }
  }

  draw(ctx) {
    ctx.save();

    // 1. Shadow underneath
    this.drawShadow(ctx);

    // 2. Active Power-Up Auras (Behind player)
    this.drawPowerupAuras(ctx);

    // 3. Flash on Hit / Hurt
    if (this.isHit && Math.floor(Date.now() / 60) % 2 === 0) {
      ctx.restore();
      return;
    }

    ctx.translate(this.x + this.width / 2, this.y);

    // 4. Pose rendering based on state
    if (this.isGameOver) {
      this.drawGameOverPose(ctx);
    } else if (this.isSliding) {
      this.drawSlidePose(ctx);
    } else if (!this.isGrounded) {
      this.drawJumpPose(ctx);
    } else {
      this.drawRunPose(ctx);
    }

    ctx.restore();

    // 5. Shield Aura (In front of player)
    if (this.hasPowerup('shield')) {
      this.drawShieldBubble(ctx);
    }
  }

  drawShadow(ctx) {
    const groundDist = CONFIG.GROUND_Y - this.y;
    const shadowScale = Math.max(0.3, 1 - groundDist / 380);
    const shadowAlpha = Math.max(0.1, 0.45 - groundDist / 500);

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(
      this.x + this.width / 2,
      CONFIG.GROUND_Y + 2,
      (this.width * 0.7) * shadowScale,
      7 * shadowScale,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  drawRunPose(ctx) {
    const cycle = this.runCycle;
    const legAngle1 = Math.sin(cycle) * 0.75;
    const legAngle2 = Math.sin(cycle + Math.PI) * 0.75;
    const armAngle1 = Math.sin(cycle + Math.PI) * 0.65;
    const armAngle2 = Math.sin(cycle) * 0.65;
    const bobY = Math.abs(Math.sin(cycle * 2)) * -6;

    ctx.translate(0, bobY);

    // Leaning forward slightly when running
    ctx.rotate(0.1);

    // Back Arm
    this.drawLimb(ctx, 4, -48, 22, armAngle2, '#00b0ff', '#0088cc', true);

    // Back Leg
    this.drawLeg(ctx, -2, -26, 26, legAngle2, '#1a237e', '#ff3d00');

    // Torso / Jacket
    this.drawTorso(ctx, 0, -50);

    // Head
    this.drawHead(ctx, 4, -70);

    // Front Leg
    this.drawLeg(ctx, 4, -26, 26, legAngle1, '#283593', '#ff6e40');

    // Front Arm
    this.drawLimb(ctx, -4, -48, 22, armAngle1, '#00e5ff', '#00b0ff', false);
  }

  drawJumpPose(ctx) {
    const vy = this.vy;
    let tilt = vy < 0 ? -0.15 : 0.12;

    if (this.jumpCount === 2) {
      // Double jump spin
      ctx.rotate(this.spinRotation);
    } else {
      ctx.rotate(tilt);
    }

    // Legs tucked upward during jump
    this.drawLeg(ctx, -4, -26, 24, -0.6, '#1a237e', '#ff3d00');
    this.drawLeg(ctx, 4, -26, 24, -0.9, '#283593', '#ff6e40');

    // Torso
    this.drawTorso(ctx, 0, -50);

    // Head
    this.drawHead(ctx, 4, -70);

    // Arms raised up
    this.drawLimb(ctx, -6, -48, 22, -1.8, '#00b0ff', '#0088cc', true);
    this.drawLimb(ctx, 6, -48, 22, -2.1, '#00e5ff', '#00b0ff', false);
  }

  drawSlidePose(ctx) {
    ctx.translate(0, -6);
    ctx.rotate(-0.85); // Low slide angle

    // Legs extended forward
    this.drawLeg(ctx, -4, -26, 28, 0.9, '#1a237e', '#ff3d00');
    this.drawLeg(ctx, 4, -26, 28, 1.1, '#283593', '#ff6e40');

    // Torso
    this.drawTorso(ctx, 0, -48);

    // Head tilted up
    this.drawHead(ctx, 6, -68, true);

    // Arms planted back for balance
    this.drawLimb(ctx, -6, -46, 22, 1.4, '#00b0ff', '#0088cc', true);
    this.drawLimb(ctx, 6, -46, 22, 1.2, '#00e5ff', '#00b0ff', false);
  }

  drawGameOverPose(ctx) {
    ctx.translate(0, -10);
    ctx.rotate(1.4); // Tumbled backward onto ground

    this.drawLeg(ctx, -4, -26, 24, 0.4, '#1a237e', '#ff3d00');
    this.drawLeg(ctx, 4, -26, 24, -0.3, '#283593', '#ff6e40');
    this.drawTorso(ctx, 0, -48);
    this.drawHead(ctx, 4, -68, false, true);
    this.drawLimb(ctx, -6, -46, 22, 0.8, '#00b0ff', '#0088cc', false);

    // Dizzy stars floating
    ctx.save();
    ctx.fillStyle = '#ffc400';
    const angle = Date.now() / 200;
    for (let i = 0; i < 3; i++) {
      const a = angle + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(4 + Math.cos(a) * 20, -78 + Math.sin(a) * 8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHead(ctx, hx, hy, squint = false, dizzy = false) {
    ctx.save();
    ctx.translate(hx, hy);

    // Hair back/spike
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.lineTo(-24, -14);
    ctx.lineTo(-12, -18);
    ctx.lineTo(-18, -26);
    ctx.lineTo(-2, -24);
    ctx.lineTo(8, -26);
    ctx.lineTo(14, -12);
    ctx.closePath();
    ctx.fill();

    // Face / Head circle
    const skinGrad = ctx.createLinearGradient(0, -18, 0, 8);
    skinGrad.addColorStop(0, '#ffe0b2');
    skinGrad.addColorStop(1, '#ffcc80');
    ctx.fillStyle = skinGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();

    // Cap / Headband
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(0, -4, 15.5, Math.PI, Math.PI * 2);
    ctx.lineTo(18, -6);
    ctx.lineTo(0, -4);
    ctx.fill();

    // Cap visor
    ctx.fillStyle = '#00b0ff';
    ctx.fillRect(4, -8, 14, 4);

    // Eyes
    if (dizzy) {
      // X X eyes
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      // Left eye X
      ctx.moveTo(3, -2); ctx.lineTo(9, 4);
      ctx.moveTo(9, -2); ctx.lineTo(3, 4);
      ctx.stroke();
    } else if (this.isBlinking || squint) {
      // Squint / Closed eye line
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(4, 1);
      ctx.lineTo(11, 1);
      ctx.stroke();
    } else {
      // Open animated eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(7, 0, 4.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupil looking forward
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(8.5, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Catchlight sparkle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(9.5, -1.5, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mouth
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (dizzy) {
      // Wavy mouth
      ctx.moveTo(4, 8);
      ctx.lineTo(7, 6);
      ctx.lineTo(10, 8);
    } else {
      // Confident smile
      ctx.arc(7, 4, 4, 0.2, Math.PI * 0.7);
    }
    ctx.stroke();

    ctx.restore();
  }

  drawTorso(ctx, tx, ty) {
    ctx.save();
    ctx.translate(tx, ty);

    // Sporty hoodie / jacket
    const jacketGrad = ctx.createLinearGradient(-10, 0, 10, 24);
    jacketGrad.addColorStop(0, '#00e5ff');
    jacketGrad.addColorStop(1, '#0088cc');
    ctx.fillStyle = jacketGrad;

    // Rounded jacket body
    ctx.beginPath();
    ctx.roundRect(-12, 0, 24, 25, 6);
    ctx.fill();

    // Center zip line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(0, 24);
    ctx.stroke();

    // Belt / waistband
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-12, 22, 24, 4);

    ctx.restore();
  }

  drawLimb(ctx, startX, startY, length, angle, sleeveColor, handColor, isBack) {
    ctx.save();
    ctx.translate(startX, startY);
    ctx.rotate(angle);

    // Arm sleeve
    ctx.strokeStyle = sleeveColor;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, length * 0.65);
    ctx.stroke();

    // Forearm / Glove
    ctx.strokeStyle = handColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, length * 0.65);
    ctx.lineTo(0, length);
    ctx.stroke();

    // Hand fist
    ctx.fillStyle = '#ffcc80';
    ctx.beginPath();
    ctx.arc(0, length + 2, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawLeg(ctx, startX, startY, length, angle, pantsColor, shoeColor) {
    ctx.save();
    ctx.translate(startX, startY);
    ctx.rotate(angle);

    // Pants upper leg
    ctx.strokeStyle = pantsColor;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, length * 0.6);
    ctx.stroke();

    // Lower leg
    ctx.strokeStyle = pantsColor;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(0, length * 0.6);
    ctx.lineTo(0, length);
    ctx.stroke();

    // Sneaker
    ctx.save();
    ctx.translate(0, length);
    // Shoe body
    ctx.fillStyle = shoeColor;
    ctx.beginPath();
    ctx.roundRect(-4, -1, 14, 8, 3);
    ctx.fill();

    // Shoe rubber sole (white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-4, 6, 15, 3);

    // Accent line
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(0, 2, 8, 2);
    ctx.restore();

    ctx.restore();
  }

  drawPowerupAuras(ctx) {
    const cx = this.x + this.width / 2;
    const cy = this.y - this.height / 2;

    // Hyper Speed Motion Trails
    if (this.hasPowerup('speed')) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ff5722';
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(cx - i * 22, cy, 32 - i * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Magnet Waves
    if (this.hasPowerup('magnet')) {
      ctx.save();
      const wave = (Date.now() / 300) % 1;
      ctx.strokeStyle = '#e040fb';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - wave;
      ctx.beginPath();
      ctx.arc(cx, cy, 35 + wave * 45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2X Multiplier Golden Glow
    if (this.hasPowerup('multiplier')) {
      ctx.save();
      ctx.shadowColor = '#ffc400';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#ffc400';
      ctx.font = '900 18px "JetBrains Mono", monospace';
      ctx.fillText('2X', cx - 12, this.y - this.height - 18);
      ctx.restore();
    }
  }

  drawShieldBubble(ctx) {
    const cx = this.x + this.width / 2;
    const cy = this.y - (this.isSliding ? 25 : this.height / 2);
    const radius = this.isSliding ? 42 : 55;
    const pulse = Math.sin(Date.now() / 150) * 3;

    ctx.save();
    // Shield glow ring
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 15;
    ctx.globalAlpha = 0.85;

    ctx.beginPath();
    ctx.arc(cx, cy, radius + pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Translucent shield fill
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius);
    grad.addColorStop(0, 'rgba(0, 229, 255, 0.05)');
    grad.addColorStop(1, 'rgba(0, 229, 255, 0.3)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + pulse, 0, Math.PI * 2);
    ctx.fill();

    // Shield energy arcs
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const rot = Date.now() / 400;
    ctx.arc(cx, cy, radius - 4, rot, rot + Math.PI * 0.6);
    ctx.stroke();

    ctx.restore();
  }
}

/* ==========================================================================
   6. OBSTACLES (Ground Rocks, Hurdles, Brambles, Drones & Laser Barriers)
   ========================================================================== */
class Obstacle {
  constructor(type, x, y, width, height) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.requiresSlide = false;
    this.cleared = false;
  }

  update(dt, speed) {
    this.x -= speed * dt;
    return this.x + this.width > -50;
  }

  getHitbox() {
    // Generous, fair bounding box slightly smaller than visuals
    return {
      x: this.x + 4,
      y: this.y + 4,
      width: this.width - 8,
      height: this.height - 8
    };
  }

  draw(ctx) {
    // Abstract base - overridden by subclasses
  }
}

class RockObstacle extends Obstacle {
  constructor(x) {
    super('rock', x, CONFIG.GROUND_Y - 50, 55, 50);
  }

  draw(ctx) {
    ctx.save();
    // Mossy Rock
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(this.x + 8, CONFIG.GROUND_Y);
    ctx.lineTo(this.x, CONFIG.GROUND_Y - 25);
    ctx.lineTo(this.x + 18, CONFIG.GROUND_Y - 48);
    ctx.lineTo(this.x + 38, CONFIG.GROUND_Y - 46);
    ctx.lineTo(this.x + 54, CONFIG.GROUND_Y - 20);
    ctx.lineTo(this.x + 50, CONFIG.GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // Shading facets
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(this.x + 18, CONFIG.GROUND_Y - 48);
    ctx.lineTo(this.x + 38, CONFIG.GROUND_Y - 46);
    ctx.lineTo(this.x + 30, CONFIG.GROUND_Y - 15);
    ctx.lineTo(this.x + 12, CONFIG.GROUND_Y - 20);
    ctx.closePath();
    ctx.fill();

    // Moss top cap
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(this.x + 14, CONFIG.GROUND_Y - 44);
    ctx.lineTo(this.x + 24, CONFIG.GROUND_Y - 50);
    ctx.lineTo(this.x + 38, CONFIG.GROUND_Y - 46);
    ctx.lineTo(this.x + 32, CONFIG.GROUND_Y - 38);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

class HurdleObstacle extends Obstacle {
  constructor(x) {
    super('hurdle', x, CONFIG.GROUND_Y - 58, 48, 58);
  }

  draw(ctx) {
    ctx.save();
    // Warning hurdle posts
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(this.x + 4, CONFIG.GROUND_Y - 58, 8, 58);
    ctx.fillRect(this.x + this.width - 12, CONFIG.GROUND_Y - 58, 8, 58);

    // Crossbar with diagonal hazard stripes
    const barY = CONFIG.GROUND_Y - 52;
    const barHeight = 22;
    ctx.fillStyle = '#ffc400';
    ctx.fillRect(this.x, barY, this.width, barHeight);

    // Black hazard stripes
    ctx.fillStyle = '#0f172a';
    for (let bx = this.x + 4; bx < this.x + this.width; bx += 14) {
      ctx.beginPath();
      ctx.moveTo(bx, barY + barHeight);
      ctx.lineTo(bx + 8, barY);
      ctx.lineTo(bx + 14, barY);
      ctx.lineTo(bx + 6, barY + barHeight);
      ctx.closePath();
      ctx.fill();
    }

    // Top blinking hazard light
    ctx.fillStyle = (Math.floor(Date.now() / 200) % 2 === 0) ? '#ff1744' : '#b71c1c';
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, barY - 4, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

class BrambleObstacle extends Obstacle {
  constructor(x) {
    super('bramble', x, CONFIG.GROUND_Y - 42, 60, 42);
  }

  draw(ctx) {
    ctx.save();
    // Sharp neon spikes
    ctx.fillStyle = '#ff0055';
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 8;

    const spikes = 4;
    const sWidth = this.width / spikes;
    for (let i = 0; i < spikes; i++) {
      const sx = this.x + i * sWidth;
      const sh = (i % 2 === 0) ? this.height : this.height * 0.75;
      ctx.beginPath();
      ctx.moveTo(sx, CONFIG.GROUND_Y);
      ctx.lineTo(sx + sWidth / 2, CONFIG.GROUND_Y - sh);
      ctx.lineTo(sx + sWidth, CONFIG.GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

class DroneObstacle extends Obstacle {
  constructor(x) {
    // High obstacle: Requires Slide under!
    // Drone flies at head-height (GROUND_Y - 95 to GROUND_Y - 48)
    super('drone', x, CONFIG.GROUND_Y - 96, 52, 46);
    this.requiresSlide = true;
    this.bobOffset = Math.random() * Math.PI * 2;
  }

  update(dt, speed) {
    this.bobOffset += dt * 5;
    this.y = CONFIG.GROUND_Y - 96 + Math.sin(this.bobOffset) * 6;
    return super.update(dt, speed);
  }

  draw(ctx) {
    ctx.save();
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    // Propellers spinning
    const propWidth = Math.sin(Date.now() / 25) * 20;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 16 - propWidth, cy - 14);
    ctx.lineTo(cx - 16 + propWidth, cy - 14);
    ctx.moveTo(cx + 16 - propWidth, cy - 14);
    ctx.lineTo(cx + 16 + propWidth, cy - 14);
    ctx.stroke();

    // Drone body
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(this.x + 6, cy - 10, this.width - 12, 20, 6);
    ctx.fill();

    // Glowing Red Eye / Scanner
    ctx.fillStyle = '#ff1744';
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();

    // Downward warning laser beam hint
    ctx.strokeStyle = 'rgba(255, 23, 68, 0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy + 10);
    ctx.lineTo(cx, CONFIG.GROUND_Y);
    ctx.stroke();

    ctx.restore();
  }
}

class LaserBarrierObstacle extends Obstacle {
  constructor(x) {
    // Overhead laser beam requiring slide underneath!
    super('laser', x, CONFIG.GROUND_Y - 110, 56, 68);
    this.requiresSlide = true;
  }

  draw(ctx) {
    ctx.save();
    // Suspended industrial brackets
    ctx.fillStyle = '#334155';
    ctx.fillRect(this.x + 8, this.y, 14, 20);
    ctx.fillRect(this.x + this.width - 22, this.y, 14, 20);

    // Glowing energetic laser beam
    const beamY = this.y + 26;
    const beamHeight = 18;

    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 16;
    ctx.fillRect(this.x, beamY, this.width, beamHeight);

    // Inner bright laser core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.x, beamY + 5, this.width, 8);

    // "SLIDE" warning icon below
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('▼ DUCK ▼', this.x + this.width / 2, this.y + 60);

    ctx.restore();
  }
}

class TallBarrierObstacle extends Obstacle {
  constructor(x) {
    // Tall ground obstacle that requires a high or double jump!
    super('tall', x, CONFIG.GROUND_Y - 82, 42, 82);
  }

  draw(ctx) {
    ctx.save();
    // Monolithic reinforced cyber barricade
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Glowing energy bands
    ctx.fillStyle = '#ff2a85';
    ctx.shadowColor = '#ff2a85';
    ctx.shadowBlur = 10;
    ctx.fillRect(this.x + 6, this.y + 12, this.width - 12, 6);
    ctx.fillRect(this.x + 6, this.y + 38, this.width - 12, 6);
    ctx.fillRect(this.x + 6, this.y + 64, this.width - 12, 6);

    ctx.restore();
  }
}

/* ==========================================================================
   7. COLLECTIBLES: COINS & POWER-UPS
   ========================================================================== */
class Coin {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 14;
    this.collected = false;
    this.spinAngle = Math.random() * Math.PI * 2;
    this.floatTimer = Math.random() * Math.PI * 2;
    this.baseY = y;
  }

  update(dt, speed, player) {
    this.x -= speed * dt;
    this.spinAngle += dt * 6;
    this.floatTimer += dt * 4;
    this.y = this.baseY + Math.sin(this.floatTimer) * 4;

    // Coin Magnet Attraction
    if (player.hasPowerup('magnet') && !this.collected) {
      const dx = (player.x + player.width / 2) - this.x;
      const dy = (player.y - player.height / 2) - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 420) {
        const pullSpeed = 520 * (1 - dist / 500) + 180;
        this.x += (dx / dist) * pullSpeed * dt;
        this.y += (dy / dist) * pullSpeed * dt;
        this.baseY = this.y;
      }
    }

    return this.x + this.radius > -30;
  }

  getHitbox() {
    return {
      x: this.x - this.radius,
      y: this.y - this.radius,
      width: this.radius * 2,
      height: this.radius * 2
    };
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // 3D spinning coin width scale
    const scaleX = Math.cos(this.spinAngle);

    // Outer Glow
    ctx.shadowColor = '#ffc400';
    ctx.shadowBlur = 10;

    // Golden Coin Rim
    const coinGrad = ctx.createLinearGradient(-this.radius * scaleX, 0, this.radius * scaleX, 0);
    coinGrad.addColorStop(0, '#ff9100');
    coinGrad.addColorStop(0.5, '#fff176');
    coinGrad.addColorStop(1, '#ff8f00');

    ctx.fillStyle = coinGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.abs(this.radius * scaleX), this.radius, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner Coin Diamond
    if (Math.abs(scaleX) > 0.3) {
      ctx.fillStyle = '#ff8f00';
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.abs(this.radius * scaleX * 0.6), this.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shiny reflection highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(scaleX * 3, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

class PowerUpItem {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = 20;
    this.collected = false;
    this.pulseTimer = 0;
  }

  update(dt, speed) {
    this.x -= speed * dt;
    this.pulseTimer += dt * 4;
    return this.x + this.radius > -40;
  }

  getHitbox() {
    return {
      x: this.x - this.radius,
      y: this.y - this.radius,
      width: this.radius * 2,
      height: this.radius * 2
    };
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const pulse = Math.sin(this.pulseTimer) * 3;

    // Glowing boundary
    ctx.shadowColor = this.type.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(18, 22, 38, 0.9)';
    ctx.strokeStyle = this.type.color;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, this.radius + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Icon in center
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.type.icon, 0, 1);

    ctx.restore();
  }
}

/* ==========================================================================
   8. PROCEDURAL SPAWNER (Fair, Balanced, Speed-Adaptive)
   ========================================================================== */
class Spawner {
  constructor() {
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.spawnTimer = 0;
    this.nextSpawnDistance = 750;
    this.distanceSinceLastSpawn = 0;
    this.lastObstacleType = null;
    this.powerupCooldown = 15; // seconds
  }

  reset() {
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.spawnTimer = 0;
    this.distanceSinceLastSpawn = 0;
    this.nextSpawnDistance = 650;
    this.lastObstacleType = null;
    this.powerupCooldown = 12;
  }

  update(dt, gameSpeed, player, particles, audio) {
    // 1. Update existing obstacles
    this.obstacles = this.obstacles.filter(obs => obs.update(dt, gameSpeed));

    // 2. Update existing coins
    this.coins = this.coins.filter(coin => {
      const active = coin.update(dt, gameSpeed, player);
      return active && !coin.collected;
    });

    // 3. Update powerup items
    this.powerups = this.powerups.filter(p => {
      const active = p.update(dt, gameSpeed);
      return active && !p.collected;
    });

    // 4. Procedural Spawning Logic
    const moved = gameSpeed * dt;
    this.distanceSinceLastSpawn += moved;
    this.powerupCooldown -= dt;

    if (this.distanceSinceLastSpawn >= this.nextSpawnDistance) {
      this.distanceSinceLastSpawn = 0;
      this.spawnPattern(gameSpeed);
    }
  }

  spawnPattern(gameSpeed) {
    const spawnX = CONFIG.CANVAS_WIDTH + 60;
    
    // Calculate fair spacing based on speed
    // Speed: 420 -> gap ~650px; Speed: 800 -> gap ~950px
    const minReactionTime = 1.15; // minimum seconds between obstacles
    this.nextSpawnDistance = Math.max(580, gameSpeed * minReactionTime + Math.random() * 250);

    // Pick obstacle type fairly
    const rand = Math.random();
    let obstacle = null;

    if (rand < 0.28) {
      obstacle = new RockObstacle(spawnX);
      this.spawnCoinArc(spawnX, CONFIG.GROUND_Y - 75, 4); // Coin arc over rock!
    } else if (rand < 0.52) {
      obstacle = new HurdleObstacle(spawnX);
      this.spawnCoinArc(spawnX, CONFIG.GROUND_Y - 90, 5);
    } else if (rand < 0.72) {
      // Air obstacle requiring slide
      obstacle = (Math.random() > 0.5) ? new DroneObstacle(spawnX) : new LaserBarrierObstacle(spawnX);
      // Coins low on ground to reward sliding underneath!
      this.spawnCoinRow(spawnX - 30, CONFIG.GROUND_Y - 20, 4);
    } else if (rand < 0.88) {
      obstacle = new BrambleObstacle(spawnX);
      this.spawnCoinArc(spawnX, CONFIG.GROUND_Y - 80, 4);
    } else {
      // Tall barrier (double jump required)
      obstacle = new TallBarrierObstacle(spawnX);
      this.spawnCoinArc(spawnX, CONFIG.GROUND_Y - 130, 5);
    }

    if (obstacle) {
      this.obstacles.push(obstacle);
      this.lastObstacleType = obstacle.type;
    }

    // Chance to spawn a floating Power-Up
    if (this.powerupCooldown <= 0 && Math.random() < 0.35) {
      this.powerupCooldown = Math.random() * 18 + 14;
      this.spawnRandomPowerUp(spawnX + 320);
    }
  }

  spawnCoinRow(startX, y, count = 4, step = 38) {
    for (let i = 0; i < count; i++) {
      this.coins.push(new Coin(startX + i * step, y));
    }
  }

  spawnCoinArc(centerX, peakY, count = 5) {
    const width = 180;
    const startX = centerX - width / 2;
    const step = width / (count - 1);

    for (let i = 0; i < count; i++) {
      const progress = i / (count - 1);
      // Parabolic jump arc curve: 4 * h * p * (1 - p)
      const arcY = (CONFIG.GROUND_Y - 25) - Math.sin(progress * Math.PI) * (CONFIG.GROUND_Y - 25 - peakY);
      this.coins.push(new Coin(startX + i * step, arcY));
    }
  }

  spawnRandomPowerUp(x) {
    const types = Object.values(POWERUP_TYPES);
    const chosen = types[Math.floor(Math.random() * types.length)];
    // Spawn at jumpable height
    const y = CONFIG.GROUND_Y - Math.random() * 90 - 45;
    this.powerups.push(new PowerUpItem(chosen, x, y));
  }

  draw(ctx) {
    // 1. Draw Obstacles
    for (let obs of this.obstacles) {
      obs.draw(ctx);
    }
    // 2. Draw Coins
    for (let coin of this.coins) {
      coin.draw(ctx);
    }
    // 3. Draw PowerUps
    for (let p of this.powerups) {
      p.draw(ctx);
    }
  }
}

/* ==========================================================================
   9. COLLISION DETECTION & PHYSICS RESOLUTION
   ========================================================================== */
function checkAABBCollision(r1, r2) {
  return (
    r1.x < r2.x + r2.width &&
    r1.x + r1.width > r2.x &&
    r1.y < r2.y + r2.height &&
    r1.y + r1.height > r2.y
  );
}

/* ==========================================================================
   10. MAIN GAME CONTROLLER & STATE MACHINE
   ========================================================================== */
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Core Subsystems
    this.audio = new AudioSynthesizer();
    this.particles = new ParticleManager();
    this.environment = new Environment();
    this.player = new Player();
    this.spawner = new Spawner();

    // Game Variables
    this.state = STATES.MENU;
    this.score = 0;
    this.distance = 0;
    this.coinsCollected = 0;
    this.gameSpeed = CONFIG.BASE_SPEED;
    this.lastTime = 0;
    this.animationId = null;

    // High Score tracking
    this.bestScore = 0;
    this.bestDistance = 0;
    this.isNewHighScore = false;
    this.loadHighScores();

    // Screen Shake effect
    this.shakeDuration = 0;
    this.shakeIntensity = 0;

    // Cache DOM Elements
    this.initDOM();

    // Event Listeners
    this.initEventListeners();

    // Auto-Resize Canvas for sharp HiDPI rendering
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Update Initial UI
    this.updateHUD();
    this.updateMenuStats();

    // Start rendering loop for menu background animation
    this.startLoop();
  }

  initDOM() {
    // Overlays
    this.hud = document.getElementById('hud');
    this.startScreen = document.getElementById('startScreen');
    this.pauseScreen = document.getElementById('pauseScreen');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.powerupBar = document.getElementById('powerupBar');
    this.newHighScoreBanner = document.getElementById('newHighScoreBanner');

    // HUD values
    this.hudDistance = document.getElementById('hudDistance');
    this.hudScore = document.getElementById('hudScore');
    this.hudBestScore = document.getElementById('hudBestScore');
    this.hudCoins = document.getElementById('hudCoins');
    this.hudTierText = document.getElementById('hudTierText');
    this.hudSpeedTier = document.getElementById('hudSpeedTier');
    this.soundIcon = document.getElementById('soundIcon');

    // Menu / Modal values
    this.menuBestScore = document.getElementById('menuBestScore');
    this.menuBestDistance = document.getElementById('menuBestDistance');
    this.pauseCurrentScore = document.getElementById('pauseCurrentScore');
    this.pauseCurrentDistance = document.getElementById('pauseCurrentDistance');
    this.pauseCurrentCoins = document.getElementById('pauseCurrentCoins');
    this.goScore = document.getElementById('goScore');
    this.goDistance = document.getElementById('goDistance');
    this.goCoins = document.getElementById('goCoins');
    this.goBest = document.getElementById('goBest');

    // Buttons
    this.btnStartGame = document.getElementById('btnStartGame');
    this.btnResumeGame = document.getElementById('btnResumeGame');
    this.btnRestartFromPause = document.getElementById('btnRestartFromPause');
    this.btnMenuFromPause = document.getElementById('btnMenuFromPause');
    this.btnPlayAgain = document.getElementById('btnPlayAgain');
    this.btnMenuFromGameOver = document.getElementById('btnMenuFromGameOver');
    this.btnSoundToggle = document.getElementById('btnSoundToggle');
    this.btnPauseGame = document.getElementById('btnPauseGame');

    // Touch Buttons
    this.btnTouchJump = document.getElementById('btnTouchJump');
    this.btnTouchSlide = document.getElementById('btnTouchSlide');
  }

  loadHighScores() {
    try {
      this.bestScore = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.BEST_SCORE) || '0', 10);
      this.bestDistance = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.BEST_DIST) || '0', 10);
    } catch (e) {
      this.bestScore = 0;
      this.bestDistance = 0;
    }
  }

  saveHighScores() {
    try {
      if (this.score > this.bestScore) {
        this.bestScore = Math.floor(this.score);
        localStorage.setItem(CONFIG.STORAGE_KEYS.BEST_SCORE, String(this.bestScore));
      }
      const distInt = Math.floor(this.distance);
      if (distInt > this.bestDistance) {
        this.bestDistance = distInt;
        localStorage.setItem(CONFIG.STORAGE_KEYS.BEST_DIST, String(this.bestDistance));
      }
    } catch (e) {}
  }

  handleResize() {
    // Virtual coordinates: 1280x720 (16:9)
    const baseW = CONFIG.CANVAS_WIDTH;
    const baseH = CONFIG.CANVAS_HEIGHT;
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;

    const scale = Math.min(windowW / baseW, windowH / baseH);
    const displayW = Math.round(baseW * scale);
    const displayH = Math.round(baseH * scale);

    this.canvas.style.width = `${displayW}px`;
    this.canvas.style.height = `${displayH}px`;

    // HiDPI crisp pixel ratio support
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = baseW * dpr;
    this.canvas.height = baseH * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  initEventListeners() {
    // 1. Keyboard Controls
    window.addEventListener('keydown', (e) => {
      // Prevent browser scrolling on Space/Arrows
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
      }

      this.audio.resume();

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (this.state === STATES.PLAYING) {
          this.player.jump(this.audio, this.particles);
        } else if (this.state === STATES.MENU) {
          this.startGame();
        }
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        if (this.state === STATES.PLAYING) {
          this.player.slide(this.audio, this.particles);
        }
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === STATES.PLAYING) {
          this.pauseGame();
        } else if (this.state === STATES.PAUSED) {
          this.resumeGame();
        }
      } else if (e.code === 'KeyM') {
        this.toggleSound();
      }
    });

    // 2. Mobile Touch Swipes & Gestures on Canvas
    let touchStartY = 0;
    let touchStartX = 0;

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.audio.resume();
      if (e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (this.state === STATES.PLAYING && e.changedTouches.length > 0) {
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        const deltaX = e.changedTouches[0].clientX - touchStartX;

        // Detect swipe vs tap
        if (deltaY < -35) {
          // Swipe Up -> Jump
          this.player.jump(this.audio, this.particles);
        } else if (deltaY > 35) {
          // Swipe Down -> Slide
          this.player.slide(this.audio, this.particles);
        } else if (Math.abs(deltaX) < 25 && Math.abs(deltaY) < 25) {
          // Quick Tap -> Jump
          this.player.jump(this.audio, this.particles);
        }
      }
    }, { passive: false });

    // 3. UI Buttons
    this.btnStartGame.addEventListener('click', () => {
      this.audio.resume();
      this.audio.playClick();
      this.startGame();
    });

    this.btnResumeGame.addEventListener('click', () => {
      this.audio.playClick();
      this.resumeGame();
    });

    this.btnRestartFromPause.addEventListener('click', () => {
      this.audio.playClick();
      this.startGame();
    });

    this.btnMenuFromPause.addEventListener('click', () => {
      this.audio.playClick();
      this.showMenu();
    });

    this.btnPlayAgain.addEventListener('click', () => {
      this.audio.playClick();
      this.startGame();
    });

    this.btnMenuFromGameOver.addEventListener('click', () => {
      this.audio.playClick();
      this.showMenu();
    });

    this.btnPauseGame.addEventListener('click', () => {
      this.audio.playClick();
      if (this.state === STATES.PLAYING) {
        this.pauseGame();
      }
    });

    this.btnSoundToggle.addEventListener('click', () => {
      this.toggleSound();
    });

    // 4. On-Screen Virtual Touch Buttons
    this.btnTouchJump.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.audio.resume();
      if (this.state === STATES.PLAYING) {
        this.player.jump(this.audio, this.particles);
      }
    });

    this.btnTouchSlide.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.audio.resume();
      if (this.state === STATES.PLAYING) {
        this.player.slide(this.audio, this.particles);
      }
    });
  }

  toggleSound() {
    const isEnabled = this.audio.toggle();
    this.soundIcon.textContent = isEnabled ? '🔊' : '🔇';
    this.btnSoundToggle.setAttribute('title', isEnabled ? 'Sound Enabled' : 'Sound Muted');
  }

  triggerScreenShake(duration = 0.25, intensity = 12) {
    this.shakeDuration = duration;
    this.shakeIntensity = intensity;
  }

  startGame() {
    this.state = STATES.PLAYING;
    this.score = 0;
    this.distance = 0;
    this.coinsCollected = 0;
    this.gameSpeed = CONFIG.BASE_SPEED;
    this.isNewHighScore = false;

    // Reset systems
    this.player.reset();
    this.spawner.reset();
    this.particles.reset();

    // Hide screen overlays
    this.startScreen.classList.remove('active');
    this.startScreen.hidden = true;
    this.pauseScreen.classList.remove('active');
    this.pauseScreen.hidden = true;
    this.gameOverScreen.classList.remove('active');
    this.gameOverScreen.hidden = true;
    this.newHighScoreBanner.hidden = true;

    this.updateHUD();
  }

  pauseGame() {
    if (this.state !== STATES.PLAYING) return;
    this.state = STATES.PAUSED;

    // Update pause dialog stats
    this.pauseCurrentScore.textContent = Math.floor(this.score).toLocaleString();
    this.pauseCurrentDistance.textContent = `${Math.floor(this.distance).toLocaleString()} m`;
    this.pauseCurrentCoins.textContent = this.coinsCollected.toLocaleString();

    this.pauseScreen.hidden = false;
    this.pauseScreen.classList.add('active');
  }

  resumeGame() {
    if (this.state !== STATES.PAUSED) return;
    this.state = STATES.PLAYING;
    this.pauseScreen.classList.remove('active');
    this.pauseScreen.hidden = true;
    this.lastTime = performance.now();
  }

  showMenu() {
    this.state = STATES.MENU;
    this.startScreen.hidden = false;
    this.startScreen.classList.add('active');
    this.pauseScreen.classList.remove('active');
    this.pauseScreen.hidden = true;
    this.gameOverScreen.classList.remove('active');
    this.gameOverScreen.hidden = true;

    this.player.reset();
    this.spawner.reset();
    this.updateMenuStats();
  }

  gameOver() {
    this.state = STATES.GAME_OVER;
    this.player.isGameOver = true;
    this.audio.playGameOver();
    this.triggerScreenShake(0.5, 18);

    // Check if new record
    if (this.score > this.bestScore && this.score > 0) {
      this.isNewHighScore = true;
      this.audio.playNewHighScore();
      this.particles.emitConfetti();
    }

    this.saveHighScores();

    // Populate Game Over Screen
    this.goScore.textContent = Math.floor(this.score).toLocaleString();
    this.goDistance.textContent = `${Math.floor(this.distance).toLocaleString()} m`;
    this.goCoins.textContent = this.coinsCollected.toLocaleString();
    this.goBest.textContent = this.bestScore.toLocaleString();

    if (this.isNewHighScore) {
      this.newHighScoreBanner.hidden = false;
    } else {
      this.newHighScoreBanner.hidden = true;
    }

    // Show Game Over Modal
    setTimeout(() => {
      this.gameOverScreen.hidden = false;
      this.gameOverScreen.classList.add('active');
    }, 450);
  }

  update(dt) {
    // 1. Screen Shake Countdown
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
    }

    // 2. State-specific Updates
    if (this.state === STATES.PLAYING) {
      // Dynamic Speed Boost / Slow Motion multipliers
      let speedMult = 1.0;
      if (this.player.hasPowerup('speed')) speedMult = 1.45;
      if (this.player.hasPowerup('slowmo')) speedMult = 0.55;

      // Increase base speed with distance/time
      this.gameSpeed = Math.min(CONFIG.MAX_SPEED, this.gameSpeed + CONFIG.SPEED_ACCEL * dt);
      const effectiveSpeed = this.gameSpeed * speedMult;

      // Distance and Score progression
      const distIncrement = (effectiveSpeed * dt) / 10;
      this.distance += distIncrement;

      // Score = distance + coin bonuses
      let scoreRate = 12 * (this.player.hasPowerup('multiplier') ? 2 : 1);
      this.score += distIncrement * scoreRate;

      // Subsystems Update
      this.environment.update(dt, effectiveSpeed);
      this.player.update(dt, effectiveSpeed, this.audio, this.particles);
      this.spawner.update(dt, effectiveSpeed, this.player, this.particles, this.audio);
      this.particles.update(dt);

      // Check Collisions
      this.handleCollisions();

      // Update HUD
      this.updateHUD();
      this.updatePowerupHUD();

    } else if (this.state === STATES.MENU) {
      // Background gently scrolls on start menu
      this.environment.update(dt, CONFIG.BASE_SPEED * 0.6);
      this.player.update(dt, CONFIG.BASE_SPEED * 0.6, this.audio, this.particles);
      this.particles.update(dt);
    } else if (this.state === STATES.GAME_OVER) {
      this.particles.update(dt);
    }
  }

  handleCollisions() {
    const playerBox = this.player.getHitbox();

    // 1. Check Coin Pickups
    for (let coin of this.spawner.coins) {
      if (!coin.collected && checkAABBCollision(playerBox, coin.getHitbox())) {
        coin.collected = true;
        this.coinsCollected++;
        const val = CONFIG.COIN_BASE_VALUE * (this.player.hasPowerup('multiplier') ? 2 : 1);
        this.score += val;
        this.audio.playCoin();
        this.particles.emitCoinBurst(coin.x, coin.y);
        this.particles.addText(`+${val}`, coin.x, coin.y - 12, '#ffc400', 20);
      }
    }

    // 2. Check Power-Up Pickups
    for (let p of this.spawner.powerups) {
      if (!p.collected && checkAABBCollision(playerBox, p.getHitbox())) {
        p.collected = true;
        this.player.applyPowerup(p.type, this.audio, this.particles);
      }
    }

    // 3. Check Obstacle Lethal Collisions
    for (let obs of this.spawner.obstacles) {
      const obsBox = obs.getHitbox();

      if (checkAABBCollision(playerBox, obsBox)) {
        // Did the player have Hyper Dash (Speed Boost invincibility)?
        if (this.player.hasPowerup('speed')) {
          // Smash obstacle aside without dying!
          this.audio.playHit();
          this.particles.emitCollision(obs.x + obs.width / 2, obs.y + obs.height / 2);
          obs.x = -200; // remove
          continue;
        }

        // Did the player have an active Shield?
        if (this.player.hasPowerup('shield')) {
          this.player.activePowerups.delete('shield');
          this.player.isHit = true;
          this.player.hitTimer = 0.5;
          this.audio.playShieldBreak();
          this.particles.emitShieldDeflect(this.player.x + this.player.width / 2, this.player.y - 30);
          this.triggerScreenShake(0.2, 10);
          obs.x = -200; // deflect obstacle
          continue;
        }

        // Direct fatal collision!
        this.particles.emitCollision(this.player.x + this.player.width / 2, this.player.y - 30);
        this.gameOver();
        break;
      }
    }
  }

  updateHUD() {
    this.hudDistance.textContent = `${Math.floor(this.distance).toLocaleString()} m`;
    this.hudScore.textContent = Math.floor(this.score).toLocaleString();
    this.hudBestScore.textContent = Math.max(this.bestScore, Math.floor(this.score)).toLocaleString();
    this.hudCoins.textContent = this.coinsCollected.toLocaleString();

    // Difficulty Tier Pill Indicator
    const dist = this.distance;
    this.hudSpeedTier.className = 'hud-pill';
    if (dist < 500) {
      this.hudSpeedTier.classList.add('tier-easy');
      this.hudTierText.textContent = 'EASY';
    } else if (dist < 1500) {
      this.hudSpeedTier.classList.add('tier-normal');
      this.hudTierText.textContent = 'NORMAL';
    } else if (dist < 3000) {
      this.hudSpeedTier.classList.add('tier-hard');
      this.hudTierText.textContent = 'HARD';
    } else {
      this.hudSpeedTier.classList.add('tier-extreme');
      this.hudTierText.textContent = 'EXTREME';
    }
  }

  updatePowerupHUD() {
    this.powerupBar.innerHTML = '';
    for (const [id, p] of this.player.activePowerups.entries()) {
      const pct = Math.max(0, Math.min(100, (p.timeLeft / p.duration) * 100));

      const item = document.createElement('div');
      item.className = `powerup-item ${id}`;
      item.innerHTML = `
        <div class="powerup-icon-wrap">${p.type.icon}</div>
        <div class="powerup-info">
          <div class="powerup-title-row">
            <span>${p.type.name}</span>
            <span>${Math.ceil(p.timeLeft)}s</span>
          </div>
          <div class="powerup-meter-bg">
            <div class="powerup-meter-fill" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
      this.powerupBar.appendChild(item);
    }
  }

  updateMenuStats() {
    this.menuBestScore.textContent = this.bestScore.toLocaleString();
    this.menuBestDistance.textContent = `${this.bestDistance.toLocaleString()} m`;
  }

  render() {
    this.ctx.save();

    // Screen Shake Offset
    if (this.shakeDuration > 0) {
      const currentIntensity = this.shakeIntensity * (this.shakeDuration / 0.35);
      const shakeX = (Math.random() * 2 - 1) * currentIntensity;
      const shakeY = (Math.random() * 2 - 1) * currentIntensity;
      this.ctx.translate(shakeX, shakeY);
    }

    // 1. Draw Background Parallax & Day/Night Cycle
    this.environment.draw(this.ctx);

    // 2. Draw Obstacles, Coins & Powerups
    this.spawner.draw(this.ctx);

    // 3. Draw Player
    this.player.draw(this.ctx);

    // 4. Draw Particles & Popups
    this.particles.draw(this.ctx);

    this.ctx.restore();
  }

  startLoop() {
    this.lastTime = performance.now();
    const frame = (timestamp) => {
      const rawDt = (timestamp - this.lastTime) / 1000;
      this.lastTime = timestamp;
      // Clamp delta time to avoid large physics steps when switching tabs
      const dt = Math.min(0.06, Math.max(0.001, rawDt));

      if (this.state !== STATES.PAUSED) {
        this.update(dt);
      }
      this.render();

      this.animationId = requestAnimationFrame(frame);
    };

    this.animationId = requestAnimationFrame(frame);
  }
}

/* ==========================================================================
   11. INITIALIZATION ON DOM READY
   ========================================================================== */
window.addEventListener('DOMContentLoaded', () => {
  // Instantiate Game
  window.gameInstance = new Game();
});
