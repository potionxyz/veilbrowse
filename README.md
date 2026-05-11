# VeilBrowse

Open-source anti-detect browser manager for Linux. Isolated profiles, proxy pools, fingerprint spoofing. Free forever.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Linux-1e1f22.svg)

## What it does

VeilBrowse creates isolated Chrome browser profiles with unique fingerprints. Each profile gets its own:

- **Canvas & WebGL spoofing** — passes BrowserLeaks, CreepJS, and FingerprintJS
- **Hardware fingerprint randomization** — CPU cores, RAM, GPU vendor/renderer
- **Audio & font fingerprint noise** — per-profile seeds
- **WebRTC leak protection** — block local IPs or drop all ICE
- **Proxy integration** — HTTP, HTTPS, SOCKS5 with health checks
- **Geolocation & timezone matching**

Run 50 profiles from one Linux machine. Platforms see 50 different devices.

## Quick start

**Requires:** Ubuntu 22.04+ (or compatible Linux), Google Chrome installed, Node.js 18+

```bash
# Clone
git clone https://github.com/potionxyz/veilbrowse.git
cd veilbrowse

# Install dependencies
npm install

# Start the server
npm run server

# Or run the Electron app
npm start
```

The dashboard opens at `http://localhost:8888`. Create a profile, pick a fingerprint preset, and hit Launch.

## Anti-detection coverage

**23 of 27 vectors masked:**

| Vector | Status |
|--------|--------|
| Canvas 2D | Spoofed |
| WebGL Vendor/Renderer | Spoofed |
| WebRTC | Blocked |
| AudioContext | Seeded |
| Hardware Concurrency | Spoofed |
| Device Memory | Spoofed |
| Client Rects | Noise injected |
| Fonts | Per-OS whitelist |
| Timezone | Spoofed |
| Geolocation | Spoofed |
| User Agent | Spoofed |
| Viewport | Spoofed |
| Language | Spoofed |
| Navigator plugins | Normalized |
| Permissions API | Spoofed |
| Device name | Spoofed |
| Webdriver flag | Removed |
| Chrome runtime | Removed |
| Notification API | Normalized |
| Battery API | Spoofed |
| Screen orientation | Normalized |
| Touch support | Conditional |
| Memory pressure | Normalized |

**4 vectors we can't mask** (kernel-level or proxy-level fixes required):
- TCP/IP TTL (Linux TTL=64 vs Windows TTL=128)
- TLS JA3 signature
- Font pixel glyph shapes (fallback rendering)
- Emoji rendering differences

## Architecture

- **Frontend:** Vanilla HTML/CSS/JS dashboard (no build step)
- **Backend:** Express + SQLite + Server-Sent Events
- **Browser:** Playwright persistent contexts with `addInitScript` anti-detection injection
- **Desktop:** Electron shell wrapping the local server
- **Packaging:** Electron Builder (AppImage for Linux)

## Project structure

```
├── public/              # Frontend (dashboard + landing page)
│   ├── index.html       # Profile management dashboard
│   └── landing.html     # Marketing site
├── server/              # Backend API
│   ├── index.js         # Express app + SSE
│   ├── anti-detect.js   # Fingerprint injection script
│   ├── launcher.js      # Playwright profile launcher
│   ├── db.js            # SQLite connection
│   ├── routes/          # API routes
│   └── migrations/      # Schema migrations
├── electron-main.js     # Electron shell
├── scripts/             # Build & utility scripts
└── site/                # Vercel-deployed landing page
```

## Status

- [x] Profile CRUD with fingerprint presets
- [x] Proxy pool management with health checks
- [x] 23/27 anti-detection vectors passing
- [x] Real-time SSE dashboard
- [x] Screenshot monitoring
- [x] Notes + duplicate profiles
- [x] Dark/light theme
- [ ] Windows & macOS support (planned)
- [ ] Cookie import/export
- [ ] Profile folders/tags
- [ ] REST API documentation
- [ ] Team sharing

## License

MIT License — see [LICENSE](LICENSE) for details.

---

**Linux only.** Windows and macOS packages are planned. [Join the waitlist](https://veilbrowse.dev#waitlist).
