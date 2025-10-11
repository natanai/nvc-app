const PLAN_STORAGE_KEY = 'needshare-care-plan';

const searchInput = document.getElementById('searchInput');
const itemList = document.getElementById('itemList');
const detailsEl = document.getElementById('detailsContent');
const planList = document.getElementById('planList');
const planMessageEl = document.getElementById('planMessage');
const datasetChoices = document.getElementById('datasetChoices');
const datasetButtons = datasetChoices ? datasetChoices.querySelectorAll('[data-dataset]') : [];
const panels = {
  datasets: document.querySelector('[data-panel="datasets"]'),
  list: document.querySelector('[data-panel="list"]'),
  details: document.querySelector('[data-panel="details"]'),
};
const listTitleEl = document.getElementById('listTitle');
const listDescriptionEl = document.getElementById('listDescription');
const detailsTitleEl = document.getElementById('detailsTitle');
const detailsDescriptionEl = document.getElementById('detailsDescription');
const backButtons = document.querySelectorAll('.back-button[data-back]');

const magnetRegistry = new WeakSet();
const MAGNET_DRAG_THRESHOLD = 6;

const state = {
  stage: 'datasets',
  dataset: null,
  searchTerm: '',
  selection: null,
  plan: [],
};

const datasetCopy = {
  feelings: {
    listTitle: 'Feelings on the surface',
    listDescription: 'Notice the sensations and emotional tones arriving for you right now.',
    detailsTitle: 'Tracing this feeling',
    detailsDescription:
      'Let the feeling guide you toward the needs underneath. Tap a linked need when you are ready to focus there.',
  },
  needs: {
    listTitle: 'Needs asking for care',
    listDescription: 'Listen for the essential need that longs to be heard and held.',
    detailsTitle: 'Listening to this need',
    detailsDescription:
      'Offer presence to this need and explore gentle strategies that could tend to it.',
  },
  situations: {
    listTitle: 'Situations unfolding',
    listDescription: 'Choose a situation that mirrors what is happening around or within you.',
    detailsTitle: 'Exploring this situation',
    detailsDescription:
      'Notice the feelings and needs that this situation awakens. Follow them to continue your exploration.',
  },
  strategies: {
    listTitle: 'Care strategies',
    listDescription: 'Gather practices that might nourish the needs you are tending.',
    detailsTitle: 'Practicing this strategy',
    detailsDescription:
      'Notice how this practice lands in your body and which needs it may support.',
  },
};

const disableTouchDragging = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(pointer: coarse)').matches
  : false;

const data = {
  feelings: [],
  needs: [],
  situations: [],
  strategies: [],
};

init();

async function init() {
  showLoadingState();
  try {
    const response = await fetch('data/index.json');
    if (!response.ok) {
      throw new Error(`Failed to load data (${response.status})`);
    }
    const payload = await response.json();
    Object.assign(data, payload);
    shuffleDatasets();
  } catch (error) {
    showErrorState(error);
    console.error(error);
    return;
  }

  state.plan = loadPlan();
  setStage('datasets');
  updateStageCopy();
  render();
  bindEvents();
}

function bindEvents() {
  datasetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      openDataset(button.dataset.dataset);
    });
  });

  backButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.back;
      if (target === 'datasets') {
        state.dataset = null;
        state.selection = null;
        state.searchTerm = '';
        if (searchInput) searchInput.value = '';
        setStage('datasets');
        updateStageCopy();
        render();
      } else if (target === 'list') {
        state.selection = null;
        setStage('list');
        updateStageCopy();
        render();
      }
    });
  });

  searchInput.addEventListener('input', (event) => {
    state.searchTerm = event.target.value;
    if (state.stage !== 'list') {
      setStage('list');
    }
    render();
  });

  itemList.addEventListener('click', (event) => {
    const button = event.target.closest('.item-button');
    if (!button) return;
    const { slug } = button.dataset;
    const selection = findItem(state.dataset, slug);
    if (!selection) return;
    state.selection = selection;
    setStage('details');
    updateStageCopy();
    render();
  });

  detailsEl.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (chip) {
      const targetDataset = chip.dataset.target;
      const { slug, title } = chip.dataset;
      openEntry(targetDataset, { slug, title });
      return;
    }

    const addButton = event.target.closest('[data-add-plan]');
    if (addButton) {
      addToPlan(addButton.dataset.addPlan);
    }
  });

  planList.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove]');
    if (!removeButton) return;
    removeFromPlan(removeButton.dataset.remove);
  });
}

