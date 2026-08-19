(function (global) {
  const namespace = global.NVCContrast || {};

  function loadInventoryMobileStylesBeforePaint() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const pathname = window.location && typeof window.location.pathname === 'string'
      ? window.location.pathname
      : '';
    const isInventoryPath =
      pathname.endsWith('/inventory/') || pathname.endsWith('/inventory/index.html');
    if (!isInventoryPath) {
      return;
    }

    if (document.querySelector('link[data-inventory-mobile-styles]')) {
      return;
    }

    const href = '../styles/inventory-mobile.css';
    if (document.readyState === 'loading' && typeof document.write === 'function') {
      document.write(
        '<link rel="stylesheet" href="' + href + '" data-inventory-mobile-styles="true">'
      );
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.inventoryMobileStyles = 'true';
    link.setAttribute('blocking', 'render');
    document.head.appendChild(link);
  }

  loadInventoryMobileStylesBeforePaint();

  function loadBodyCuesStylesBeforePaint() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const pathname = window.location && typeof window.location.pathname === 'string'
      ? window.location.pathname
      : '';
    const isBodyCuesPath =
      pathname.endsWith('/feelings/body-cues/') ||
      pathname.endsWith('/feelings/body-cues/index.html');
    if (!isBodyCuesPath) {
      return;
    }

    const links = [
      {
        href: '../../styles/body-cues.css',
        id: 'body-cues-enhancements',
        marker: 'data-body-cues-base-styles',
      },
      {
        href: '../../styles/body-cues-mobile.css',
        id: '',
        marker: 'data-body-cues-mobile-styles',
      },
    ];

    links.forEach((entry) => {
      if (document.querySelector('link[' + entry.marker + ']')) {
        return;
      }

      const idAttribute = entry.id ? ' id="' + entry.id + '"' : '';
      if (document.readyState === 'loading' && typeof document.write === 'function') {
        document.write(
          '<link rel="stylesheet" href="' + entry.href + '"' + idAttribute + ' ' + entry.marker + '="true">'
        );
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = entry.href;
      if (entry.id) {
        link.id = entry.id;
      }
      link.setAttribute(entry.marker, 'true');
      link.setAttribute('blocking', 'render');
      document.head.appendChild(link);
    });
  }

  loadBodyCuesStylesBeforePaint();

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
