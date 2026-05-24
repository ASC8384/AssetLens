import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('FIRE layout css', () => {
  it('gives dense FIRE cards more room than the default three-column grid', () => {
    const css = readFileSync('src/styles.css', 'utf8');

    expect(css).toContain('.fire-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 22px; margin-top: 20px; align-items: start; }');
    expect(css).toContain('.fire-settings, .fire-core-card { grid-column: span 3; }');
    expect(css).toContain('.fire-breakdown-card, .fire-history-card { grid-column: span 3; }');
    expect(css).toContain('.fire-sensitivity-card { grid-column: 1 / -1; padding: 28px; }');
    expect(css).toContain('.sensitivity-header { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, .42fr); gap: 18px; align-items: start; }');
    expect(css).toContain('.sensitivity-reading-guide { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 14px 0; }');
    expect(css).not.toContain('.fire-compact-note');
  });
});

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
