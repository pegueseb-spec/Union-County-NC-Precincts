/**
 * Extracts the BUILT_IN_VOTER_DATA and BUILT_IN_HISTORY_DATA arrays from
 * src/data/unionCountyBuiltInData.ts and writes them as lean JSON files to
 * public/data/. This avoids having 57 MB of TypeScript literals that tsc
 * cannot compile in a reasonable time.
 *
 * Run with: node scripts/extract_json_from_ts.mjs
 */

import { createReadStream, mkdirSync, createWriteStream } from 'fs';
import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SRC = resolve(ROOT, 'src/data/unionCountyBuiltInData.ts');
const OUT_DIR = resolve(ROOT, 'public/data');
const VOTER_OUT = resolve(OUT_DIR, 'union_voter_stats.json');
const HISTORY_OUT = resolve(OUT_DIR, 'union_history_stats.json');

mkdirSync(OUT_DIR, { recursive: true });

const voterStream = createWriteStream(VOTER_OUT);
const historyStream = createWriteStream(HISTORY_OUT);

// State machine: before_voter → in_voter → between → in_history → done
let state = 'before_voter';
let voterCount = 0;
let historyCount = 0;

const rl = createInterface({ input: createReadStream(SRC), crlfDelay: Infinity });

rl.on('line', (line) => {
  const trimmed = line.trim();

  if (state === 'before_voter') {
    if (trimmed.startsWith('export const BUILT_IN_VOTER_DATA') && trimmed.endsWith('[')) {
      state = 'in_voter';
      voterStream.write('[\n');
    }
  } else if (state === 'in_voter') {
    if (trimmed === '];') {
      // Remove trailing comma from the last element already written
      // The stream is already flushed line-by-line; instead we rely on
      // PowerShell ConvertTo-Json NOT adding trailing commas → safe to close.
      voterStream.write('\n]\n');
      voterStream.end();
      state = 'between';
    } else {
      voterStream.write(line + '\n');
      if (trimmed === '{') voterCount++;
    }
  } else if (state === 'between') {
    if (trimmed.startsWith('export const BUILT_IN_HISTORY_DATA') && trimmed.endsWith('[')) {
      state = 'in_history';
      historyStream.write('[\n');
    }
  } else if (state === 'in_history') {
    if (trimmed === '];') {
      historyStream.write('\n]\n');
      historyStream.end();
      state = 'done';
    } else {
      historyStream.write(line + '\n');
      if (trimmed === '{') historyCount++;
    }
  }
});

rl.on('close', () => {
  if (state !== 'done') {
    // In case the file ended without a clean ];
    voterStream.end();
    historyStream.end();
  }
  console.log(`Extracted ~${voterCount} voter rows  → ${VOTER_OUT}`);
  console.log(`Extracted ~${historyCount} history rows → ${HISTORY_OUT}`);
  console.log('Done. Verify JSON validity with: node -e "require(\'./public/data/union_voter_stats.json\')"');
});