function showLoadingState() {
  detailsEl.innerHTML = '';
  const message = document.createElement('div');
  message.className = 'details__empty';
  message.textContent = 'Loading data…';
  detailsEl.appendChild(message);
}

function showErrorState(error) {
  detailsEl.innerHTML = '';
  const message = document.createElement('div');
  message.className = 'details__empty';
  message.textContent = 'We were not able to load the data set. Please refresh to try again.';
  const hint = document.createElement('p');
  hint.className = 'details__description';
  hint.textContent = error?.message ?? 'Unknown error';
  detailsEl.append(message, hint);
}

function setStage(stage) {
  if (!panels[stage]) return;
  state.stage = stage;
  updatePanels();
}

function updatePanels() {
  Object.entries(panels).forEach(([stage, element]) => {
    if (!element) return;
    const isActive = state.stage === stage;
    element.hidden = !isActive;
    element.setAttribute('data-active', String(isActive));
  });
}

function updateStageCopy() {
  const copy = datasetCopy[state.dataset] ?? null;
  if (listTitleEl) {
    listTitleEl.textContent = copy?.listTitle ?? 'Browse magnets';
  }
  if (listDescriptionEl) {
    listDescriptionEl.textContent = copy?.listDescription ?? 'Select a magnet that resonates right now.';
  }
  if (detailsTitleEl) {
    detailsTitleEl.textContent = copy?.detailsTitle ?? 'Magnet details';
  }
  if (detailsDescriptionEl) {
    detailsDescriptionEl.textContent =
      copy?.detailsDescription ?? 'Follow the threads to discover the need asking for care.';
  }
}

function openDataset(dataset) {
  if (!data[dataset]) return;
  state.dataset = dataset;
  state.searchTerm = '';
  state.selection = null;
  if (searchInput) searchInput.value = '';
  setStage('list');
  updateStageCopy();
  render();
}

function openEntry(dataset, { slug, title } = {}) {
  if (!data[dataset]) return;
  state.dataset = dataset;
  state.searchTerm = '';
  if (searchInput) searchInput.value = '';
  state.selection = slug || title ? findItem(dataset, slug, title) ?? null : null;
  setStage(state.selection ? 'details' : 'list');
  updateStageCopy();
  render();
}

function render() {
  updatePanels();
  updateStageCopy();

  if (state.stage === 'datasets') {
    itemList.innerHTML = '';
    detailsEl.innerHTML = '';
  } else {
    const filtered = renderList();
    if (state.stage === 'details') {
      renderDetails(filtered);
    } else {
      detailsEl.innerHTML = '';
    }
  }

  renderPlan();
  activateMagnets(document);
}

