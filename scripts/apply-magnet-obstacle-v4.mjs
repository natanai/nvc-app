import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const generatorPath = 'scripts/build-pages.mjs';
const magnetsPath = 'scripts/magnets.js';
const physicsPath = 'scripts/magnets/magnetPhysics.js';

// --- Generator: inset the switch into the board and version the hub layout. ---
let generator = readFileSync(generatorPath, 'utf8');
const categoryStart = generator.indexOf('function renderCategory(type, items) {');
const categoryEnd = generator.indexOf('\nfunction renderBodyCuesPage()', categoryStart);
if (categoryStart < 0 || categoryEnd < 0) throw new Error('Could not isolate renderCategory().');
let category = generator.slice(categoryStart, categoryEnd);

if (!category.includes('Magnet hub UX v3 — compact mobile resting layout')) {
  throw new Error('Expected V3 magnet hub styles were not found.');
}

category = category.replaceAll("-hub-v3", "-hub-v4");
category = category.replace(
  '/* Magnet hub UX v3 — compact mobile resting layout */',
  '/* Magnet hub UX v4 — inset fixed toggle obstacle */',
);

const oldToggleCss = `      [data-magnet-key$='-hub-v4'] .magnet-play-toggle--hub {
        top: -1.15rem;
        right: 0.35rem;
        z-index: 4;
        width: 44px;
        height: 44px;
        min-width: 44px;
        min-height: 44px;
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
      }`;
const newToggleCss = `      [data-magnet-key$='-hub-v4'] .magnet-play-toggle--hub {
        top: 0.45rem;
        right: 0.45rem;
        z-index: 6;
        width: 44px;
        height: 44px;
        min-width: 44px;
        min-height: 44px;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        transform: none;
      }

      [data-magnet-key$='-hub-v4'] .magnet-play-toggle--hub:hover,
      [data-magnet-key$='-hub-v4'] .magnet-play-toggle--hub:focus-within {
        transform: none;
        background: transparent;
        box-shadow: none;
      }

      [data-magnet-key$='-hub-v4'] .magnet-play-toggle--hub:focus-within {
        outline: 2px dashed color-mix(in srgb, var(--outline) 48%, transparent);
        outline-offset: -3px;
      }`;
if (!category.includes(oldToggleCss)) throw new Error('V3 toggle CSS anchor missing.');
category = category.replace(oldToggleCss, newToggleCss);

const oldMobileToggleCss = `        [data-magnet-key$='-hub-v4'] .magnet-board-wrapper .magnet-play-toggle--hub {
          top: -1.25rem;
          right: 0.15rem;
        }`;
const newMobileToggleCss = `        [data-magnet-key$='-hub-v4'] .magnet-play-toggle--hub {
          top: 0.35rem;
          right: 0.35rem;
        }`;
if (!category.includes(oldMobileToggleCss)) throw new Error('V3 mobile toggle CSS anchor missing.');
category = category.replace(oldMobileToggleCss, newMobileToggleCss);

const oldBoardMarkup = `        <div class="magnet-board-wrapper">
          <div class="pill-grid magnet-board" data-magnet-board>
            \${magnets}
          </div>
          <label class="magnet-play-toggle magnet-play-toggle--hub" data-magnet-toggle data-state="off" title="Toggle magnet motion">
            <input type="checkbox" class="magnet-play-toggle__input" role="switch" aria-label="Toggle magnet motion">
            <span class="magnet-play-toggle__track" aria-hidden="true">
              <span class="magnet-play-toggle__thumb"></span>
            </span>
            <span class="visually-hidden magnet-play-toggle__sr-state">Physics is off</span>
          </label>
        </div>`;
const newBoardMarkup = `        <div class="magnet-board-wrapper">
          <div class="pill-grid magnet-board" data-magnet-board>
            \${magnets}
            <label class="magnet-play-toggle magnet-play-toggle--hub" data-magnet-toggle data-magnet-obstacle data-state="off" title="Toggle magnet motion">
              <input type="checkbox" class="magnet-play-toggle__input" role="switch" aria-label="Toggle magnet motion">
              <span class="magnet-play-toggle__track" aria-hidden="true">
                <span class="magnet-play-toggle__thumb"></span>
              </span>
              <span class="visually-hidden magnet-play-toggle__sr-state">Physics is off</span>
            </label>
          </div>
        </div>`;
