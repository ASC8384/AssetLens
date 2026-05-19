import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('dashboard layout css', () => {
  it('uses a two-column layout for the secondary chart row to avoid an empty right slot', () => {
    const css = readFileSync('src/styles.css', 'utf8');

    expect(css).toContain('.secondary-charts { grid-template-columns: minmax(0, 1.35fr) minmax(320px, 1fr); }');
    expect(css).not.toContain('.secondary-charts { grid-template-columns: 1.3fr 1fr 1fr; }');
  });

  it('uses two columns for tertiary charts so four cards do not feel cramped', () => {
    const css = readFileSync('src/styles.css', 'utf8');

    expect(css).toContain('.tertiary-charts { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
    expect(css).not.toContain('.tertiary-charts { grid-template-columns: repeat(4, minmax(0, 1fr)); }');
  });
});