function shuffleDatasets() {
  ['feelings', 'needs', 'situations', 'strategies'].forEach((key) => {
    if (!Array.isArray(data[key])) return;
    data[key] = shuffleArray(data[key]);
  });
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function renderList() {
  if (!state.dataset) {
    itemList.innerHTML = '';
    return [];
  }

  itemList.innerHTML = '';
  const datasetItems = data[state.dataset] ?? [];
  const filtered = datasetItems.filter((item) => matchesSearch(item, state.dataset, state.searchTerm));

  if (filtered.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'item-list__empty';
    empty.textContent = 'No matches found. Adjust your search or choose another data set.';
    itemList.appendChild(empty);
    if (state.stage !== 'details') {
      state.selection = null;
    }
    activateMagnets(itemList);
    return filtered;
  }

  const currentSlug = state.selection?.slug;
  const selectionStillVisible = currentSlug
    ? filtered.some((entry) => entry.slug === currentSlug)
    : false;

  if (!selectionStillVisible && state.stage !== 'details') {
    state.selection = null;
  }

  filtered.forEach((item) => {
    const listItem = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'item-button magnet';
    button.dataset.slug = item.slug;
    button.dataset.magnet = state.dataset;
    button.dataset.magnetKey = createMagnetKey(`list-${state.dataset}`, item.slug ?? item.title);

    const isSelected = state.selection && state.selection.slug === item.slug;
    if (isSelected) {
      button.classList.add('is-active');
    }
    button.setAttribute('aria-pressed', String(Boolean(isSelected)));

    const title = document.createElement('span');
    title.className = 'item-title';
    title.textContent = item.title;
    button.appendChild(title);

    const metaText = getItemMeta(item, state.dataset);
    if (metaText) {
      if (state.dataset === 'needs') {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = metaText;
        button.appendChild(badge);
      } else {
        const meta = document.createElement('span');
        meta.className = 'item-meta';
        meta.textContent = metaText;
        button.appendChild(meta);
      }
    }

    listItem.appendChild(button);
    itemList.appendChild(listItem);
  });

  activateMagnets(itemList);
  return filtered;
}

function renderDetails(filteredItems = []) {
  detailsEl.innerHTML = '';

  if (!state.selection) {
    const empty = document.createElement('div');
    empty.className = 'details__empty';
    empty.textContent = filteredItems && filteredItems.length === 0
      ? 'No entries match your current search.'
      : 'Choose a magnet to explore its connections.';
    detailsEl.appendChild(empty);
    activateMagnets(detailsEl);
    return;
  }

  const dataset = state.dataset;
  if (dataset === 'feelings') {
    renderFeelingDetails(state.selection);
  } else if (dataset === 'needs') {
    renderNeedDetails(state.selection);
  } else if (dataset === 'situations') {
    renderSituationDetails(state.selection);
  } else if (dataset === 'strategies') {
    renderStrategyDetails(state.selection);
  }

  activateMagnets(detailsEl);
}

function renderFeelingDetails(item) {
  const container = document.createElement('article');

  const heading = document.createElement('h2');
  heading.textContent = item.title;
  container.appendChild(heading);

  appendDescription(container, item.description, {
    emptyMessage: 'Notice how this feeling shows up in your body or story. The needs below may offer clues about what wants care.',
  });

  const situationsGroup = createDetailGroup('Common situations', item.situations, 'situations');
  if (situationsGroup) container.appendChild(situationsGroup);

  const needsGroup = createDetailGroup('Needs that might be alive', item.needs, 'needs');
  if (needsGroup) container.appendChild(needsGroup);

  const note = document.createElement('p');
  note.className = 'details__description';
  note.textContent = 'Tap a need or situation to continue tracing the web of care.';
  container.appendChild(note);

  detailsEl.appendChild(container);
}

function renderNeedDetails(item) {
  const container = document.createElement('article');

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.flexWrap = 'wrap';
  header.style.alignItems = 'center';
  header.style.gap = '0.75rem';

  const heading = document.createElement('h2');
  heading.textContent = item.title;
  header.appendChild(heading);

  if (item.category) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = item.category;
    header.appendChild(badge);
  }

  container.appendChild(header);

  appendDescription(container, item.description, {
    emptyMessage: 'This need is calling for attention. Offer it presence and explore the strategies below for gentle support.',
  });

  const strategySection = document.createElement('section');
  strategySection.className = 'detail-group';

  const strategyTitle = document.createElement('span');
  strategyTitle.className = 'detail-group__title';
  strategyTitle.textContent = 'Care strategies to experiment with';
  strategySection.appendChild(strategyTitle);

  const strategies = resolveEntries(item.strategies, 'strategies');
  if (strategies.length === 0) {
    const placeholder = document.createElement('p');
    placeholder.className = 'details__description';
    placeholder.textContent = 'No strategies have been linked yet. Explore nearby magnets to discover practices that resonate.';
    strategySection.appendChild(placeholder);
  } else {
    strategySection.appendChild(createStrategyCarousel(strategies));
  }

  container.appendChild(strategySection);
  detailsEl.appendChild(container);
}

function renderSituationDetails(item) {
  const container = document.createElement('article');

  const heading = document.createElement('h2');
  heading.textContent = item.title;
  container.appendChild(heading);

  appendDescription(container, '', {
    emptyMessage: 'Situations can stir a mosaic of feelings. Follow the threads below to learn what those feelings are pointing toward.',
  });

  const feelingsGroup = createDetailGroup('Feelings you might notice', item.feelings, 'feelings');
  if (feelingsGroup) container.appendChild(feelingsGroup);

  const needsGroup = createDetailGroup('Needs requesting attention', item.needs, 'needs');
  if (needsGroup) container.appendChild(needsGroup);

  detailsEl.appendChild(container);
}

