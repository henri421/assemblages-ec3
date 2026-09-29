import { describe, expect, it } from 'vitest';

import { betaW } from '../../src/norms/beta-w';

describe('betaW', () => {
  it('rend le tableau 4.1 de l EN 1993-1-8', () => {
    expect(betaW('S235')).toBe(0.8);
    expect(betaW('S275')).toBe(0.85);
    expect(betaW('S355')).toBe(0.9);
    expect(betaW('S420')).toBe(1.0);
    expect(betaW('S460')).toBe(1.0);
  });

  it('refuse une nuance inconnue', () => {
    expect(() => betaW('S999' as never)).toThrow(/inconnue/);
  });
});
