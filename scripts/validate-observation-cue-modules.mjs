#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compileObservationCueLibrary,
  parseObservationCueCSV,
  parseObservationCueModules,
} from '../lib/observationCueData.js';

async function main() {
  const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const csvPath = path.join(rootDir, 'data', 'observation_cues.csv');
  const modulesPath = path.join(rootDir, 'data', 'observation_cue_modules.json');

  const [csvText, modulesText] = await Promise.all([
    fs.readFile(csvPath, 'utf8'),
    fs.readFile(modulesPath, 'utf8'),
  ]);

  const cues = parseObservationCueCSV(csvText);
  const moduleDefs = parseObservationCueModules(modulesText);
  const library = compileObservationCueLibrary({ cues, modules: moduleDefs });

  const report = buildReport({ cues, moduleDefs, library });
  outputReport(report);

  if (report.issues.length) {
    process.exitCode = 1;
  }
}

function buildReport({ cues, moduleDefs, library }) {
  const cuesById = new Map(cues.map(cue => [cue.id, cue]));
  const modulesById = new Map((library.modules || []).map(module => [module.id, module]));
  const assigned = new Set();
  (library.modules || []).forEach(module => {
    (module.cueIds || []).forEach(id => assigned.add(id));
  });

  const missingCues = [];
  const detectorIssues = [];
  moduleDefs.forEach(def => {
    const cueIds = Array.isArray(def.cueIds) ? def.cueIds : [];
    cueIds.forEach(id => {
      if (!cuesById.has(id)) {
        missingCues.push({ moduleId: def.id, cueId: id });
      }
    });
    const module = modulesById.get(def.id);
    if (module && (!Array.isArray(module.matchers) || !module.matchers.length)) {
      detectorIssues.push(def.id);
    }
  });

  const fallbackModules = (library.modules || []).filter(
    module => Array.isArray(module.cueIds) && module.cueIds.length === 1 && module.id.startsWith('module-'),
  );
  const fallbackCues = fallbackModules.map(module => module.cueIds[0]);
  const groupedModules = (library.modules || []).filter(
    module => Array.isArray(module.cueIds) && module.cueIds.length > 1,
  );
  const autoModules = (library.modules || []).filter(module => module.auto);

  const issues = [];
  if (missingCues.length) {
    issues.push(`Modules reference ${missingCues.length} cues that do not exist.`);
  }
  if (detectorIssues.length) {
    issues.push(`Modules missing detectors: ${detectorIssues.join(', ')}`);
  }

  return {
    cueCount: cues.length,
    moduleCount: library.modules.length,
    customModuleCount: moduleDefs.length,
    autoModuleCount: autoModules.length,
    groupedModuleCount: groupedModules.length,
    fallbackModuleCount: fallbackModules.length,
    missingCues,
    detectorIssues,
    issues,
    fallbackCues,
  };
}

function outputReport(report) {
  console.log(`Loaded ${report.cueCount} cues.`);
  console.log(
    `Compiled ${report.moduleCount} cue modules (${report.customModuleCount} curated, ${report.autoModuleCount} auto-generated).`,
  );
  console.log(`Modules covering multiple cues: ${report.groupedModuleCount}`);
  console.log(`Fallback modules covering individual cues: ${report.fallbackModuleCount}`);
  if (report.missingCues.length) {
    console.warn('Missing cue references:');
    report.missingCues.forEach(entry => {
      console.warn(` - ${entry.moduleId}: ${entry.cueId}`);
    });
  }
  if (report.detectorIssues.length) {
    console.warn('Modules without detectors:');
    report.detectorIssues.forEach(id => console.warn(` - ${id}`));
  }
  if (report.fallbackCues.length) {
    console.log('Cues not yet migrated to custom modules (sample of 10):');
    report.fallbackCues.slice(0, 10).forEach(id => console.log(` - ${id}`));
  }
  if (!report.issues.length) {
    console.log('Observation cue modules validated successfully.');
  } else {
    console.warn('Issues detected:', report.issues.join(' '));
  }
}

main().catch(error => {
  console.error('Failed to validate observation cue modules:', error);
  process.exitCode = 1;
});