function renderStrategyDetails(item) {
  const container = document.createElement('article');

  const heading = document.createElement('h2');
  heading.textContent = item.title;
  container.appendChild(heading);

  appendDescription(container, item.description, {
    emptyMessage: 'This practice is waiting for your unique spin. Offer yourself gentleness as you try it.',
  });

  const actionRow = document.createElement('div');
  const addButton = document.createElement('button');
  addButton.type = 'button';
  const alreadyInPlan = planContains(item.slug);
  addButton.className = 'button-primary';
  addButton.dataset.addPlan = item.slug;
  addButton.textContent = alreadyInPlan ? 'In your care plan' : 'Add to care plan';
  addButton.disabled = alreadyInPlan;
  addButton.dataset.ignoreDrag = 'true';
  actionRow.appendChild(addButton);
  container.appendChild(actionRow);

  const needsGroup = createDetailGroup('Needs supported by this strategy', item.needs, 'needs');
  if (needsGroup) container.appendChild(needsGroup);

  detailsEl.appendChild(container);
}

function appendDescription(container, text, { emptyMessage }) {
  const content = (text || '').trim();
  if (content) {
    const paragraphs = content.split(/\n+/).filter(Boolean);
    paragraphs.forEach((paragraph) => {
      const p = document.createElement('p');
      p.className = 'details__description';
      p.textContent = paragraph.trim();
      container.appendChild(p);
    });
  } else if (emptyMessage) {
    const fallback = document.createElement('p');
    fallback.className = 'details__description';
    fallback.textContent = emptyMessage;
    container.appendChild(fallback);
  }
}

function createDetailGroup(label, entries, targetDataset) {
  if (!entries || entries.length === 0) return null;
  const validEntries = entries.filter((entry) => entry && entry.title);
  if (validEntries.length === 0) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'detail-group';

  const title = document.createElement('span');
  title.className = 'detail-group__title';
  title.textContent = label;
  wrapper.appendChild(title);

  const chipContainer = document.createElement('div');
  chipContainer.className = 'chip-group';

  validEntries.forEach((entry) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip magnet';
    chip.textContent = entry.title;
    chip.dataset.target = targetDataset;
    if (entry.slug) chip.dataset.slug = entry.slug;
    chip.dataset.title = entry.title;
    chip.dataset.magnet = targetDataset;
    chip.dataset.magnetKey = createMagnetKey(`chip-${targetDataset}`, entry.slug ?? entry.title);
    chipContainer.appendChild(chip);
  });

  wrapper.appendChild(chipContainer);
  return wrapper;
}

function createStrategyCard(strategy) {
  const card = document.createElement('li');
  card.className = 'strategy-card magnet';
  card.dataset.magnet = 'strategies';
  card.dataset.magnetKey = createMagnetKey('strategy', strategy.slug ?? strategy.title);

  const title = document.createElement('h3');
  title.textContent = strategy.title;
  card.appendChild(title);

  const description = document.createElement('p');
  description.textContent = strategy.description || 'No description provided yet.';
  card.appendChild(description);

  const alreadyInPlan = planContains(strategy.slug);

  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'button-primary';
  action.dataset.addPlan = strategy.slug;
  action.textContent = alreadyInPlan ? 'In your care plan' : 'Add to care plan';
  action.disabled = alreadyInPlan;
  action.dataset.ignoreDrag = 'true';

  card.appendChild(action);
  return card;
}

function createStrategyCarousel(strategies) {
  const wrapper = document.createElement('div');
  wrapper.className = 'strategy-carousel';

  const track = document.createElement('ul');
  track.className = 'strategy-carousel__track';

  strategies.forEach((strategy) => {
    track.appendChild(createStrategyCard(strategy));
  });

  if (strategies.length > 1) {
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'carousel-nav';
    prev.dataset.ignoreDrag = 'true';
    prev.setAttribute('aria-label', 'Scroll strategies left');
    prev.textContent = '←';
    prev.addEventListener('click', () => scrollCarousel(track, -1));

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'carousel-nav';
    next.dataset.ignoreDrag = 'true';
    next.setAttribute('aria-label', 'Scroll strategies right');
    next.textContent = '→';
    next.addEventListener('click', () => scrollCarousel(track, 1));

    wrapper.append(prev, track, next);
  } else {
    wrapper.appendChild(track);
  }

  return wrapper;
}

function scrollCarousel(track, direction) {
  if (!track) return;
  const distance = track.clientWidth * 0.8 * direction;
  track.scrollBy({ left: distance, behavior: 'smooth' });
}

