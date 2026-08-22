import { readFileSync, writeFileSync } from 'node:fs';

const path = 'styles.css';
const source = readFileSync(path, 'utf8');
const experimentalBlock = `
@media (hover: none) and (pointer: coarse) {
  html {
    /* Fixed root backgrounds can force expensive full-page recompositing during
       momentum scrolling on mobile browsers. Keep the same gradient but let it
       move with the document on touch-first devices. */
    background-attachment: scroll;
  }
}
`;

const matches = source.split(experimentalBlock).length - 1;
if (matches !== 1) {
  throw new Error(`Expected exactly one experimental mobile background block, found ${matches}`);
}

writeFileSync(path, source.replace(experimentalBlock, ''));