if (!category.includes(oldBoardMarkup)) throw new Error('V3 board/toggle markup anchor missing.');
category = category.replace(oldBoardMarkup, newBoardMarkup);

generator = generator.slice(0, categoryStart) + category + generator.slice(categoryEnd);
writeFileSync(generatorPath, generator);

// --- magnets.js: make fixed board controls participate in packing + final settling. ---
let magnets = readFileSync(magnetsPath, 'utf8');

const constantsAnchor = `const CLICK_SUPPRESS_WINDOW = 150;
const TOGGLE_GUARD_MS = 120;`;
if (!magnets.includes(constantsAnchor)) throw new Error('magnets.js constants anchor missing.');
magnets = magnets.replace(
  constantsAnchor,
  `${constantsAnchor}
const FIXED_OBSTACLE_CLEARANCE = 8;
const FIXED_OBSTACLE_PHYSICS_CLEARANCE = 4;`,
);

const boundsAnchor = `const getMagnetBounds = (magnet) => {
  const left = magnet.x - (magnet.marginLeft || 0);
  const top = magnet.y - (magnet.marginTop || 0);
  const right = left + magnet.width + (magnet.marginLeft || 0) + (magnet.marginRight || 0);
  const bottom = top + magnet.height + (magnet.marginTop || 0) + (magnet.marginBottom || 0);
  return { left, top, right, bottom };
};`;
if (!magnets.includes(boundsAnchor)) throw new Error('getMagnetBounds anchor missing.');
const obstacleHelpers = `

const rectsOverlap = (a, b) => Boolean(
  a && b
  && a.left < b.right
  && a.right > b.left
  && a.top < b.bottom
  && a.bottom > b.top
);

const getFixedObstacleRects = (state, clearance = FIXED_OBSTACLE_CLEARANCE) => {
  if (!state?.board) return [];
  const boardRect = state.board.getBoundingClientRect();
  return Array.from(state.board.querySelectorAll('[data-magnet-obstacle]'))
    .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const pad = Math.max(Number(clearance) || 0, 0);
      return {
        left: rect.left - boardRect.left - pad,
        top: rect.top - boardRect.top - pad,
        right: rect.right - boardRect.left + pad,
        bottom: rect.bottom - boardRect.top + pad,
      };
    });
};

const magnetOverlapsFixedObstacle = (state, magnet, clearance = FIXED_OBSTACLE_CLEARANCE) => {
  if (!magnet || magnet.navHidden) return false;
  const bounds = getMagnetBounds(magnet);
  return getFixedObstacleRects(state, clearance).some((obstacle) => rectsOverlap(bounds, obstacle));
};

const layoutHasFixedObstacleOverlap = (state) =>
  Boolean(state?.magnets?.some((magnet) => magnetOverlapsFixedObstacle(state, magnet)));

const candidateOverlapsFixedObstacle = (state, magnet, x, y, obstacles) => {
  const marginLeft = magnet.marginLeft || 0;
  const marginRight = magnet.marginRight || 0;
  const marginTop = magnet.marginTop || 0;
  const marginBottom = magnet.marginBottom || 0;
  const bounds = {
    left: x - marginLeft,
    top: y - marginTop,
    right: x + magnet.width + marginRight,
    bottom: y + magnet.height + marginBottom,
  };
  return obstacles.find((obstacle) => rectsOverlap(bounds, obstacle)) || null;
};

const resolveFixedObstacleOverlaps = (state) => {
  if (!state?.magnets?.length) return false;
  const obstacles = getFixedObstacleRects(state);
  if (!obstacles.length) return false;
  const boardWidth = Math.max(state.boardWidth || 0, 1);
  let changed = false;

  state.magnets.forEach((magnet) => {
    if (!magnet || magnet.navHidden) return;
    obstacles.forEach((obstacle) => {
      const bounds = getMagnetBounds(magnet);
      if (!rectsOverlap(bounds, obstacle)) return;

      const gap = FIXED_OBSTACLE_CLEARANCE;
      const shifts = [
        { axis: 'x', value: obstacle.left - bounds.right - gap },
        { axis: 'x', value: obstacle.right - bounds.left + gap },
        { axis: 'y', value: obstacle.top - bounds.bottom - gap },
        { axis: 'y', value: obstacle.bottom - bounds.top + gap },
      ].filter((shift) => {
        if (shift.axis === 'x') {
          const left = bounds.left + shift.value;
          const right = bounds.right + shift.value;
          return left >= 0 && right <= boardWidth;
        }
        return bounds.top + shift.value >= 0;
      });

      shifts.sort((a, b) => Math.abs(a.value) - Math.abs(b.value));
      const chosen = shifts[0];
      if (!chosen) return;
      if (chosen.axis === 'x') magnet.x += chosen.value;
      else magnet.y += chosen.value;
      changed = true;
    });
  });

  if (!changed) return false;
  state.magnets.forEach((magnet) => setMagnetTransform(magnet));
  updateBoardHeight(state);

  if (layoutHasOverlap(state) || layoutHasFixedObstacleOverlap(state)) {
    applyRowPackedLayout(state, state.magnets, { persist: false });
  } else {
    updateLayout(state);
  }
  return true;
};`;
magnets = magnets.replace(boundsAnchor, boundsAnchor + obstacleHelpers);

