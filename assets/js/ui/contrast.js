(function (global) {
  const namespace = global.NVCContrast || {};

  const NAV_HEIGHT_STORAGE_KEY = 'magnetPositions:site-nav:heightPx';
  const NAV_HEIGHT_STYLE_ID = 'nav-board-height-style';
  const NAV_HEIGHT_VAR = '--nav-board-height';
  const NAV_HEIGHT_STATE_ATTR = 'data-nav-height-state';
  const NAV_HEIGHT_STATE_LOADING = 'loading';
  const NAV_HEIGHT_STATE_READY = 'ready';
  const NAV_HEIGHT_FALLBACK_DELAY_MS = 700;

  let navHeightFallbackTimer = null;

  function clearNavHeightFallbackTimer() {
    if (navHeightFallbackTimer != null && typeof window !== 'undefined' && window.clearTimeout) {
      window.clearTimeout(navHeightFallbackTimer);
    }
    navHeightFallbackTimer = null;
  }

  function scheduleNavHeightFallback() {
    if (navHeightFallbackTimer != null || typeof window === 'undefined' || !window.setTimeout) {
      return;
    }

    if (typeof document !== 'undefined' && document.documentElement) {
      const state = document.documentElement.getAttribute(NAV_HEIGHT_STATE_ATTR);
      if (state === NAV_HEIGHT_STATE_READY) {
        return;
      }
    }

    navHeightFallbackTimer = window.setTimeout(() => {
      navHeightFallbackTimer = null;
      if (typeof document === 'undefined' || !document.documentElement) {
        return;
      }
      const root = document.documentElement;
      if (root.getAttribute(NAV_HEIGHT_STATE_ATTR) === NAV_HEIGHT_STATE_LOADING) {
        root.setAttribute(NAV_HEIGHT_STATE_ATTR, NAV_HEIGHT_STATE_READY);
      }
    }, NAV_HEIGHT_FALLBACK_DELAY_MS);
  }

  function setNavHeightState(state) {
    if (typeof document === 'undefined' || !document.documentElement) {
      return;
    }

    const root = document.documentElement;
    const nextState = state === NAV_HEIGHT_STATE_READY
      ? NAV_HEIGHT_STATE_READY
      : NAV_HEIGHT_STATE_LOADING;

    const currentState = root.getAttribute(NAV_HEIGHT_STATE_ATTR);
    if (currentState === nextState) {
      if (nextState === NAV_HEIGHT_STATE_READY) {
        clearNavHeightFallbackTimer();
      }
      return;
    }

    root.setAttribute(NAV_HEIGHT_STATE_ATTR, nextState);
    if (nextState === NAV_HEIGHT_STATE_READY) {
      clearNavHeightFallbackTimer();
    } else {
      scheduleNavHeightFallback();
    }
  }

  function markNavHeightLoading() {
    setNavHeightState(NAV_HEIGHT_STATE_LOADING);
  }

  function markNavHeightReady() {
    setNavHeightState(NAV_HEIGHT_STATE_READY);
  }

  let lastStoredNavHeight = 0;

  function readStoredNavHeight() {
    if (typeof window === 'undefined') {
      return 0;
    }

    try {
      const raw = window.localStorage && window.localStorage.getItem
        ? window.localStorage.getItem(NAV_HEIGHT_STORAGE_KEY)
        : null;
      if (!raw) {
        return 0;
      }
      const parsed = Number.parseFloat(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return 0;
      }
      return parsed;
    } catch (error) {
      return 0;
    }
  }

  function ensureNavHeightStyleElement() {
    if (typeof document === 'undefined') {
      return null;
    }

    let styleEl = document.getElementById(NAV_HEIGHT_STYLE_ID);
    if (styleEl) {
      return styleEl;
    }

    const head = document.head || document.getElementsByTagName('head')[0];
    if (!head || !head.appendChild) {
      return null;
    }

    styleEl = document.createElement('style');
    styleEl.id = NAV_HEIGHT_STYLE_ID;
    styleEl.textContent = `:root[data-nav-height-state='${NAV_HEIGHT_STATE_LOADING}'] .page{opacity:0;visibility:hidden;}`
      + `:root[data-nav-height-state='${NAV_HEIGHT_STATE_READY}'] .page{opacity:1;visibility:visible;}`
      + `:root[data-nav-height-state] .page{transition:opacity 160ms ease-in;}`
      + `.site-nav__board{height:var(${NAV_HEIGHT_VAR}, auto);}`;

    if (head.firstChild) {
      head.insertBefore(styleEl, head.firstChild);
    } else {
      head.appendChild(styleEl);
    }

    return styleEl;
  }

  function applyNavHeightValue(height) {
    if (typeof document === 'undefined') {
      return false;
    }

    const root = document.documentElement;
    if (!root || !root.style) {
      return false;
    }

    if (!Number.isFinite(height) || height <= 0) {
      root.style.removeProperty(NAV_HEIGHT_VAR);
      return false;
    }

    ensureNavHeightStyleElement();
    const resolved = Math.max(Math.round(height), 0);
    root.style.setProperty(NAV_HEIGHT_VAR, `${resolved}px`);
    markNavHeightReady();
    return true;
  }

  function clearNavHeight() {
    lastStoredNavHeight = 0;

    if (typeof window !== 'undefined' && window.localStorage && window.localStorage.removeItem) {
      try {
        window.localStorage.removeItem(NAV_HEIGHT_STORAGE_KEY);
      } catch (error) {
        // Ignore storage errors (quota, private mode, etc.).
      }
    }

    if (typeof document !== 'undefined' && document.documentElement && document.documentElement.style) {
      document.documentElement.style.removeProperty(NAV_HEIGHT_VAR);
    }
  }

  function storeNavHeight(height) {
    if (!Number.isFinite(height) || height <= 0) {
      clearNavHeight();
      return false;
    }

    const resolved = Math.max(Math.round(height), 0);
    if (resolved === lastStoredNavHeight) {
      return applyNavHeightValue(resolved);
    }

    lastStoredNavHeight = resolved;

    if (typeof window !== 'undefined' && window.localStorage && window.localStorage.setItem) {
      try {
        window.localStorage.setItem(NAV_HEIGHT_STORAGE_KEY, String(resolved));
      } catch (error) {
        // Ignore storage errors (quota, private mode, etc.).
      }
    }

    return applyNavHeightValue(resolved);
  }

  function applyStoredNavHeight() {
    const stored = readStoredNavHeight();
    if (stored > 0) {
      lastStoredNavHeight = Math.max(Math.round(stored), 0);
      applyNavHeightValue(stored);
      return stored;
    }

    clearNavHeight();
    return 0;
  }

  const navHeightNamespace = {
    readHeight: readStoredNavHeight,
    storeHeight,
    clearHeight: clearNavHeight,
    applyStoredHeight: applyStoredNavHeight,
    markReady: markNavHeightReady,
    markLoading: markNavHeightLoading,
  };

  namespace.navHeight = navHeightNamespace;
  global.NVCNavHeight = navHeightNamespace;

  markNavHeightLoading();
  ensureNavHeightStyleElement();
  applyStoredNavHeight();
  scheduleNavHeightFallback();

  function clamp(value, min, max) {
    if (Number.isNaN(value)) {
      return min;
    }
    return Math.min(Math.max(value, min), max);
  }

  function parseColor(value) {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith('#')) {
      const hex = trimmed.slice(1);
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
          return null;
        }
        return { r, g, b };
      }
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
          return null;
        }
        return { r, g, b };
      }
      return null;
    }

    const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbMatch) {
      const parts = rgbMatch[1]
        .split(',')
        .map((part) => Number.parseFloat(part.trim()))
        .filter((part, index) => index < 3 && Number.isFinite(part));
      if (parts.length === 3) {
        return {
          r: clamp(Math.round(parts[0]), 0, 255),
          g: clamp(Math.round(parts[1]), 0, 255),
          b: clamp(Math.round(parts[2]), 0, 255),
        };
      }
    }

    return null;
  }

  function rgbToHex(rgb) {
    if (!rgb) {
      return '';
    }
    const toHex = (component) => clamp(Math.round(component), 0, 255).toString(16).padStart(2, '0');
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
  }

  function channelToLinear(value) {
    const srgb = clamp(value, 0, 255) / 255;
    if (srgb <= 0.03928) {
      return srgb / 12.92;
    }
    return Math.pow((srgb + 0.055) / 1.055, 2.4);
  }

  function rgbToRelativeLuminance(rgb) {
    if (!rgb) {
      return 0;
    }
    const r = channelToLinear(rgb.r);
    const g = channelToLinear(rgb.g);
    const b = channelToLinear(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastFromRgb(bgRgb, fgRgb) {
    const lum1 = rgbToRelativeLuminance(bgRgb);
    const lum2 = rgbToRelativeLuminance(fgRgb);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function getContrastRatio(bgColor, fgColor) {
    const bg = parseColor(bgColor);
    const fg = parseColor(fgColor);
    if (!bg || !fg) {
      return 1;
    }
    return contrastFromRgb(bg, fg);
  }

  function rgbToHsl(rgb) {
    const r = clamp(rgb.r, 0, 255) / 255;
    const g = clamp(rgb.g, 0, 255) / 255;
    const b = clamp(rgb.b, 0, 255) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        default:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return {
      h: h * 360,
      s: s * 100,
      l: l * 100,
    };
  }

  function hueToRgb(p, q, t) {
    let temp = t;
    if (temp < 0) {
      temp += 1;
    }
    if (temp > 1) {
      temp -= 1;
    }
    if (temp < 1 / 6) {
      return p + (q - p) * 6 * temp;
    }
    if (temp < 1 / 2) {
      return q;
    }
    if (temp < 2 / 3) {
      return p + (q - p) * (2 / 3 - temp) * 6;
    }
    return p;
  }

  function hslToRgb(hsl) {
    const h = ((hsl.h % 360) + 360) % 360 / 360;
    const s = clamp(hsl.s, 0, 100) / 100;
    const l = clamp(hsl.l, 0, 100) / 100;

    if (s === 0) {
      const value = Math.round(l * 255);
      return { r: value, g: value, b: value };
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const r = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
    const g = Math.round(hueToRgb(p, q, h) * 255);
    const b = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);

    return { r, g, b };
  }

  function adjustLightness(color, deltaPercent) {
    const rgb = parseColor(color);
    if (!rgb) {
      return '';
    }
    const hsl = rgbToHsl(rgb);
    hsl.l = clamp(hsl.l + deltaPercent, 0, 100);
    return rgbToHex(hslToRgb(hsl));
  }

  function autoContrast(bgVar, fgVar, desiredRatio = 4.5) {
    if (typeof document === 'undefined') {
      return null;
    }
    const root = document.documentElement;
    if (!root) {
      return null;
    }
    const style = root.style;
    const computed = getComputedStyle(root);
    const backgroundValue = computed.getPropertyValue(bgVar).trim();
    const backgroundRgb = parseColor(backgroundValue);
    if (!backgroundRgb) {
      return null;
    }

    const black = { r: 17, g: 17, b: 17 };
    const white = { r: 255, g: 255, b: 255 };

    let blackRatio = contrastFromRgb(backgroundRgb, black);
    let whiteRatio = contrastFromRgb(backgroundRgb, white);
    let chosenFg = blackRatio >= whiteRatio ? black : white;
    let ratio = Math.max(blackRatio, whiteRatio);

    let adjustedBg = { ...backgroundRgb };
    if (ratio < desiredRatio) {
      const direction = chosenFg === white ? -6 : 6;
      const hsl = rgbToHsl(backgroundRgb);
      for (let step = 0; step < 10 && ratio < desiredRatio; step += 1) {
        const nextLightness = clamp(hsl.l + direction, 0, 100);
        if (nextLightness === hsl.l) {
          break;
        }
        hsl.l = nextLightness;
        adjustedBg = hslToRgb(hsl);
        ratio = contrastFromRgb(adjustedBg, chosenFg);
        if (hsl.l <= 0 || hsl.l >= 100) {
          break;
        }
      }
    }

    const finalBgHex = rgbToHex(adjustedBg);
    const finalFgHex = rgbToHex(chosenFg);

    if (style) {
      style.setProperty(fgVar, finalFgHex);
      style.setProperty('--btn-fg', finalFgHex);
      style.setProperty('--chip-fg', finalFgHex);
      if (bgVar === '--btn-bg' || finalBgHex !== rgbToHex(backgroundRgb)) {
        style.setProperty(bgVar, finalBgHex);
        if (bgVar !== '--btn-bg') {
          style.setProperty('--btn-bg', finalBgHex);
        }
      }
    }

    return ratio;
  }

  namespace.getContrastRatio = getContrastRatio;
  namespace.autoContrast = autoContrast;
  namespace.adjustLightness = adjustLightness;

  global.NVCContrast = namespace;
})(typeof window !== 'undefined' ? window : globalThis);
