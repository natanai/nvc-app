import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const target = '.github/scripts/bedrock-provenance-finalize.mjs';
let source = readFileSync(target, 'utf8');
source = source.replaceAll('\\\\`', '\\`');
writeFileSync(target, source);

const check = spawnSync(process.execPath, ['--check', target], { stdio: 'inherit' });
if (check.status !== 0) process.exit(check.status || 1);

const result = spawnSync(process.execPath, [target], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);

rmSync('.github/scripts/bedrock-provenance-repair.mjs');
