/**
 * platformDetect — lightweight platform & device capability detection.
 *
 * Used at engine initialization time to select appropriate render settings.
 * No external dependencies, no runtime cost after first call (results cached).
 */

let _isMobileCache: boolean | null = null;

/**
 * Returns true if the current device appears to be a mobile/tablet.
 *
 * Detection heuristics (ordered by reliability):
 *  1. maxTouchPoints > 1  — reliable for all modern touch devices
 *  2. User-agent string   — fallback for browsers that fake touch events
 */
export function isMobile(): boolean {
  if (_isMobileCache !== null) return _isMobileCache;

  if (typeof navigator === 'undefined') {
    _isMobileCache = false;
    return false;
  }

  const touchPoints = navigator.maxTouchPoints > 1;
  const ua = navigator.userAgent ?? '';
  const uaMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  _isMobileCache = touchPoints || uaMobile;
  return _isMobileCache;
}

/**
 * Returns the recommended hardware scaling level for the Babylon engine.
 *
 * Lower scaling = fewer pixels rendered = better performance.
 * A value of 1.0 = native resolution. 1.5 = 2/3 native (faster on retina screens).
 *
 * Strategy:
 *  - Desktop retina (DPR > 1.5):   scale = 1.0  (full DPR — desktops can handle it)
 *  - Mobile retina  (DPR > 1.5):   scale = 1.5  (renders at ~0.67 of native = ~50% fewer pixels)
 *  - Mobile standard (DPR ≤ 1.5):  scale = 1.0  (already low-res, no need to scale)
 *  - Desktop standard:              scale = 1.0
 */
export function getHardwareScaling(): number {
  if (typeof window === 'undefined') return 1.0;

  const dpr    = window.devicePixelRatio ?? 1;
  const mobile = isMobile();

  if (mobile && dpr > 1.5) {
    // Retina mobile: render at 2/3 of native → ~50% fewer pixels
    return 1.5;
  }

  return 1.0;
}

/**
 * Returns recommended particle count multiplier based on platform.
 *  1.0 = full quality (desktop)
 *  0.5 = half quality (low-end mobile)
 */
export function getParticleBudget(): number {
  if (!isMobile()) return 1.0;

  // Rough heuristic: high-end mobile (recent GPU) gets 0.7, lower devices get 0.5
  const cores = (navigator as any).hardwareConcurrency ?? 4;
  return cores >= 8 ? 0.7 : 0.5;
}
