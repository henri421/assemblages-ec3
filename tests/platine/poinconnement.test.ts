import { describe, expect, it } from 'vitest';

import { verifierPoinconnementPlatine } from '../../src/platine/poinconnement';

describe('verifierPoinconnementPlatine', () => {
  it('N / (pi D t) contre f_y / racine(3)', () => {
    // 1 000 000 / (pi * 150 * 30) = 70,735530 MPa ; 135,677313 MPa ; 0,521351
    const r = verifierPoinconnementPlatine(1000, 150, 30, 235, 1);
    expect(r.tau_Ed).toBeCloseTo(70.73553, 5);
    expect(r.taux).toBeCloseTo(0.521351, 6);
  });

  it('refuse un diametre nul', () => {
    expect(() => verifierPoinconnementPlatine(1000, 0, 30, 235, 1)).toThrow(/diametre/);
  });
});
