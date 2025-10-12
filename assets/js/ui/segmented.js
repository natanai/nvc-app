(function () {
  const SEGMENTED_SELECTOR = '.segmented';

  function getButtons(root) {
    return Array.from(root.querySelectorAll('button[role="radio"]'));
  }

  function getButtonValue(button) {
    if (!button) return null;
    return button.dataset.value ?? button.value ?? button.textContent?.trim() ?? null;
  }

  function setActive(root, buttons, nextIndex, options = {}) {
    if (!buttons.length) return;
    const clampedIndex = Math.max(0, Math.min(nextIndex, buttons.length - 1));
    const activeButton = buttons[clampedIndex];
    buttons.forEach((button, index) => {
      const isActive = index === clampedIndex;
      button.setAttribute('aria-checked', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
      button.classList.toggle('is-active', isActive);
    });
    root.dataset.segmentedIndex = String(clampedIndex);
    const detail = {
      index: clampedIndex,
      value: getButtonValue(activeButton),
      button: activeButton,
    };
    root.dispatchEvent(
      new CustomEvent('segmentedchange', {
        bubbles: true,
        detail,
      })
    );
    if (options.focus !== false) {
      activeButton?.focus();
    }
  }

  function moveFocus(root, buttons, delta) {
    if (!buttons.length) return;
    const currentIndex = Number.parseInt(root.dataset.segmentedIndex ?? '0', 10) || 0;
    const nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
    setActive(root, buttons, nextIndex);
  }

  function handleClick(event) {
    const button = event.target.closest('button[role="radio"]');
    if (!button) return;
    const root = button.closest(SEGMENTED_SELECTOR);
    if (!root) return;
    const buttons = getButtons(root);
    const index = buttons.indexOf(button);
    if (index === -1) return;
    setActive(root, buttons, index, { focus: false });
    button.focus();
  }

  function handleKeyDown(event) {
    const root = event.currentTarget;
    if (!(root instanceof HTMLElement)) {
      return;
    }
    const buttons = getButtons(root);
    if (!buttons.length) return;
    const { key } = event;
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(root, buttons, 1);
    } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(root, buttons, -1);
    } else if (key === 'Home') {
      event.preventDefault();
      setActive(root, buttons, 0);
    } else if (key === 'End') {
      event.preventDefault();
      setActive(root, buttons, buttons.length - 1);
    } else if (key === ' ' || key === 'Enter') {
      const button = document.activeElement;
      if (!root.contains(button)) return;
      event.preventDefault();
      const index = buttons.indexOf(button);
      if (index >= 0) {
        setActive(root, buttons, index, { focus: false });
        buttons[index].focus();
      }
    }
  }

  function ensureSingleSelection(buttons) {
    let activeIndex = buttons.findIndex((button) => button.getAttribute('aria-checked') === 'true');
    if (activeIndex === -1) {
      activeIndex = 0;
    }
    buttons.forEach((button, index) => {
      const isActive = index === activeIndex;
      button.setAttribute('aria-checked', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
      button.classList.toggle('is-active', isActive);
    });
    return activeIndex;
  }

  function initSegmented(root) {
    if (!(root instanceof HTMLElement)) return;
    if (root.dataset.segmentedReady === '1') return;
    const buttons = getButtons(root);
    if (!buttons.length) return;
    const activeIndex = ensureSingleSelection(buttons);
    root.dataset.segmentedReady = '1';
    root.dataset.segmentedIndex = String(activeIndex);
    root.addEventListener('click', handleClick);
    root.addEventListener('keydown', handleKeyDown);
  }

  function initAll() {
    document.querySelectorAll(SEGMENTED_SELECTOR).forEach((root) => initSegmented(root));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  window.NVCSegmented = {
    init: initSegmented,
    initAll,
  };
})();
