// Touch erkennen (wie im Entwurf): Klasse `touch` an <html>. Beim Start entscheidet das Gerät (grober Zeiger, oder
// Touch ohne Hover), danach die zuletzt benutzte Eingabe: Antippen schaltet sie ein, Pfeiltasten oder WASD (nicht in
// einem Eingabefeld) aus. Daran hängen Steuerkreuz und Handwahl (CSS `html:not(.touch) .touch-only`).

const TOUCH_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D']);

export function watchTouch(signal: AbortSignal): void {
  let on =
    matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);
  const apply = () => document.documentElement.classList.toggle('touch', on);
  apply();
  addEventListener(
    'pointerdown',
    (e) => {
      if ((e.pointerType === 'touch' || e.pointerType === 'pen') && !on) {
        on = true;
        apply();
      }
    },
    { capture: true, signal },
  );
  addEventListener(
    'keydown',
    (e) => {
      const field = e.target instanceof Element && e.target.closest('input, textarea, select');
      if (on && TOUCH_KEYS.has(e.key) && !field) {
        on = false;
        apply();
      }
    },
    { capture: true, signal },
  );
}