const rowPackStart = magnets.indexOf('const applyRowPackedLayout = (state, order, { persist = false } = {}) => {');
const rowPackEnd = magnets.indexOf('\nconst reseedNavBoardLayouts = () => {', rowPackStart);
if (rowPackStart < 0 || rowPackEnd < 0) throw new Error('Could not isolate applyRowPackedLayout().');
const newRowPack = `const applyRowPackedLayout = (state, order, { persist = false } = {}) => {
  console.info('[magnets] reseed CALLED', 'applyRowPackedLayout');
  const width = Math.max(state.boardWidth || 0, 1);
  const startX = LAYOUT_GAP_X;
  const startY = LAYOUT_GAP_Y;
  const obstacles = getFixedObstacleRects(state);
  let cursorX = startX;
  let cursorY = startY;
  let rowHeight = 0;
  let maxBottom = startY;

  const seeds = isNavBoardState(state) ? order.filter((magnet) => !magnet?.navHidden) : order;
  const placements = [];

  seeds.forEach((magnet) => {
    const marginLeft = magnet.marginLeft || 0;
    const marginRight = magnet.marginRight || 0;
    const marginTop = magnet.marginTop || 0;
    const marginBottom = magnet.marginBottom || 0;
    const footprintWidth = magnet.width + marginLeft + marginRight;
    const footprintHeight = magnet.height + marginTop + marginBottom;
    let attempts = 0;

    while (attempts < Math.max(obstacles.length + 3, 4)) {
      if (cursorX > startX && cursorX + footprintWidth + LAYOUT_GAP_X > width) {
        cursorX = startX;
        cursorY += rowHeight + LAYOUT_GAP_Y;
        rowHeight = 0;
      }

      const maxX = Math.max(width - magnet.width, 0);
      const x = clamp(cursorX + marginLeft, 0, maxX);
      const y = cursorY + marginTop;
      const obstacle = candidateOverlapsFixedObstacle(state, magnet, x, y, obstacles);

      if (!obstacle) {
        placements.push({ magnet, x, y });
        cursorX += footprintWidth + LAYOUT_GAP_X;
        rowHeight = Math.max(rowHeight, footprintHeight);
        maxBottom = Math.max(maxBottom, y + magnet.height + marginBottom);
        return;
      }

      const afterObstacleX = obstacle.right + LAYOUT_GAP_X;
      if (afterObstacleX + footprintWidth + LAYOUT_GAP_X <= width && afterObstacleX > cursorX) {
        cursorX = afterObstacleX;
        attempts += 1;
        continue;
      }

      cursorX = startX;
      cursorY = Math.max(
        cursorY + Math.max(rowHeight, footprintHeight) + LAYOUT_GAP_Y,
        obstacle.bottom + LAYOUT_GAP_Y,
      );
      rowHeight = 0;
      attempts += 1;
    }

    const maxX = Math.max(width - magnet.width, 0);
    const x = clamp(cursorX + marginLeft, 0, maxX);
    const y = cursorY + marginTop;
    placements.push({ magnet, x, y });
    cursorX += footprintWidth + LAYOUT_GAP_X;
    rowHeight = Math.max(rowHeight, footprintHeight);
    maxBottom = Math.max(maxBottom, y + magnet.height + marginBottom);
  });

  placements.forEach(({ magnet, x, y }) => {
    magnet.x = x;
    magnet.y = y;
    setMagnetTransform(magnet);
  });

  const height = Math.max(state.minHeight, maxBottom + BOARD_PADDING);
  state.boardHeight = height;
  state.board.style.height = \`${height}px\`;
  updateLayout(state);
  if (persist) persistLayout(state, true);
  state.lastSeedWidth = state.boardWidth;
  state.lastLayoutType = 'seed';
};
`;
magnets = magnets.slice(0, rowPackStart) + newRowPack + magnets.slice(rowPackEnd);

