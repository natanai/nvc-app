import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const builderPath = path.join(rootDir, 'data', 'observation_sentence_builder.json');
const actionsPath = path.join(rootDir, 'data', 'observation_sentence_actions.json');
const blueprintPath = path.join(rootDir, 'data', 'observation_module_blueprints.json');

const SUBJECT_GROUPS = {
  default: [
    { value: 'them', label: 'them' },
    { value: 'my manager', label: 'my manager' },
    { value: 'my teammate', label: 'my teammate' },
    { value: 'my partner', label: 'my partner' },
    { value: 'my family member', label: 'my family member' },
    { value: 'my friend', label: 'my friend' },
    { value: 'my client', label: 'my client' },
    { value: 'my supervisor', label: 'my supervisor' },
    { value: 'my doctor', label: 'my doctor' },
    { value: 'a coworker', label: 'a coworker' },
    { value: 'a classmate', label: 'a classmate' },
    { value: 'a neighbor', label: 'a neighbor' },
    {
      value: '',
      label: 'someone else…',
      input: {
        placeholder: 'describe the person',
        ariaLabel: 'Custom person for sensory detail',
      },
    },
  ],
  self: [
    { value: 'myself', label: 'myself' },
    { value: 'my coworker', label: 'my coworker' },
    { value: 'my child', label: 'my child' },
    { value: 'my partner', label: 'my partner' },
    {
      value: '',
      label: 'someone else…',
      input: {
        placeholder: 'describe who',
        ariaLabel: 'Custom person',
      },
    },
  ],
};

const DEFAULT_SUBJECT_ARIA = 'Who was involved';
const DEFAULT_DETAIL_ARIA = 'What happened';

async function loadActionDefinitions() {
  const raw = await fs.readFile(actionsPath, 'utf8');
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed?.actions) ? parsed.actions : [];
  return list;
}

function buildAction(definition) {
  if (definition.segments) {
    return {
      id: definition.id,
      label: definition.label,
      moduleId: definition.moduleId || definition.id,
      segments: definition.segments,
      branches: definition.branches || {},
    };
  }

  const subjectGroup = definition.subjectGroup === null ? null : definition.subjectGroup || 'default';
  const detailId = definition.detailId || `${definition.id}-detail`;
  const segments = [];

  segments.push({ type: 'fixed', value: definition.verb });

  if (subjectGroup) {
    const subjectId = definition.subjectId || `${definition.id}-subject`;
    segments.push({
      type: 'select',
      id: subjectId,
      ariaLabel: definition.subjectAriaLabel || DEFAULT_SUBJECT_ARIA,
      options: `@subjects.${subjectGroup}`,
    });
  }

  segments.push({
    type: 'select',
    id: detailId,
    ariaLabel: definition.detailAriaLabel || DEFAULT_DETAIL_ARIA,
    options: definition.details.map(option => ({ ...option })),
  });

  return {
    id: definition.id,
    label: definition.label,
    moduleId: definition.moduleId || definition.id,
    segments,
    branches: definition.branches || {},
  };
}

async function main() {
  const raw = await fs.readFile(builderPath, 'utf8');
  const builder = JSON.parse(raw);
  if (!builder.slots || !builder.slots.sensory) {
    throw new Error('Sentence builder template missing sensory slot');
  }

  builder.version = 2;
  builder.slots.sensory.subjectGroups = SUBJECT_GROUPS;

  const definitions = await loadActionDefinitions();
  const actions = definitions.map(buildAction);
  builder.slots.sensory.actions = actions;

  await fs.writeFile(builderPath, `${JSON.stringify(builder, null, 2)}\n`, 'utf8');
  await syncBlueprintWithActions(actions);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

async function syncBlueprintWithActions(actions) {
  const actionMap = buildModuleActionMap(actions);
  const raw = await fs.readFile(blueprintPath, 'utf8');
  const parsed = JSON.parse(raw);
  const modules = Array.isArray(parsed?.modules) ? parsed.modules : [];
  const updatedModules = modules.map(module => {
    const fromActions = actionMap.get(module.id) || [];
    if (!Array.isArray(module.builderActionIds) && !fromActions.length) {
      return module;
    }
    return { ...module, builderActionIds: fromActions };
  });
  const next = Array.isArray(parsed?.modules)
    ? { ...parsed, modules: updatedModules }
    : { modules: updatedModules };
  await fs.writeFile(blueprintPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

function buildModuleActionMap(actions) {
  const map = new Map();
  (Array.isArray(actions) ? actions : []).forEach(action => {
    if (!action || !action.moduleId) {
      return;
    }
    if (!map.has(action.moduleId)) {
      map.set(action.moduleId, []);
    }
    map.get(action.moduleId).push(action.id);
  });
  return map;
}
