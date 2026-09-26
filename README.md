# 🏃 Cyber Horizon — 2D Endless Runner Game

<p align="center">
  <a href="https://meek-semolina-e2eab1.netlify.app" target="_blank">
    <img src="https://img.shields.io/badge/PLAY_ONLINE-00E5FF?style=for-the-badge&logo=netlify&logoColor=black" alt="Play Online Live Demo" />
  </a>
  <img src="https://img.shields.io/badge/HTML5-Canvas-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5 Canvas" />
  <img src="https://img.shields.io/badge/CSS3-Glassmorphism-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/JavaScript-Vanilla%20ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="Vanilla JS" />
  <img src="https://img.shields.io/badge/Web%20Audio-Procedural%20Synth-9cf?style=for-the-badge" alt="Web Audio API" />
  <img src="https://img.shields.io/badge/Zero-Dependencies-success?style=for-the-badge" alt="Zero Dependencies" />
</p>

> 🎮 **Live Demo:** [https://meek-semolina-e2eab1.netlify.app](https://meek-semolina-e2eab1.netlify.app)

A polished, high-performance **2D Endless Runner browser game** built entirely from scratch with **HTML5 Canvas, CSS3, and vanilla JavaScript**.

Features an articulated animated runner, multi-layer parallax scrolling with a dynamic Day/Night cycle, fair procedural obstacle generation, 5 unique power-ups, a custom Web Audio synthesizer, and responsive touch controls for Desktop, iPhone, and Android.

---

## 🎮 Live Gameplay & Highlights

* **Articulated Kinematic Runner**: Hand-crafted character with rhythmic arm/leg swings, head bob, torso lean, blinking expressive eyes, aerodynamic flips on double jump, low-slide poses, and reactive ground shadows.
* **Dynamic Day/Night Cycle**: Continuously transitions through **Day ☀️**, **Golden Sunset 🌅**, **Starry Night 🌙** (with 70 twinkling stars and cratered moon), and **Dawn 🌄**.
* **5-Layer Parallax Scrolling**: Sky $\rightarrow$ Distant snowy mountain peaks $\rightarrow$ Rolling pine hills $\rightarrow$ Near foliage & fences $\rightarrow$ Neon roadway track with foreground grass blades.
* **Procedural Fair Spawning**: Speed-adaptive hazard generation that guarantees balanced reaction windows and prevents impossible obstacle clusters.
* **Web Audio Sound Synthesizer**: 100% procedural retro-modern sound effects using browser oscillators, noise buffers, and biquad filters. **Zero external MP3/WAV files required** (no broken audio links, zero network latency).
* **Multi-Device Support**: Optimized for Desktop (Keyboard), iPhone, and Android with on-screen touch buttons and swipe gesture detection.

---

## 🌐 Live Online Demo

Play instantly in your browser on Desktop, iPhone, or Android with zero installation:  
👉 **[https://meek-semolina-e2eab1.netlify.app](https://meek-semolina-e2eab1.netlify.app)**

---

## 🕹️ Controls

### Desktop Keyboard
| Key | Action |
|---|---|
| <kbd>SPACE</kbd> / <kbd>↑</kbd> / <kbd>W</kbd> | **Jump** |
| <kbd>SPACE</kbd> / <kbd>↑</kbd> / <kbd>W</kbd> *(in air)* | **Double Jump** (acrobatic spin) |
| <kbd>↓</kbd> / <kbd>S</kbd> | **Slide Under** (sparks kick up, reduced hitbox) |
| <kbd>P</kbd> / <kbd>ESC</kbd> | **Pause / Resume** |
| <kbd>M</kbd> | **Mute / Unmute Sound** |

### Mobile & Touch Devices (iPhone / Android / Tablets)
* **Jump**: Tap anywhere on canvas, swipe up, or tap the <kbd>⬆ JUMP</kbd> button.
* **Double Jump**: Tap / swipe up again while airborne.
* **Slide**: Swipe down anywhere on canvas or hold the <kbd>⬇ SLIDE</kbd> button.
* **Pause / Audio**: Tap the floating ⏸ and 🔊 buttons in the top-right HUD.

---

## 🛡️ Power-Ups & Collectibles

| Power-Up | Visual Effect | Gameplay Benefit |
|---|---|---|
| **Energy Shield** 🛡️ | Pulsing cyan force field | Absorbs 1 fatal collision with an electric deflection shockwave. |
| **Coin Magnet** 🧲 | Radiating magenta magnetic waves | Attracts all nearby coins within 400px directly to the player. |
| **2X Multiplier** ✨ | Golden aura and floating badge | Doubles all points and coin values for 10 seconds. |
| **Hyper Dash** ⚡ | Flame trails & speed lines | Blistering sprint with complete invulnerability against obstacles. |
| **Time Warp** ⏳ | Chromatic time ripple | Slows world & obstacles by 45% while player stays agile. |
| **Gold Coins** 🪙 | 3D spinning metallic coin | Worth +10 pts (+20 during 2X); spawn in arcs to guide jump timing. |

---

## ⚠️ Obstacle Types

* **Ground Obstacles (Requires Jump)**:
  * 🪨 *Mossy Rock*: Polygonal boulder with shaded facets.
  * 🚧 *Road Hurdle*: Warning barrier with diagonal hazard stripes and flashing red beacon.
  * 🌵 *Neon Bramble Spikes*: Clustered spiky ground hazard.
  * 🏢 *Tall Barricade*: High monolithic cyber barrier (requires well-timed high or double jump).
* **Air Obstacles (Requires Slide)**:
  * 🛸 *Low-Flying Drone*: Hovering drone with spinning rotors and red scanner beam at head height.
  * ⚡ *Overhead Laser Barrier*: Suspended industrial laser beam that must be ducked under.

---

## 📈 Difficulty Tiers

As distance increases, player speed scales gradually while maintaining fair reaction windows:

* **0 – 500 m** $\rightarrow$ `EASY`: Moderate speed (420 px/s), simple hurdles, generous coin trails.
* **500 – 1,500 m** $\rightarrow$ `NORMAL`: Speed ramps up, introduction of air drones and slide barriers.
* **1,500 – 3,000 m** $\rightarrow$ `HARD`: Faster pace, complex combinations, tighter reaction windows.
* **3,000+ m** $\rightarrow$ `EXTREME`: Maximum adrenaline test of reflexes with pulsing glowing badges.

All-time high scores and maximum distance are saved automatically in `localStorage`.

---

## 📁 Project Structure

```text
endless-runner/
│
├── index.html        # Semantic HTML5 markup, HUD, modals, iOS PWA meta tags
├── style.css         # Responsive styles, glassmorphic UI, animations, touch layout
├── script.js         # Complete vanilla JS game engine (Canvas, Audio, Spawner, Physics)
├── server.js         # Zero-dependency Node.js static server for LAN & mobile testing
├── start-server.bat  # 1-click Windows launcher to play on iPhone / Android via Wi-Fi
└── README.md         # Project documentation and guide
```

---

## 🚀 How to Run

### Option 1: Direct Browser Play (Desktop)
Simply double-click **`index.html`** or open it in any modern web browser (Chrome, Edge, Firefox, Safari).

### Option 2: Play on iPhone / Android via Local Wi-Fi
1. Ensure your PC and mobile device are on the **same Wi-Fi network**.
2. Double-click **`start-server.bat`** on your PC.
3. The terminal will display an address such as:
   ```text
   http://192.168.0.xxx:8080
   ```
4. Open **Safari** (iPhone) or **Chrome** (Android), type that address, and play!

#### 📱 Fullscreen PWA Experience (App-Like):
* **iPhone (Safari)**: Tap **Share** $\rightarrow$ **"Add to Home Screen"**.
* **Android (Chrome)**: Tap **Menu (⋮)** $\rightarrow$ **"Install App"** / **"Add to Home Screen"**.

---

## 🛠️ Architecture & Technical Details

* **Framerate Independence**: Physics and positions are computed using `deltaTime` with delta-clamping, ensuring consistent behavior across 60Hz, 120Hz, and 144Hz monitors.
* **HiDPI / Retina Canvas Rendering**: Virtual coordinate space (1280×720 at 16:9) dynamically scaled using `window.devicePixelRatio` for sharp rendering on high-density screens.
* **Memory Optimization**: In-place filtering and particle pooling bound to a maximum of 250 active particles with automatic cleanup.
* **Cross-Browser Compatibility**: Includes universal Canvas `roundRect` polyfills and safe `localStorage` exception handling.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE). Feel free to fork, customize, and build upon it!