function renderPlan() {
  planList.innerHTML = '';

  if (!state.plan || state.plan.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'plan-empty';
    empty.textContent = 'No strategies saved yet. As you explore, add practices that resonate.';
    planList.appendChild(empty);
    activateMagnets(planList);
    return;
  }

  state.plan.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'plan-item magnet';
    item.dataset.magnet = 'strategies';
    item.dataset.magnetKey = createMagnetKey('plan', entry.slug ?? entry.title);

    const info = document.createElement('div');

    const title = document.createElement('h3');
    title.textContent = entry.title;
    info.appendChild(title);

    if (entry.description) {
      const description = document.createElement('p');
      description.textContent = truncate(entry.description, 160);
      info.appendChild(description);
    }

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'plan-remove';
    remove.dataset.remove = entry.slug;
    remove.textContent = 'Remove';
    remove.dataset.ignoreDrag = 'true';

    item.append(info, remove);
    planList.appendChild(item);
  });

  activateMagnets(planList);
}

function addToPlan(slug) {
  if (!slug) return;
  const strategy = findItem('strategies', slug);
  if (!strategy) {
    showPlanMessage('Strategy not found.');
    return;
  }

  if (planContains(strategy.slug)) {
    showPlanMessage(`${strategy.title} is already saved.`);
    return;
  }

  state.plan.push({
    slug: strategy.slug,
    title: strategy.title,
    description: strategy.description,
  });
  savePlan();
  renderPlan();
  renderDetails();
  showPlanMessage(`${strategy.title} added to your care plan.`);
}

function removeFromPlan(slug) {
  const index = state.plan.findIndex((entry) => entry.slug === slug);
  if (index === -1) return;
  const [removed] = state.plan.splice(index, 1);
  savePlan();
  renderPlan();
  renderDetails();
  showPlanMessage(`${removed.title} removed from your care plan.`);
}

function planContains(slug) {
  return state.plan.some((entry) => entry.slug === slug);
}

function showPlanMessage(text) {
  if (!planMessageEl) return;
  planMessageEl.textContent = text;
}

function loadPlan() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const stored = localStorage.getItem(PLAN_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        slug: String(entry.slug ?? ''),
        title: String(entry.title ?? ''),
        description: entry.description ? String(entry.description) : '',
      }))
      .filter((entry) => entry.slug && entry.title);
  } catch (error) {
    console.warn('Unable to load plan from storage', error);
    return [];
  }
}

function savePlan() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(state.plan));
  } catch (error) {
    console.warn('Unable to persist plan', error);
  }
}

function activateMagnets(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('.magnet').forEach((element) => {
    const { x, y } = getMagnetOffset(element);
    setMagnetOffset(element, x, y);

    if (magnetRegistry.has(element)) return;

    makeMagnetDraggable(element);
    magnetRegistry.add(element);
  });
}

function makeMagnetDraggable(element) {
  let { x: currentX, y: currentY } = getMagnetOffset(element);

  const onPointerDown = (event) => {
    if (disableTouchDragging && event.pointerType === 'touch') return;
    if (event.button !== 0 && event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    if (element.hasAttribute('disabled')) return;
    if (event.target.closest('[data-ignore-drag]')) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = parseFloat(element.dataset.offsetX || '0');
    const originY = parseFloat(element.dataset.offsetY || '0');
    let dragging = false;
    const pointerId = event.pointerId;

    element.setPointerCapture?.(pointerId);

    const onPointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (!dragging) {
        if (Math.abs(deltaX) + Math.abs(deltaY) < MAGNET_DRAG_THRESHOLD) {
          return;
        }
        dragging = true;
        element.classList.add('magnet--dragging');
      }

      currentX = originX + deltaX;
      currentY = originY + deltaY;
      setMagnetOffset(element, currentX, currentY);
      resolveMagnetCollisions(element);
    };

    const onPointerUp = () => {
      element.releasePointerCapture?.(pointerId);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);

      if (dragging) {
        element.classList.remove('magnet--dragging');
        element.dataset.justDragged = 'true';
        resolveMagnetCollisions(element);
        requestAnimationFrame(() => {
          element.dataset.justDragged = 'false';
        });
      } else {
        element.classList.remove('magnet--dragging');
      }
    };

    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);
  };

  element.addEventListener('pointerdown', onPointerDown);

  element.addEventListener('click', (event) => {
    if (element.dataset.justDragged === 'true') {
      event.preventDefault();
      event.stopImmediatePropagation();
      element.dataset.justDragged = 'false';
    }
  });
}

function createMagnetKey(prefix, raw) {
  const sanitized = sanitizeKey(raw);
  return `${prefix}-${sanitized || 'magnet'}`;
}