const physicsCallAnchor = `      getBoardSize: () => ({ width: state.boardWidth, height: state.boardHeight }),
      onDragRelease: () => state.setClickSuppress(),`;
if (!magnets.includes(physicsCallAnchor)) throw new Error('startPhysics options anchor missing.');
magnets = magnets.replace(
  physicsCallAnchor,
  `      getBoardSize: () => ({ width: state.boardWidth, height: state.boardHeight }),
      getObstacles: () => getFixedObstacleRects(state, FIXED_OBSTACLE_PHYSICS_CLEARANCE),
      onDragRelease: () => state.setClickSuppress(),`,
);

const exitPhysicsAnchor = `      if (isNavBoardState(state)) {
        resolveNavLayoutToNearestValid(state);
      }
      updateLayout(state);`;
if (!magnets.includes(exitPhysicsAnchor)) throw new Error('exit physics settle anchor missing.');
magnets = magnets.replace(
  exitPhysicsAnchor,
  `      if (isNavBoardState(state)) {
        resolveNavLayoutToNearestValid(state);
      } else {
        resolveFixedObstacleOverlaps(state);
      }
      updateLayout(state);`,
);

const restoredValidityAnchor = `    if (!isNavBoardState(state) && layoutHasOverlap(state)) {
      shouldSeed = true;
    }`;
if (!magnets.includes(restoredValidityAnchor)) throw new Error('stored-layout validity anchor missing.');
magnets = magnets.replace(
  restoredValidityAnchor,
  `    if (!isNavBoardState(state) && (layoutHasOverlap(state) || layoutHasFixedObstacleOverlap(state))) {
      shouldSeed = true;
    }`,
);

const resizeManualAnchor = `        if (widthChanged) {
          restoreLayoutFromPercentages(state, { persist: false });
        } else {
          updateBoardHeight(state);
        }
        updateLayout(state);`;
if (!magnets.includes(resizeManualAnchor)) throw new Error('manual resize anchor missing.');
magnets = magnets.replace(
  resizeManualAnchor,
  `        if (widthChanged) {
          restoreLayoutFromPercentages(state, { persist: false });
        } else {
          updateBoardHeight(state);
        }
        if (!isNavBoardState(state)) resolveFixedObstacleOverlaps(state);
        updateLayout(state);`,
);

writeFileSync(magnetsPath, magnets);

// --- magnetPhysics.js: soft collision against immovable board controls while motion is active. ---
let physics = readFileSync(physicsPath, 'utf8');

