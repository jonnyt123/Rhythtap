(() => {
  const STORAGE_KEY = 'rhythtap-show-fps';
  const POLL_MS = 500;
  let enabled = localStorage.getItem(STORAGE_KEY) === '1';
  let overlay = null;

  const injectStyles = () => {
    if (document.getElementById('rhythtap-perf-styles')) return;
    const style = document.createElement('style');
    style.id = 'rhythtap-perf-styles';
    style.textContent = `
      .perf-setting{margin-top:12px}
      .perf-setting .perf-toggle{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;min-height:58px;padding:12px 14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.045);color:inherit;text-align:left}
      .perf-setting .perf-toggle span{display:grid;gap:2px}
      .perf-setting .perf-toggle strong{font:800 12px/1.1 Inter,system-ui,sans-serif;letter-spacing:.08em}
      .perf-setting .perf-toggle small{opacity:.58;font-size:11px}
      .perf-setting .perf-toggle b{min-width:48px;padding:7px 9px;border-radius:999px;background:rgba(255,255,255,.08);font:800 10px/1 Inter,system-ui,sans-serif;text-align:center;letter-spacing:.08em}
      .perf-setting .perf-toggle[aria-pressed="true"]{border-color:rgba(41,242,255,.42);background:rgba(41,242,255,.08)}
      .perf-setting .perf-toggle[aria-pressed="true"] b{background:#29f2ff;color:#031014}
      #rhythtap-fps-overlay{position:fixed;z-index:9998;top:calc(env(safe-area-inset-top,0px) + 8px);left:50%;transform:translateX(-50%);display:none;align-items:center;gap:8px;padding:6px 10px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(4,7,13,.76);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;font:800 10px/1.1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;pointer-events:none;box-shadow:0 6px 24px rgba(0,0,0,.28)}
      #rhythtap-fps-overlay.visible{display:flex}
      #rhythtap-fps-overlay .fps-value{color:#29f2ff}
      #rhythtap-fps-overlay .frame-value{color:rgba(255,255,255,.72)}
      #rhythtap-fps-overlay.slow .fps-value{color:#ffb347}
      @media (prefers-reduced-transparency: reduce){#rhythtap-fps-overlay{backdrop-filter:none;-webkit-backdrop-filter:none;background:#080b12}}
    `;
    document.head.appendChild(style);
  };

  const ensureOverlay = () => {
    if (overlay && document.body.contains(overlay)) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'rhythtap-fps-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'off');
    overlay.innerHTML = '<span class="fps-value">FPS --</span><span class="frame-value">-- ms</span>';
    document.body.appendChild(overlay);
    return overlay;
  };

  const setEnabled = (next) => {
    enabled = next;
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    const button = document.querySelector('.perf-setting .perf-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(enabled));
      const state = button.querySelector('b');
      if (state) state.textContent = enabled ? 'ON' : 'OFF';
    }
    updateOverlay();
  };

  const ensureSettingsToggle = () => {
    const settings = document.querySelector('.settingsPage');
    if (!settings || settings.querySelector('.perf-setting')) return;
    const graphics = settings.querySelector('.graphics-setting');
    if (!graphics) return;

    const section = document.createElement('div');
    section.className = 'graphics-setting perf-setting';
    section.innerHTML = `
      <div class="theme-heading">
        <div><strong>PERFORMANCE MONITOR</strong><small>Show live FPS and frame time during songs</small></div>
        <span>TESTING</span>
      </div>
      <button class="perf-toggle" type="button" aria-pressed="${enabled}">
        <span><strong>FPS COUNTER</strong><small>Uses the game's existing telemetry</small></span>
        <b>${enabled ? 'ON' : 'OFF'}</b>
      </button>
    `;
    const button = section.querySelector('.perf-toggle');
    button.addEventListener('click', () => setEnabled(!enabled));
    graphics.insertAdjacentElement('afterend', section);
  };

  const updateOverlay = () => {
    const node = ensureOverlay();
    const inGame = Boolean(document.querySelector('.game.screen'));
    node.classList.toggle('visible', enabled && inGame);
    if (!enabled || !inGame) return;

    let data = null;
    try {
      data = JSON.parse(document.documentElement.dataset.gamePerf || 'null');
    } catch {
      data = null;
    }

    const fps = Number(data?.fps);
    const p95 = Number(data?.p95Ms);
    node.querySelector('.fps-value').textContent = Number.isFinite(fps) ? `FPS ${fps.toFixed(1)}` : 'FPS --';
    node.querySelector('.frame-value').textContent = Number.isFinite(p95) ? `${p95.toFixed(1)} ms p95` : '-- ms';
    node.classList.toggle('slow', Number.isFinite(fps) && fps < 50);
  };

  injectStyles();
  ensureOverlay();
  window.setInterval(() => {
    ensureSettingsToggle();
    updateOverlay();
  }, POLL_MS);
})();
