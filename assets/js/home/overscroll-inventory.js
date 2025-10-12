(function () {
  const body = document.body;
  if (!body) {
    return;
  }

  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const isTouchCapable =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || (nav && nav.maxTouchPoints > 0));
  if (!isTouchCapable) {
    return;
  }

  const basePath = body.getAttribute('data-base-path') || '';
  const TRIGGER_DISTANCE = 420;
  const stageThresholds = [90, 180, 270, 360, TRIGGER_DISTANCE];
  const stageMessages = [
    'Click…',
    'Click… click…',
    'Tension rising…',
    'Almost there…',
    'Release to visit your inventory',
  ];

  const indicator = createIndicator();
  if (!indicator) {
    return;
  }

  let tracking = false;
  let startY = 0;
  let maxPull = 0;
  let currentStage = -1;
  let lastPromptTime = 0;
  const PROMPT_COOLDOWN = 4000;

  function atBottom() {
    return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  }

  function createIndicator() {
    const el = document.createElement('div');
    el.className = 'inventory-spring';
    el.innerHTML = `
      <div class="inventory-spring__meter" aria-hidden="true">
        <div class="inventory-spring__meter-bar"></div>
      </div>
      <span class="inventory-spring__label" role="status" aria-live="polite"></span>
    `;
    body.appendChild(el);
    const label = el.querySelector('.inventory-spring__label');
    if (!label) {
      el.remove();
      return null;
    }
    return {
      root: el,
      label,
    };
  }

  function resetIndicator() {
    indicator.root.classList.remove('inventory-spring--active', 'inventory-spring--charged');
    indicator.root.style.setProperty('--inventory-spring-progress', '0');
    indicator.label.textContent = '';
    maxPull = 0;
    currentStage = -1;
    tracking = false;
  }

  function updateIndicator(distance) {
    const progress = Math.min(distance / TRIGGER_DISTANCE, 1);
    indicator.root.style.setProperty('--inventory-spring-progress', progress.toString());
    indicator.root.classList.toggle('inventory-spring--charged', progress >= 0.85);

    let stageIndex = 0;
    for (let i = 0; i < stageThresholds.length; i += 1) {
      if (distance >= stageThresholds[i]) {
        stageIndex = Math.min(i + 1, stageMessages.length - 1);
      } else {
        break;
      }
    }

    if (stageIndex !== currentStage) {
      indicator.label.textContent = stageMessages[stageIndex];
      currentStage = stageIndex;
    }
  }

  function handleStart(event) {
    if (event.touches.length !== 1) {
      return;
    }

    if (!atBottom()) {
      tracking = false;
      return;
    }

    tracking = true;
    startY = event.touches[0].clientY;
    maxPull = 0;
    currentStage = -1;
    indicator.root.classList.add('inventory-spring--active');
    indicator.label.textContent = stageMessages[0];
  }

  function handleMove(event) {
    if (!tracking) {
      return;
    }

    const touch = event.touches[0];
    const pull = Math.max(0, startY - touch.clientY);

    if (pull === 0) {
      if (!atBottom()) {
        resetIndicator();
      }
      return;
    }

    if (!atBottom()) {
      resetIndicator();
      return;
    }

    maxPull = Math.max(maxPull, pull);
    updateIndicator(maxPull);

    if (maxPull >= TRIGGER_DISTANCE) {
      event.preventDefault();
    }
  }

  function handleEnd() {
    if (!tracking) {
      return;
    }

    const now = Date.now();
    const eligibleForPrompt = now - lastPromptTime > PROMPT_COOLDOWN;

    if (maxPull >= TRIGGER_DISTANCE && eligibleForPrompt) {
      lastPromptTime = now;
      const confirmJump = window.confirm('Warp straight to your inventory?');
      resetIndicator();
      if (confirmJump) {
        window.location.href = basePath + 'inventory/';
      }
      return;
    }

    resetIndicator();
  }

  window.addEventListener('touchstart', handleStart, { passive: true });
  window.addEventListener('touchmove', handleMove, { passive: false });
  window.addEventListener('touchend', handleEnd, { passive: true });
  window.addEventListener('touchcancel', handleEnd, { passive: true });
})();