const separationEnd = `const applyPointerField = (state, dt) => {`;
const separationIndex = physics.indexOf(separationEnd);
if (separationIndex < 0) throw new Error('Physics pointer-field anchor missing.');
const obstaclePhysics = `const getObstacleRects = (state) => {
  if (typeof state.getObstacles !== 'function') return [];
  try {
    const obstacles = state.getObstacles();
    return Array.isArray(obstacles)
      ? obstacles.filter((obstacle) => obstacle
        && Number.isFinite(obstacle.left)
        && Number.isFinite(obstacle.right)
        && Number.isFinite(obstacle.top)
        && Number.isFinite(obstacle.bottom))
      : [];
  } catch {
    return [];
  }
};

const applyObstacleForces = (state, dt) => {
  const obstacles = getObstacleRects(state);
  if (!obstacles.length) return;
  const { sepStrength } = state.config;

  state.magnets.forEach((magnet) => {
    if (magnet.navHidden || magnet.dragging) return;
    obstacles.forEach((obstacle) => {
      const overlapX = Math.min(magnet.x + magnet.w, obstacle.right) - Math.max(magnet.x, obstacle.left);
      const overlapY = Math.min(magnet.y + magnet.h, obstacle.bottom) - Math.max(magnet.y, obstacle.top);
      if (overlapX <= 0 || overlapY <= 0) return;

      const centerX = magnet.x + magnet.w / 2;
      const centerY = magnet.y + magnet.h / 2;
      const obstacleCenterX = (obstacle.left + obstacle.right) / 2;
      const obstacleCenterY = (obstacle.top + obstacle.bottom) / 2;
      const impulseScale = sepStrength * dt * 1.35;

      if (overlapX < overlapY) {
        const direction = centerX < obstacleCenterX ? -1 : 1;
        magnet.vx += direction * overlapX * impulseScale;
      } else {
        const direction = centerY < obstacleCenterY ? -1 : 1;
        magnet.vy += direction * overlapY * impulseScale;
      }
    });
  });
};

`;
physics = physics.slice(0, separationIndex) + obstaclePhysics + physics.slice(separationIndex);

const frameAnchor = `    applySeparationForces(state, dt);
    applyPointerField(state, dt);`;
if (!physics.includes(frameAnchor)) throw new Error('Physics frame anchor missing.');
physics = physics.replace(
  frameAnchor,
  `    applySeparationForces(state, dt);
    applyObstacleForces(state, dt);
    applyPointerField(state, dt);`,
);

const physicsStateAnchor = `    getBoardSize: options.getBoardSize,
    onDragRelease: options.onDragRelease,`;
if (!physics.includes(physicsStateAnchor)) throw new Error('Physics state options anchor missing.');
physics = physics.replace(
  physicsStateAnchor,
  `    getBoardSize: options.getBoardSize,
    getObstacles: options.getObstacles,
    onDragRelease: options.onDragRelease,`,
);

writeFileSync(physicsPath, physics);

// Rebuild only the three hub scopes. The workflow preserves the standalone wheel around this command.
execFileSync('node', ['scripts/build-pages.mjs', '--scope=needs,feelings,faux-feelings'], { stdio: 'inherit' });

for (const directory of ['needs', 'feelings', 'faux-feelings']) {
  const html = readFileSync(`${directory}/index.html`, 'utf8');
  if (!html.includes(`data-magnet-key="${directory}-hub-v4"`)) throw new Error(`${directory}: V4 storage key missing.`);
  if (!html.includes('data-magnet-obstacle')) throw new Error(`${directory}: fixed toggle obstacle missing.`);
  const boardStart = html.indexOf('<div class="pill-grid magnet-board" data-magnet-board>');
  const toggleIndex = html.indexOf('data-magnet-obstacle', boardStart);
  const boardEnd = html.indexOf('</div>', toggleIndex);
  if (boardStart < 0 || toggleIndex < boardStart || boardEnd < toggleIndex) throw new Error(`${directory}: toggle is not inset in board.`);
  if (html.includes('backdrop-filter: blur(6px)') && html.indexOf('Magnet hub UX v4') > -1) {
    // Global CSS may still contain blur, but V4 must explicitly override it before first paint.
    if (!html.includes('-webkit-backdrop-filter: none') || !html.includes('backdrop-filter: none')) {
      throw new Error(`${directory}: V4 does not override toggle blur.`);
    }
  }
}

const finalMagnets = readFileSync(magnetsPath, 'utf8');
const finalPhysics = readFileSync(physicsPath, 'utf8');
for (const marker of ['data-magnet-obstacle', 'getFixedObstacleRects', 'resolveFixedObstacleOverlaps', 'getObstacles: () => getFixedObstacleRects']) {
  if (!finalMagnets.includes(marker)) throw new Error(`magnets.js verification missing: ${marker}`);
}
for (const marker of ['applyObstacleForces', 'getObstacles: options.getObstacles']) {
  if (!finalPhysics.includes(marker)) throw new Error(`magnetPhysics.js verification missing: ${marker}`);
}

console.log('Inset fixed magnet-toggle obstacle V4 integrated and verified.');
