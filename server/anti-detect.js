// Anti-detection script injection for VeilBrowse
// Comprehensive fingerprint spoofing — runs before page scripts execute.

function buildAntiDetectScript(profile) {
  const seed = (profile.canvas_seed !== null && profile.canvas_seed !== undefined)
    ? parseInt(profile.canvas_seed, 10)
    : (parseInt(profile.id, 10) || 1);
  const webrtcPolicy = profile.webrtc_policy || 'block_local_ips';
  const hwConcurrency = (profile.hardware_concurrency !== null && profile.hardware_concurrency !== undefined)
    ? parseInt(profile.hardware_concurrency, 10) : 8;
  const deviceMemory = (profile.device_memory !== null && profile.device_memory !== undefined)
    ? parseInt(profile.device_memory, 10) : 8;
  const webglVendor = profile.webgl_vendor || 'Google Inc. (NVIDIA)';
  const webglRenderer = profile.webgl_renderer || 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)';
  const audioSeed = (profile.audio_seed !== null && profile.audio_seed !== undefined)
    ? parseInt(profile.audio_seed, 10) : (seed + 999);
  const clientRectsNoise = (profile.client_rects_noise !== null && profile.client_rects_noise !== undefined)
    ? parseFloat(profile.client_rects_noise) : 0;

  const ua = profile.user_agent || '';
  const isWindows = ua.includes('Windows');
  const isMac = ua.includes('Macintosh') || ua.includes('Mac OS');
  const isLinux = ua.includes('Linux') && !ua.includes('Android');
  const isAndroid = ua.includes('Android');
  const isIPhone = ua.includes('iPhone');
  const isIPad = ua.includes('iPad');
  const isMobile = isAndroid || isIPhone || isIPad;
  const isDesktop = !isMobile;

  // Helper: make a function whose toString() looks native
  function nativeWrapper(fn, orig) {
    return new Proxy(fn, {
      apply(target, thisArg, args) { return target.apply(thisArg, args); },
      get(target, prop) {
        if (prop === 'toString') return () => orig ? orig.toString() : 'function ' + target.name + '() { [native code] }';
        if (prop === 'length') return (orig && orig.length) || 0;
        if (prop === 'name') return (orig && orig.name) || target.name || '';
        return target[prop];
      }
    });
  }

  const parts = [];

  // ────────────────────────────────────────────────
  // 0. CORE: Delete navigator.webdriver, fix chrome.runtime, notification default
  // ────────────────────────────────────────────────
  parts.push(`
    (() => {
      // navigator.webdriver: delete if possible, else redefine as undefined
      try { delete navigator.webdriver; } catch (e) {}
      try {
        Object.defineProperty(navigator, 'webdriver', {
          get() { return undefined; },
          enumerable: true,
          configurable: true,
        });
      } catch (e) {}
      try {
        Object.defineProperty(Navigator.prototype, 'webdriver', {
          get() { return undefined; },
          enumerable: true,
          configurable: true,
        });
      } catch (e) {}

      // Restore chrome.runtime if missing
      if (!window.chrome) window.chrome = {};
      if (!window.chrome.runtime) {
        window.chrome.runtime = {
          OnInstalledReason: { CHROME_UPDATE: 'chrome_update', SHARED_MODULE_UPDATE: 'shared_module_update', INSTALL: 'install', UPDATE: 'update' },
          OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
          PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', MIPS64EL: 'mips64el', MIPSEL: 'mipsel', X86_32: 'x86-32', X86_64: 'x86-64' },
          PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPSEL: 'mipsel', X86_32: 'x86-32', X86_64: 'x86-64' },
          PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
          RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
          OnConnectEvent: {},
          OnMessageEvent: {},
          sendMessage: function() {},
          onConnect: { addListener: function() {}, removeListener: function() {} },
          onMessage: { addListener: function() {}, removeListener: function() {} },
          getManifest: function() { return {}; },
          getURL: function() { return ''; },
        };
      }

      // Notification.permission should be 'default' on fresh profile
      try {
        Object.defineProperty(Notification, 'permission', {
          get() { return 'default'; },
          configurable: true,
        });
      } catch (e) {}
    })();
  `);

  // ────────────────────────────────────────────────
  // 1. SCREEN & WINDOW DIMENSIONS
  // ────────────────────────────────────────────────
  parts.push(`
    (() => {
      const isWindows = ${isWindows};
      const isMac = ${isMac};
      const isLinux = ${isLinux};
      const isMobile = ${isMobile};
      const isDesktop = ${isDesktop};
      const vw = ${profile.viewport_width || 1920};
      const vh = ${profile.viewport_height || 1080};

      // Chrome UI chrome sizes (approximate, consistent across OS)
      const chromeW = isDesktop ? 16 : 0;   // scrollbar area + borders
      const chromeH = isDesktop ? 85 : 0;   // title bar + address bar + tabs + bookmark bar
      const outerW = vw + chromeW;
      const outerH = vh + chromeH;

      // screen.availHeight: subtract taskbar/dock
      const taskbarH = isWindows ? 40 : (isMac ? 24 : 0);
      const availH = vh - taskbarH;

      // devicePixelRatio
      const dpr = isMobile ? 2 : 1;

      // screen object overrides
      const screenProps = {
        width: vw,
        height: vh,
        availWidth: vw,
        availHeight: Math.max(availH, vh - 40),
        availLeft: 0,
        availTop: 0,
      };
      for (const [key, val] of Object.entries(screenProps)) {
        try {
          Object.defineProperty(screen, key, { get() { return val; }, configurable: true });
        } catch (e) {}
      }

      // window outerWidth/outerHeight must be >= inner
      try {
        Object.defineProperty(window, 'outerWidth', {
          get() { return Math.max(outerW, window.innerWidth); },
          configurable: true,
        });
        Object.defineProperty(window, 'outerHeight', {
          get() { return Math.max(outerH, window.innerHeight); },
          configurable: true,
        });
        Object.defineProperty(window, 'devicePixelRatio', {
          get() { return dpr; },
          configurable: true,
        });
      } catch (e) {}

      // screenX / screenY / screenLeft / screenTop — window position
      try {
        Object.defineProperty(window, 'screenX', { get() { return 0; }, configurable: true });
        Object.defineProperty(window, 'screenY', { get() { return 0; }, configurable: true });
        Object.defineProperty(window, 'screenLeft', { get() { return 0; }, configurable: true });
        Object.defineProperty(window, 'screenTop', { get() { return 0; }, configurable: true });
      } catch (e) {}
    })();
  `);

  // ────────────────────────────────────────────────
  // 2. NAVIGATOR COMPREHENSIVE PROXY
  // ────────────────────────────────────────────────
  parts.push(`
    (() => {
      const isWindows = ${isWindows};
      const isMac = ${isMac};
      const isLinux = ${isLinux};
      const isAndroid = ${isAndroid};
      const isIPhone = ${isIPhone};
      const isIPad = ${isIPad};
      const isMobile = ${isMobile};
      const hwConcurrency = ${hwConcurrency};
      const deviceMemory = ${deviceMemory};
      const ua = ${JSON.stringify(ua)};

      // Platform string
      let platform = 'Win32';
      if (isIPhone) platform = 'iPhone';
      else if (isIPad) platform = 'iPad';
      else if (isMac) platform = 'MacIntel';
      else if (isAndroid) platform = 'Linux armv8l';
      else if (isLinux) platform = 'Linux x86_64';

      // Languages
      const languages = [${JSON.stringify(profile.language || 'en-US')}];
      if (languages[0] !== 'en-US') languages.push('en-US');

      // Max touch points
      const maxTouchPoints = isMobile ? 5 : 0;

      // Product / productSub
      const product = 'Gecko';
      const productSub = '20030107';
      const vendor = 'Google Inc.';

      // doNotTrack
      const doNotTrack = null;

      // oscpu
      const oscpu = isWindows ? 'Windows NT 10.0; Win64; x64' : (isMac ? 'Intel Mac OS X 10.15' : (isLinux ? 'Linux x86_64' : 'Linux armv8l'));

      // Build fake PluginArray
      function makeFakePlugins() {
        const mimePdf = Object.setPrototypeOf({
          type: 'application/x-google-chrome-pdf', suffixes: 'pdf',
          description: 'Portable Document Format', enabledPlugin: null,
        }, MimeType.prototype);
        const mimePdf2 = Object.setPrototypeOf({
          type: 'application/pdf', suffixes: 'pdf',
          description: 'Portable Document Format', enabledPlugin: null,
        }, MimeType.prototype);
        const mimeNacl = Object.setPrototypeOf({
          type: 'application/x-nacl', suffixes: '',
          description: '', enabledPlugin: null,
        }, MimeType.prototype);
        const mimePnacl = Object.setPrototypeOf({
          type: 'application/x-pnacl', suffixes: '',
          description: '', enabledPlugin: null,
        }, MimeType.prototype);

        const pdfPlugin = Object.setPrototypeOf({
          0: mimePdf, 1: mimePdf2,
          length: 2,
          name: 'Chrome PDF Plugin',
          filename: 'internal-pdf-viewer',
          description: 'Portable Document Format',
          item(index) { return this[index] || null; },
          namedItem(name) {
            for (let i = 0; i < this.length; i++) if (this[i] && this[i].type === name) return this[i];
            return null;
          },
        }, Plugin.prototype);

        const pdfViewer = Object.setPrototypeOf({
          length: 0,
          name: 'Chrome PDF Viewer',
          filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
          description: 'Portable Document Format',
          item(index) { return this[index] || null; },
          namedItem(name) { return null; },
        }, Plugin.prototype);

        const naclPlugin = Object.setPrototypeOf({
          0: mimeNacl, 1: mimePnacl,
          length: 2,
          name: 'Native Client',
          filename: 'internal-nacl-plugin',
          description: '',
          item(index) { return this[index] || null; },
          namedItem(name) {
            for (let i = 0; i < this.length; i++) if (this[i] && this[i].type === name) return this[i];
            return null;
          },
        }, Plugin.prototype);

        const pluginArray = Object.setPrototypeOf({
          0: pdfPlugin, 1: pdfViewer, 2: naclPlugin,
          length: 3,
          item(index) { return this[index] || null; },
          namedItem(name) {
            for (let i = 0; i < this.length; i++) if (this[i] && this[i].name === name) return this[i];
            return null;
          },
          refresh() {},
        }, PluginArray.prototype);

        const mimeArray = Object.setPrototypeOf({
          0: mimePdf, 1: mimePdf2, 2: mimeNacl, 3: mimePnacl,
          length: 4,
          item(index) { return this[index] || null; },
          namedItem(name) {
            for (let i = 0; i < this.length; i++) if (this[i] && this[i].type === name) return this[i];
            return null;
          },
          refresh() {},
        }, MimeTypeArray.prototype);

        mimePdf.enabledPlugin = pdfPlugin;
        mimePdf2.enabledPlugin = pdfPlugin;
        mimeNacl.enabledPlugin = naclPlugin;
        mimePnacl.enabledPlugin = naclPlugin;

        return { pluginArray, mimeArray };
      }
      const fake = makeFakePlugins();

      // Connection API spoof
      const connectionData = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
        type: 'wifi',
      };

      // Battery API removal (mobile often lacks it; Windows sometimes has it)
      if (isWindows || isMac) {
        // Keep but fake values
      } else {
        try { delete navigator.getBattery; } catch (e) {}
      }

      // On Windows/Mac, these hardware APIs should not exist (they're Linux-only in this Chrome build)
      const shouldRemoveHWAPIs = isWindows || isMac;

      // storage.estimate spoof
      if (navigator.storage && navigator.storage.estimate) {
        const origEstimate = navigator.storage.estimate;
        navigator.storage.estimate = async function() {
          return { usage: 0, quota: 5368709120, usageDetails: {} }; // 5GB
        };
      }

      // performance.memory spoof
      if (window.performance && performance.memory) {
        try {
          Object.defineProperty(performance.memory, 'jsHeapSizeLimit', {
            get() { return 2197815296; }, // ~2.1GB, common for 8GB RAM
            configurable: true,
          });
          Object.defineProperty(performance.memory, 'totalJSHeapSize', {
            get() { return 0; },
            configurable: true,
          });
          Object.defineProperty(performance.memory, 'usedJSHeapSize', {
            get() { return 0; },
            configurable: true,
          });
        } catch (e) {}
      }

      // mediaDevices: spoof enumerateDevices
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const origEnumerate = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
        navigator.mediaDevices.enumerateDevices = async function() {
          // Return generic fake devices
          const devices = [];
          if (!isMobile) {
            devices.push(
              { deviceId: 'default', kind: 'audioinput', label: 'Default', groupId: 'default' },
              { deviceId: 'default', kind: 'audiooutput', label: 'Default', groupId: 'default' },
              { deviceId: 'communications', kind: 'audioinput', label: 'Communications', groupId: 'communications' },
              { deviceId: 'communications', kind: 'audiooutput', label: 'Communications', groupId: 'communications' }
            );
          } else {
            devices.push(
              { deviceId: 'default', kind: 'audioinput', label: '', groupId: 'default' },
              { deviceId: 'default', kind: 'audiooutput', label: '', groupId: 'default' }
            );
          }
          return devices;
        };
      }

      // Main navigator proxy
      const realNav = window.navigator;
      const hiddenHWProps = ['bluetooth','usb','hid','serial','keyboard'];
      const navProxy = new Proxy(realNav, {
        get(target, prop) {
          if (prop === 'platform') return platform;
          if (prop === 'hardwareConcurrency') return hwConcurrency;
          if (prop === 'deviceMemory') return deviceMemory;
          if (prop === 'plugins') return fake.pluginArray;
          if (prop === 'mimeTypes') return fake.mimeArray;
          if (prop === 'maxTouchPoints') return maxTouchPoints;
          if (prop === 'languages') return languages;
          if (prop === 'vendor') return vendor;
          if (prop === 'product') return product;
          if (prop === 'productSub') return productSub;
          if (prop === 'oscpu') return oscpu;
          if (prop === 'doNotTrack') return doNotTrack;
          if (prop === 'connection') {
            if (target.connection) {
              return new Proxy(target.connection, {
                get(t, p) {
                  if (connectionData[p] !== undefined) return connectionData[p];
                  return t[p];
                }
              });
            }
            return target.connection;
          }
          // Hide Linux-only hardware APIs on Windows/Mac profiles
          if (shouldRemoveHWAPIs && hiddenHWProps.includes(prop)) {
            return undefined;
          }
          return target[prop];
        },
        has(target, prop) {
          if (shouldRemoveHWAPIs && hiddenHWProps.includes(prop)) {
            return false;
          }
          return prop in target;
        }
      });

      Object.defineProperty(window, 'navigator', {
        get() { return navProxy; },
        configurable: true
      });

      // Also override on Navigator.prototype for libs that bypass window.navigator
      const protoOverrides = {
        platform: platform,
        hardwareConcurrency: hwConcurrency,
        deviceMemory: deviceMemory,
        maxTouchPoints: maxTouchPoints,
        languages: languages,
        vendor: vendor,
        product: product,
        productSub: productSub,
        oscpu: oscpu,
        doNotTrack: doNotTrack,
      };
      for (const [prop, val] of Object.entries(protoOverrides)) {
        try {
          const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
          if (desc && desc.get) {
            Object.defineProperty(Navigator.prototype, prop, {
              get() { return val; },
              enumerable: desc.enumerable,
              configurable: desc.configurable,
            });
          }
        } catch (e) {}
      }

      // Permissions API
      if (window.Permissions && Permissions.prototype && Permissions.prototype.query) {
        const origQuery = Permissions.prototype.query;
        Permissions.prototype.query = async function(permissionDesc) {
          const name = (typeof permissionDesc === 'string') ? permissionDesc : (permissionDesc?.name || '');
          const sensitive = ['notifications', 'camera', 'microphone', 'geolocation', 'clipboard-read', 'clipboard-write', 'midi', 'midi-sysex'];
          if (sensitive.includes(name)) {
            return { state: 'prompt', onchange: null };
          }
          return origQuery.call(this, permissionDesc);
        };
      }

      // ontouchstart for mobile profiles
      if (isMobile && !('ontouchstart' in window)) {
        window.ontouchstart = () => {};
      }
      if (!isMobile && ('ontouchstart' in window)) {
        try { delete window.ontouchstart; } catch (e) {}
      }
    })();
  `);

  // ────────────────────────────────────────────────
  // 3. CANVAS NOISE + NATIVE-CODE TO_STRING()
  // ────────────────────────────────────────────────
  parts.push(`
    (() => {
      const seed = ${seed};
      function seededRandom(s) {
        let t = s % 2147483647;
        if (t <= 0) t += 2147483646;
        return function() {
          t = (t * 16807) % 2147483647;
          return (t - 1) / 2147483646;
        };
      }
      const rng = seededRandom(seed);
      const noise = () => (rng() - 0.5) * 2;

      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      const wrappedGetImageData = function(sx, sy, sw, sh) {
        const imageData = origGetImageData.call(this, sx, sy, sw, sh);
        const data = imageData.data;
        const copy = new Uint8ClampedArray(data);
        for (let i = 0; i < copy.length; i += 4) {
          copy[i] = Math.max(0, Math.min(255, copy[i] + Math.round(noise())));
          copy[i+1] = Math.max(0, Math.min(255, copy[i+1] + Math.round(noise())));
          copy[i+2] = Math.max(0, Math.min(255, copy[i+2] + Math.round(noise())));
        }
        return new ImageData(copy, imageData.width, imageData.height);
      };
      wrappedGetImageData.toString = () => origGetImageData.toString();
      CanvasRenderingContext2D.prototype.getImageData = wrappedGetImageData;

      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(...args) {
        const w = this.width;
        const h = this.height;
        if (w > 0 && h > 0) {
          const tmp = document.createElement('canvas');
          tmp.width = w;
          tmp.height = h;
          const tmpCtx = tmp.getContext('2d');
          tmpCtx.drawImage(this, 0, 0);
          const imgData = tmpCtx.getImageData(0, 0, w, h);
          tmpCtx.putImageData(imgData, 0, 0);
          return origToDataURL.call(tmp, ...args);
        }
        return origToDataURL.apply(this, args);
      };

      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
        const w = this.width;
        const h = this.height;
        if (w > 0 && h > 0) {
          const tmp = document.createElement('canvas');
          tmp.width = w;
          tmp.height = h;
          const tmpCtx = tmp.getContext('2d');
          tmpCtx.drawImage(this, 0, 0);
          const imgData = tmpCtx.getImageData(0, 0, w, h);
          tmpCtx.putImageData(imgData, 0, 0);
          return origToBlob.call(tmp, callback, ...args);
        }
        return origToBlob.call(this, callback, ...args);
      };
    })();
  `);

  // ────────────────────────────────────────────────
  // 4. FONT FINGERPRINTING SPOOFING
  // ────────────────────────────────────────────────
  parts.push(`
    (() => {
      const isWindows = ${isWindows};
      const isMac = ${isMac};
      const isLinux = ${isLinux};
      const isAndroid = ${isAndroid};
      const isMobile = ${isMobile};

      // Per-OS font availability lists (what BrowserLeaks enumerates)
      const windowsFonts = new Set([
        'Arial','Arial Black','Arial Narrow','Book Antiqua','Bookman Old Style','Calibri','Cambria','Cambria Math',
        'Century','Century Gothic','Comic Sans MS','Consolas','Courier','Courier New','Georgia','Impact',
        'Lucida Console','Lucida Sans Unicode','Microsoft Sans Serif','Monotype Corsiva','MS Gothic','MS Mincho',
        'MS PGothic','MS PMincho','MS Reference Sans Serif','MS Sans Serif','MS Serif','Palatino Linotype',
        'Segoe Print','Segoe Script','Segoe UI','Segoe UI Light','Segoe UI Semibold','Segoe UI Symbol',
        'Tahoma','Times','Times New Roman','Trebuchet MS','Verdana','Wingdings','Wingdings 2','Wingdings 3',
      ]);
      const macFonts = new Set([
        'American Typewriter','Andale Mono','Arial','Arial Black','Arial Narrow','Arial Rounded MT Bold',
        'Avenir','Baskerville','Big Caslon','Book Antiqua','Bookman Old Style','Bradley Hand','Brush Script MT',
        'Chalkboard','Chalkboard SE','Charcoal','Chicago','Comic Sans MS','Copperplate','Courier','Courier New',
        'Didot','Futura','Geneva','Georgia','Gill Sans','Helvetica','Helvetica Neue','Herculanum','Hoefler Text',
        'Impact','Lucida Grande','Marker Felt','Monaco','Optima','Palatino','Papyrus','Skia','Tahoma','Times',
        'Times New Roman','Trebuchet MS','Verdana','Zapfino',
      ]);
      const linuxFonts = new Set([
        'Arimo','Cousine','DejaVu Sans','DejaVu Sans Mono','DejaVu Serif','Liberation Mono','Liberation Sans',
        'Liberation Sans Narrow','Liberation Serif','Noto Mono','Noto Sans','Noto Serif','Roboto','Roboto Mono',
        'Ubuntu','Ubuntu Mono',
      ]);

      let allowedFonts = linuxFonts;
      if (isWindows) allowedFonts = windowsFonts;
      else if (isMac) allowedFonts = macFonts;

      // Always include common cross-platform fonts
      const commonFonts = new Set(['Arial','Courier New','Georgia','Impact','Times New Roman','Verdana','Comic Sans MS','Trebuchet MS']);
      for (const f of commonFonts) allowedFonts.add(f);

      // document.fonts.check spoofing
      // Chrome's FontFaceSet.check accepts a CSS font shorthand string like "12px Arial, sans-serif"
      if (document.fonts && document.fonts.check) {
        const origCheck = document.fonts.check.bind(document.fonts);
        document.fonts.check = function(font, text) {
          // Extract family names from font shorthand: "12px \"Segoe UI\", Arial, sans-serif"
          // Strategy: remove size/weight/style/stretch/variant keywords, keep quoted and unquoted families
          let cleaned = font;
          // Remove numeric sizes (px, pt, em, rem, %, etc.)
          cleaned = cleaned.replace(/\\b\\d+(\\.\\d+)?(px|pt|em|rem|%|ex|ch|cm|mm|in|pc|vh|vw|vmin|vmax)\\b/gi, '');
          // Remove style/weight/variant/stretch keywords
          cleaned = cleaned.replace(/\\b(normal|italic|oblique|bold|bolder|lighter|100|200|300|400|500|600|700|800|900|small-caps|xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger|ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded)\\b/gi, '');
          // Remove slash line-height
          cleaned = cleaned.replace(/\\/\\s*\\d+(\\.\\d+)?/g, '');
          // Now extract quoted and unquoted family names
          const families = [];
          const quoted = cleaned.match(/"([^"]+)"/g);
          if (quoted) quoted.forEach(q => families.push(q.replace(/"/g, '')));
          const unquoted = cleaned.replace(/"[^"]+"/g, '').split(/,\\s*/);
          for (const u of unquoted) {
            const trimmed = u.trim();
            if (trimmed && !['sans-serif','serif','monospace','cursive','fantasy','system-ui','emoji','math','fangsong'].includes(trimmed.toLowerCase())) {
              families.push(trimmed);
            }
          }
          for (const family of families) {
            if (allowedFonts.has(family)) return true;
          }
          return false;
        };
      }

      // FontFace.load spoofing
      if (window.FontFace) {
        const origLoad = FontFace.prototype.load;
        FontFace.prototype.load = function() {
          const family = this.family?.replace(/["']/g, '').trim();
          if (family && allowedFonts.has(family)) {
            this.status = 'loaded';
            return Promise.resolve(this);
          }
          this.status = 'error';
          return Promise.reject(new DOMException('NetworkError', 'NetworkError'));
        };
      }

      // getComputedStyle font-family interception
      const origGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = function(el, pseudo) {
        const style = origGetComputedStyle.call(this, el, pseudo);
        if (!style) return style;
        return new Proxy(style, {
          get(target, prop) {
            if (prop === 'fontFamily' || prop === 'font-family') {
              const raw = target.fontFamily || target['font-family'];
              // Report the requested family, not the fallback
              return raw;
            }
            return target[prop];
          }
        });
      };

      // Canvas measureText spoofing: return synthetic metrics
      const origMeasureText = CanvasRenderingContext2D.prototype.measureText;
      CanvasRenderingContext2D.prototype.measureText = function(text) {
        const metrics = origMeasureText.call(this, text);
        // Perturb width slightly per profile seed (deterministic)
        const seed = ${seed};
        const perturb = ((seed * 7 + text.length * 13) % 100) / 10000; // 0-0.01% variation
        const fakeWidth = metrics.width * (1 + perturb);
        return {
          width: fakeWidth,
          actualBoundingBoxLeft: metrics.actualBoundingBoxLeft,
          actualBoundingBoxRight: metrics.actualBoundingBoxRight,
          actualBoundingBoxAscent: metrics.actualBoundingBoxAscent,
          actualBoundingBoxDescent: metrics.actualBoundingBoxDescent,
          fontBoundingBoxAscent: metrics.fontBoundingBoxAscent,
          fontBoundingBoxDescent: metrics.fontBoundingBoxDescent,
          emHeightAscent: metrics.emHeightAscent,
          emHeightDescent: metrics.emHeightDescent,
          hangingBaseline: metrics.hangingBaseline,
          alphabeticBaseline: metrics.alphabeticBaseline,
          ideographicBaseline: metrics.ideographicBaseline,
        };
      };

      // Prevent @font-face web font loading (can expose real system differences)
      // Intercept CSSStyleSheet.insertRule and <style> to block @font-face
      const origInsertRule = CSSStyleSheet.prototype.insertRule;
      CSSStyleSheet.prototype.insertRule = function(rule, index) {
        if (rule.includes('@font-face') || rule.includes('@font-feature-values')) {
          return 0; // silently drop
        }
        return origInsertRule.call(this, rule, index);
      };

      // Block FontFace constructor for external fonts
      if (window.FontFace) {
        const OrigFontFace = window.FontFace;
        window.FontFace = function(family, source, descriptors) {
          // If source is a URL, block it
          if (typeof source === 'string' && (source.includes('url(') || source.startsWith('http'))) {
            // Return a FontFace that loads but uses a blank or system font
            const ff = new OrigFontFace(family, 'local("Arial")', descriptors);
            return ff;
          }
          return new OrigFontFace(family, source, descriptors);
        };
        window.FontFace.prototype = OrigFontFace.prototype;
      }
    })();
  `);

  // ────────────────────────────────────────────────
  // 5. WEBGL VENDOR/RENDERER + GPU LIMITS MATRIX
  // ────────────────────────────────────────────────
  parts.push(`
    (() => {
      const vendor = '${webglVendor.replace(/'/g, "\\'")}';
      const renderer = '${webglRenderer.replace(/'/g, "\\'")}';

      // GPU limits database — match renderer string to realistic caps
      let limits = {};
      if (renderer.includes('GTX 1050 Ti') || renderer.includes('GTX 1050')) {
        limits = {
          maxTextureSize: 16384,
          maxCubeMapTextureSize: 16384,
          maxRenderbufferSize: 16384,
          maxViewportDims: [16384, 16384],
          maxVertexAttribs: 16,
          maxVertexUniformVectors: 4096,
          maxFragmentUniformVectors: 4096,
          maxVaryingVectors: 31,
          maxTextureImageUnits: 32,
          maxVertexTextureImageUnits: 32,
          maxCombinedTextureImageUnits: 48,
          aliasedLineWidthRange: [1, 1],
          aliasedPointSizeRange: [1, 1024],
          extensionsCount: 49,
        };
      } else if (renderer.includes('RTX 3060') || renderer.includes('RTX 3070') || renderer.includes('RTX 3080') || renderer.includes('RTX 4090')) {
        limits = {
          maxTextureSize: 32768,
          maxCubeMapTextureSize: 32768,
          maxRenderbufferSize: 32768,
          maxViewportDims: [32768, 32768],
          maxVertexAttribs: 16,
          maxVertexUniformVectors: 4096,
          maxFragmentUniformVectors: 4096,
          maxVaryingVectors: 31,
          maxTextureImageUnits: 32,
          maxVertexTextureImageUnits: 32,
          maxCombinedTextureImageUnits: 48,
          aliasedLineWidthRange: [1, 1],
          aliasedPointSizeRange: [1, 1024],
          extensionsCount: 53,
        };
      } else if (renderer.includes('Intel') && renderer.includes('UHD')) {
        limits = {
          maxTextureSize: 16384,
          maxCubeMapTextureSize: 16384,
          maxRenderbufferSize: 16384,
          maxViewportDims: [16384, 16384],
          maxVertexAttribs: 16,
          maxVertexUniformVectors: 4096,
          maxFragmentUniformVectors: 4096,
          maxVaryingVectors: 30,
          maxTextureImageUnits: 32,
          maxVertexTextureImageUnits: 32,
          maxCombinedTextureImageUnits: 48,
          aliasedLineWidthRange: [1, 1],
          aliasedPointSizeRange: [1, 255],
          extensionsCount: 46,
        };
      } else if (renderer.includes('AMD') || renderer.includes('Radeon')) {
        limits = {
          maxTextureSize: 16384,
          maxCubeMapTextureSize: 16384,
          maxRenderbufferSize: 16384,
          maxViewportDims: [16384, 16384],
          maxVertexAttribs: 16,
          maxVertexUniformVectors: 4096,
          maxFragmentUniformVectors: 4096,
          maxVaryingVectors: 32,
          maxTextureImageUnits: 32,
          maxVertexTextureImageUnits: 32,
          maxCombinedTextureImageUnits: 48,
          aliasedLineWidthRange: [1, 1],
          aliasedPointSizeRange: [1, 8192],
          extensionsCount: 50,
        };
      } else if (renderer.includes('Apple GPU')) {
        limits = {
          maxTextureSize: 16384,
          maxCubeMapTextureSize: 16384,
          maxRenderbufferSize: 16384,
          maxViewportDims: [16384, 16384],
          maxVertexAttribs: 16,
          maxVertexUniformVectors: 1024,
          maxFragmentUniformVectors: 1024,
          maxVaryingVectors: 15,
          maxTextureImageUnits: 16,
          maxVertexTextureImageUnits: 16,
          maxCombinedTextureImageUnits: 32,
          aliasedLineWidthRange: [1, 1],
          aliasedPointSizeRange: [1, 511],
          extensionsCount: 42,
        };
      } else if (renderer.includes('Mali')) {
        limits = {
          maxTextureSize: 4096,
          maxCubeMapTextureSize: 4096,
          maxRenderbufferSize: 4096,
          maxViewportDims: [4096, 4096],
          maxVertexAttribs: 16,
          maxVertexUniformVectors: 256,
          maxFragmentUniformVectors: 224,
          maxVaryingVectors: 15,
          maxTextureImageUnits: 16,
          maxVertexTextureImageUnits: 16,
          maxCombinedTextureImageUnits: 32,
          aliasedLineWidthRange: [1, 1],
          aliasedPointSizeRange: [1, 100],
          extensionsCount: 28,
        };
      } else {
        // Default fallback
        limits = {
          maxTextureSize: 16384,
          maxCubeMapTextureSize: 16384,
          maxRenderbufferSize: 16384,
          maxViewportDims: [16384, 16384],
          maxVertexAttribs: 16,
          maxVertexUniformVectors: 4096,
          maxFragmentUniformVectors: 4096,
          maxVaryingVectors: 31,
          maxTextureImageUnits: 32,
          maxVertexTextureImageUnits: 32,
          maxCombinedTextureImageUnits: 48,
          aliasedLineWidthRange: [1, 1],
          aliasedPointSizeRange: [1, 1024],
          extensionsCount: 49,
        };
      }

      const glEnums = {
        MAX_TEXTURE_SIZE: 0x0D33,
        MAX_CUBE_MAP_TEXTURE_SIZE: 0x851C,
        MAX_RENDERBUFFER_SIZE: 0x84E8,
        MAX_VIEWPORT_DIMS: 0x0D3A,
        MAX_VERTEX_ATTRIBS: 0x8869,
        MAX_VERTEX_UNIFORM_VECTORS: 0x8DFB,
        MAX_FRAGMENT_UNIFORM_VECTORS: 0x8DFD,
        MAX_VARYING_VECTORS: 0x8DFC,
        MAX_TEXTURE_IMAGE_UNITS: 0x8872,
        MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0x8B4C,
        MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8B4D,
        ALIASED_LINE_WIDTH_RANGE: 0x846D,
        ALIASED_POINT_SIZE_RANGE: 0x846E,
        UNMASKED_VENDOR_WEBGL: 0x9245,
        UNMASKED_RENDERER_WEBGL: 0x9246,
        VERSION: 0x1F02,
        VENDOR: 0x1F00,
        RENDERER: 0x1F01,
        SHADING_LANGUAGE_VERSION: 0x8B8C,
      };

      const paramMap = {};
      paramMap[glEnums.MAX_TEXTURE_SIZE] = limits.maxTextureSize;
      paramMap[glEnums.MAX_CUBE_MAP_TEXTURE_SIZE] = limits.maxCubeMapTextureSize;
      paramMap[glEnums.MAX_RENDERBUFFER_SIZE] = limits.maxRenderbufferSize;
      paramMap[glEnums.MAX_VIEWPORT_DIMS] = limits.maxViewportDims;
      paramMap[glEnums.MAX_VERTEX_ATTRIBS] = limits.maxVertexAttribs;
      paramMap[glEnums.MAX_VERTEX_UNIFORM_VECTORS] = limits.maxVertexUniformVectors;
      paramMap[glEnums.MAX_FRAGMENT_UNIFORM_VECTORS] = limits.maxFragmentUniformVectors;
      paramMap[glEnums.MAX_VARYING_VECTORS] = limits.maxVaryingVectors;
      paramMap[glEnums.MAX_TEXTURE_IMAGE_UNITS] = limits.maxTextureImageUnits;
      paramMap[glEnums.MAX_VERTEX_TEXTURE_IMAGE_UNITS] = limits.maxVertexTextureImageUnits;
      paramMap[glEnums.MAX_COMBINED_TEXTURE_IMAGE_UNITS] = limits.maxCombinedTextureImageUnits;
      paramMap[glEnums.ALIASED_LINE_WIDTH_RANGE] = limits.aliasedLineWidthRange;
      paramMap[glEnums.ALIASED_POINT_SIZE_RANGE] = limits.aliasedPointSizeRange;
      paramMap[glEnums.UNMASKED_VENDOR_WEBGL] = vendor;
      paramMap[glEnums.UNMASKED_RENDERER_WEBGL] = renderer;

      function wrapGetParameter(orig) {
        return function(pname) {
          if (paramMap[pname] !== undefined) return paramMap[pname];
          return orig.call(this, pname);
        };
      }

      const origGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = wrapGetParameter(origGetParameter);

      if (window.WebGL2RenderingContext) {
        const origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = wrapGetParameter(origGetParameter2);
      }

      // Extensions count spoofing
      const origGetSupportedExtensions = WebGLRenderingContext.prototype.getSupportedExtensions;
      WebGLRenderingContext.prototype.getSupportedExtensions = function() {
        const real = origGetSupportedExtensions.call(this);
        if (!real) return real;
        // Trim or pad to match expected count
        const target = limits.extensionsCount;
        if (real.length > target) return real.slice(0, target);
        return real;
      };
    })();
  `);

  // ────────────────────────────────────────────────
  // 6. AUDIO CONTEXT FINGERPRINT NOISE
  // ────────────────────────────────────────────────
  parts.push(`
    (() => {
      const seed = ${audioSeed};
      function seededRandom(s) {
        let t = s % 2147483647;
        if (t <= 0) t += 2147483646;
        return function() {
          t = (t * 16807) % 2147483647;
          return (t - 1) / 2147483646;
        };
      }
      const rng = seededRandom(seed);
      const noise = () => (rng() - 0.5) * 0.0001;

      if (window.OfflineAudioContext || window.webkitOfflineAudioContext) {
        const Orig = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const origGetChannelData = Orig.prototype.getChannelData;
        Orig.prototype.getChannelData = function(channel) {
          const data = origGetChannelData.call(this, channel);
          for (let i = 0; i < data.length; i++) {
            data[i] += noise();
          }
          return data;
        };
      }

      if (window.AudioBuffer && window.AudioBuffer.prototype) {
        const origABGetChannelData = window.AudioBuffer.prototype.getChannelData;
        window.AudioBuffer.prototype.getChannelData = function(channel) {
          const data = origABGetChannelData.call(this, channel);
          for (let i = 0; i < data.length; i++) {
            data[i] += noise();
          }
          return data;
        };
      }
    })();
  `);

  // ────────────────────────────────────────────────
  // 7. CLIENT RECTS NOISE
  // ────────────────────────────────────────────────
  if (clientRectsNoise > 0) {
    parts.push(`
      (() => {
        const amplitude = ${clientRectsNoise};
        const seed = ${seed + 777};
        function seededRandom(s) {
          let t = s % 2147483647;
          if (t <= 0) t += 2147483646;
          return function() {
            t = (t * 16807) % 2147483647;
            return (t - 1) / 2147483646;
          };
        }
        const rng = seededRandom(seed);
        const noise = () => (rng() - 0.5) * 2 * amplitude;

        const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function() {
          const rect = origGetBoundingClientRect.call(this);
          return {
            x: rect.x + noise(),
            y: rect.y + noise(),
            width: rect.width + noise(),
            height: rect.height + noise(),
            top: rect.top + noise(),
            right: rect.right + noise(),
            bottom: rect.bottom + noise(),
            left: rect.left + noise(),
            toJSON() { return this; }
          };
        };

        const origGetClientRects = Element.prototype.getClientRects;
        Element.prototype.getClientRects = function() {
          const rects = origGetClientRects.call(this);
          const out = [];
          for (let i = 0; i < rects.length; i++) {
            const r = rects[i];
            out.push({
              x: r.x + noise(),
              y: r.y + noise(),
              width: r.width + noise(),
              height: r.height + noise(),
              top: r.top + noise(),
              right: r.right + noise(),
              bottom: r.bottom + noise(),
              left: r.left + noise(),
              toJSON() { return this; }
            });
          }
          return out;
        };
      })();
    `);
  }

  // ────────────────────────────────────────────────
  // 8. WEBRTC IP LEAK BLOCKING
  // ────────────────────────────────────────────────
  if (webrtcPolicy === 'strict_block') {
    parts.push(`
      (() => {
        delete window.RTCPeerConnection;
        delete window.webkitRTCPeerConnection;
        delete window.RTCSessionDescription;
        delete window.RTCIceCandidate;
        delete window.RTCDataChannel;
        if (navigator.mediaDevices) {
          navigator.mediaDevices.getUserMedia = async () => {
            throw new DOMException('Permission denied', 'NotAllowedError');
          };
        }
      })();
    `);
  } else if (webrtcPolicy === 'block_local_ips') {
    parts.push(`
      (() => {
        const origRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        if (!origRTCPeerConnection) return;

        function sanitizeSdp(sdp) {
          if (!sdp) return sdp;
          const lines = sdp.split(/\\r?\\n/);
          const out = [];
          for (const line of lines) {
            if (line.startsWith('a=candidate:')) {
              if (/192\\.168\\.|10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|127\\.|0\\.0\\.0\\.0|::1|fc00:|fe80:|\\.local\\b/i.test(line)) {
                continue;
              }
            }
            if (/^c=IN IP4 /i.test(line)) {
              out.push('c=IN IP4 0.0.0.0');
              continue;
            }
            if (/^c=IN IP6 /i.test(line)) {
              out.push('c=IN IP6 ::');
              continue;
            }
            out.push(line);
          }
          return out.join('\\r\\n');
        }

        function filterIceCandidates(pc) {
          const origAddIceCandidate = pc.addIceCandidate.bind(pc);
          pc.addIceCandidate = async (candidate) => {
            if (candidate && candidate.candidate) {
              const c = candidate.candidate;
              if (/192\\.168\\.|10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|127\\.|0\\.0\\.0\\.0|::1|fc00:|fe80:|\\.local\\b/i.test(c)) {
                return Promise.resolve();
              }
            }
            return origAddIceCandidate(candidate);
          };
          let userHandler = null;
          Object.defineProperty(pc, 'onicecandidate', {
            get() { return userHandler; },
            set(fn) { userHandler = fn; },
            configurable: true
          });
          pc.addEventListener('icecandidate', (e) => {
            if (e.candidate && e.candidate.candidate) {
              const c = e.candidate.candidate;
              if (/192\\.168\\.|10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|127\\.|0\\.0\\.0\\.0|::1|fc00:|fe80:|\\.local\\b/i.test(c)) {
                return;
              }
            }
            if (userHandler) userHandler(e);
          });
        }

        const origProtoCreateOffer = origRTCPeerConnection.prototype.createOffer;
        origRTCPeerConnection.prototype.createOffer = function(...args) {
          let successCb = null;
          for (const arg of args) {
            if (typeof arg === 'function' && !successCb) successCb = arg;
          }
          const wrappedSuccess = successCb
            ? (offer) => {
                if (offer && offer.sdp) offer.sdp = sanitizeSdp(offer.sdp);
                successCb(offer);
              }
            : undefined;
          const wrappedArgs = wrappedSuccess
            ? args.map(a => (a === successCb ? wrappedSuccess : a))
            : args;
          const p = origProtoCreateOffer.apply(this, wrappedArgs);
          if (!successCb && p && typeof p.then === 'function') {
            return p.then(offer => {
              if (offer && offer.sdp) offer.sdp = sanitizeSdp(offer.sdp);
              return offer;
            });
          }
          return p;
        };

        const origProtoCreateAnswer = origRTCPeerConnection.prototype.createAnswer;
        origRTCPeerConnection.prototype.createAnswer = function(...args) {
          let successCb = null;
          for (const arg of args) {
            if (typeof arg === 'function' && !successCb) successCb = arg;
          }
          const wrappedSuccess = successCb
            ? (answer) => {
                if (answer && answer.sdp) answer.sdp = sanitizeSdp(answer.sdp);
                successCb(answer);
              }
            : undefined;
          const wrappedArgs = wrappedSuccess
            ? args.map(a => (a === successCb ? wrappedSuccess : a))
            : args;
          const p = origProtoCreateAnswer.apply(this, wrappedArgs);
          if (!successCb && p && typeof p.then === 'function') {
            return p.then(answer => {
              if (answer && answer.sdp) answer.sdp = sanitizeSdp(answer.sdp);
              return answer;
            });
          }
          return p;
        };

        const descProps = ['localDescription', 'remoteDescription', 'pendingLocalDescription', 'pendingRemoteDescription', 'currentLocalDescription', 'currentRemoteDescription'];
        for (const prop of descProps) {
          try {
            const desc = Object.getOwnPropertyDescriptor(origRTCPeerConnection.prototype, prop);
            if (!desc || !desc.get) continue;
            const origGet = desc.get;
            Object.defineProperty(origRTCPeerConnection.prototype, prop, {
              get() {
                const val = origGet.apply(this);
                if (val && val.sdp) {
                  const clean = sanitizeSdp(val.sdp);
                  if (clean !== val.sdp) {
                    return new RTCSessionDescription({ type: val.type, sdp: clean });
                  }
                }
                return val;
              },
              configurable: true
            });
          } catch (e) {}
        }

        const origSetLocalDesc = origRTCPeerConnection.prototype.setLocalDescription;
        origRTCPeerConnection.prototype.setLocalDescription = function(description) {
          if (description && description.sdp) {
            const clean = sanitizeSdp(description.sdp);
            if (clean !== description.sdp) {
              description = new RTCSessionDescription({ type: description.type, sdp: clean });
            }
          }
          return origSetLocalDesc.call(this, description);
        };
        const origSetRemoteDesc = origRTCPeerConnection.prototype.setRemoteDescription;
        origRTCPeerConnection.prototype.setRemoteDescription = function(description) {
          if (description && description.sdp) {
            const clean = sanitizeSdp(description.sdp);
            if (clean !== description.sdp) {
              description = new RTCSessionDescription({ type: description.type, sdp: clean });
            }
          }
          return origSetRemoteDesc.call(this, description);
        };

        window.RTCPeerConnection = function(...args) {
          const config = args[0] || {};
          config.iceServers = [];
          const pc = new origRTCPeerConnection(config);
          filterIceCandidates(pc);
          return pc;
        };
        window.RTCPeerConnection.prototype = origRTCPeerConnection.prototype;
        if (window.webkitRTCPeerConnection) {
          window.webkitRTCPeerConnection = window.RTCPeerConnection;
        }

        if (navigator.mediaDevices) {
          navigator.mediaDevices.getUserMedia = async () => {
            throw new DOMException('Permission denied', 'NotAllowedError');
          };
        }
      })();
    `);
  }

  return parts.join('\n');
}

module.exports = { buildAntiDetectScript };