function getMagnetOffset(element) {
  const offsetX = Number.parseFloat(element?.dataset?.offsetX ?? '0');
  const offsetY = Number.parseFloat(element?.dataset?.offsetY ?? '0');
  return {
    x: Number.isFinite(offsetX) ? offsetX : 0,
    y: Number.isFinite(offsetY) ? offsetY : 0,
  };
}

function setMagnetOffset(element, x, y) {
  const nextX = Number.isFinite(x) ? x : 0;
  const nextY = Number.isFinite(y) ? y : 0;
  element.dataset.offsetX = String(nextX);
  element.dataset.offsetY = String(nextY);
  element.style.transform = `translate(${nextX}px, ${nextY}px)`;
}

function adjustMagnetOffset(element, deltaX, deltaY) {
  const { x, y } = getMagnetOffset(element);
  setMagnetOffset(element, x + deltaX, y + deltaY);
}

function resolveMagnetCollisions(activeMagnet) {
  if (!activeMagnet || typeof activeMagnet.getBoundingClientRect !== 'function') return;

  const magnets = Array.from(document.querySelectorAll('.magnet'));
  const visited = new Set();
  const queue = [activeMagnet];
  let guard = 0;

  while (queue.length && guard < 100) {
    guard += 1;
    const magnet = queue.shift();
    if (!magnet || visited.has(magnet)) continue;
    visited.add(magnet);

    const rectA = magnet.getBoundingClientRect();

    magnets.forEach((other) => {
      if (other === magnet) return;
      const rectB = other.getBoundingClientRect();
      const overlapX = Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left);
      const overlapY = Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top);
      if (overlapX <= 0 || overlapY <= 0) return;

      const centerAX = rectA.left + rectA.width / 2;
      const centerAY = rectA.top + rectA.height / 2;
      const centerBX = rectB.left + rectB.width / 2;
      const centerBY = rectB.top + rectB.height / 2;

      let pushX = 0;
      let pushY = 0;

      if (overlapX < overlapY) {
        const directionX = centerBX === centerAX ? randomDirection() : Math.sign(centerBX - centerAX);
        pushX = overlapX * directionX;
      } else {
        const directionY = centerBY === centerAY ? randomDirection() : Math.sign(centerBY - centerAY);
        pushY = overlapY * directionY;
      }

      adjustMagnetOffset(other, pushX, pushY);
      if (!visited.has(other)) {
        queue.push(other);
      }
    });
  }
}

function randomDirection() {
  return Math.random() > 0.5 ? 1 : -1;
}

function sanitizeKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function matchesSearch(item, dataset, term) {
  const needle = (term || '').toLowerCase().trim();
  if (!needle) return true;

  const parts = [item.title, item.description];
  if (dataset === 'needs') parts.push(item.category);

  if (Array.isArray(item.needs)) {
    parts.push(...item.needs.map((entry) => entry.title));
  }
  if (Array.isArray(item.feelings)) {
    parts.push(...item.feelings.map((entry) => entry.title));
  }
  if (Array.isArray(item.situations)) {
    parts.push(...item.situations.map((entry) => entry.title));
  }
  if (Array.isArray(item.strategies)) {
    parts.push(...item.strategies.map((entry) => entry.title));
  }

  return parts.filter(Boolean).some((value) => value.toLowerCase().includes(needle));
}

function getItemMeta(item, dataset) {
  if (dataset === 'feelings') {
    return `${item.needs?.length ?? 0} needs • ${item.situations?.length ?? 0} situations`;
  }
  if (dataset === 'needs') {
    return item.category || '';
  }
  if (dataset === 'situations') {
    return `${item.feelings?.length ?? 0} feelings • ${item.needs?.length ?? 0} needs`;
  }
  if (dataset === 'strategies') {
    return truncate(item.description, 90);
  }
  return '';
}

function findItem(dataset, slug, title) {
  const items = data[dataset] ?? [];
  if (slug) {
    const bySlug = items.find((entry) => entry.slug === slug);
    if (bySlug) return bySlug;
  }
  if (title) {
    const normalized = title.toLowerCase();
    return items.find((entry) => entry.title.toLowerCase() === normalized) ?? null;
  }
  return null;
}

function resolveEntries(entries, dataset) {
  if (!entries) return [];
  return entries
    .map((entry) => findItem(dataset, entry.slug, entry.title))
    .filter(Boolean);
}

function truncate(text, max = 120) {
  if (!text) return '';
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}
