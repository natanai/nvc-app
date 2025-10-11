const PLAN_STORAGE_KEY = 'needshare-care-plan';

const datasetTabs = document.querySelectorAll('.dataset-tab');
const searchInput = document.getElementById('searchInput');
const itemList = document.getElementById('itemList');
const detailsEl = document.getElementById('detailsContent');
const planList = document.getElementById('planList');
const planMessageEl = document.getElementById('planMessage');

const state = {
  dataset: 'feelings',
  searchTerm: '',
  selection: null,
  plan: [],
};

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
  } catch (error) {
    showErrorState(error);
    console.error(error);
    return;
  }

  state.plan = loadPlan();
  setDataset('feelings');
  bindEvents();
  render();
}

function bindEvents() {
  datasetTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      setDataset(tab.dataset.dataset);
    });
  });

  searchInput.addEventListener('input', (event) => {
    state.searchTerm = event.target.value;
    render();
  });

  itemList.addEventListener('click', (event) => {
    const button = event.target.closest('.item-button');
    if (!button) return;
    const { slug } = button.dataset;
    const selection = findItem(state.dataset, slug);
    if (!selection) return;
    state.selection = selection;
    render();
  });

  detailsEl.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (chip) {
      const targetDataset = chip.dataset.target;
      const { slug, title } = chip.dataset;
      setDataset(targetDataset, { slug, title });
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

function setDataset(dataset, { slug, title } = {}) {
  if (!data[dataset]) return;
  state.dataset = dataset;
  state.searchTerm = '';
  searchInput.value = '';
  state.selection = findItem(dataset, slug, title) ?? data[dataset][0] ?? null;
  render();
}

function render() {
  updateTabs();
  const filtered = renderList();
  renderDetails(filtered);
  renderPlan();
}

function updateTabs() {
  datasetTabs.forEach((tab) => {
    const isActive = tab.dataset.dataset === state.dataset;
    tab.setAttribute('aria-selected', String(isActive));
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
  });
}

function renderList() {
  itemList.innerHTML = '';
  const datasetItems = data[state.dataset] ?? [];
  const filtered = datasetItems.filter((item) => matchesSearch(item, state.dataset, state.searchTerm));

  if (filtered.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'item-list__empty';
    empty.textContent = 'No matches found. Adjust your search or choose another data set.';
    itemList.appendChild(empty);
    state.selection = null;
    return filtered;
  }

  if (!state.selection || !filtered.some((entry) => entry.slug === state.selection.slug)) {
    state.selection = filtered[0];
  }

  filtered.forEach((item) => {
    const listItem = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'item-button';
    button.dataset.slug = item.slug;

    if (state.selection && state.selection.slug === item.slug) {
      button.classList.add('is-active');
    }

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

  return filtered;
}

function renderDetails(filteredItems) {
  detailsEl.innerHTML = '';

  if (!state.selection) {
    const empty = document.createElement('div');
    empty.className = 'details__empty';
    empty.textContent = filteredItems && filteredItems.length === 0
      ? 'No entries match your current search.'
      : 'Select any item from the list to explore its connections.';
    detailsEl.appendChild(empty);
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
    emptyMessage: 'This need is calling for attention. Try a strategy below or explore linked feelings for empathy clues.',
  });

  const feelingsGroup = createDetailGroup('Feelings connected to this need', item.feelings, 'feelings');
  if (feelingsGroup) container.appendChild(feelingsGroup);

  const situationsGroup = createDetailGroup('Situations that often bring this need forward', item.situations, 'situations');
  if (situationsGroup) container.appendChild(situationsGroup);

  const strategySection = document.createElement('section');
  strategySection.className = 'detail-group';

  const strategyTitle = document.createElement('span');
  strategyTitle.className = 'detail-group__title';
  strategyTitle.textContent = 'Care strategies to experiment with';
  strategySection.appendChild(strategyTitle);

  const strategiesList = document.createElement('ul');
  strategiesList.className = 'strategy-list';

  const strategies = resolveEntries(item.strategies, 'strategies');
  if (strategies.length === 0) {
    const placeholder = document.createElement('p');
    placeholder.className = 'details__description';
    placeholder.textContent = 'No strategies have been linked yet. Try searching the strategies tab directly.';
    strategySection.appendChild(placeholder);
  } else {
    strategies.forEach((strategy) => {
      strategiesList.appendChild(createStrategyCard(strategy));
    });
    strategySection.appendChild(strategiesList);
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
    chip.className = 'chip';
    chip.textContent = entry.title;
    chip.dataset.target = targetDataset;
    if (entry.slug) chip.dataset.slug = entry.slug;
    chip.dataset.title = entry.title;
    chipContainer.appendChild(chip);
  });

  wrapper.appendChild(chipContainer);
  return wrapper;
}

function createStrategyCard(strategy) {
  const card = document.createElement('li');
  card.className = 'strategy-card';

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

  card.appendChild(action);
  return card;
}

function renderPlan() {
  planList.innerHTML = '';

  if (!state.plan || state.plan.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'plan-empty';
    empty.textContent = 'No strategies saved yet. As you explore, add practices that resonate.';
    planList.appendChild(empty);
    return;
  }

  state.plan.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'plan-item';

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

    item.append(info, remove);
    planList.appendChild(item);
  });
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
