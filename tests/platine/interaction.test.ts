import { describe, expect, it } from 'vitest';

import { interactionPlatine } from '../../src/platine/interaction';

describe('interactionPlatine — chaise sur lierne', () => {
  /**
   * sigma_z = 6 * 23 500 / 30^2 = 156,6667 MPa
   * face support : sx = 120,6517, sz = -156,6667 -> sigma_eq = 240,8389 ; taux 1,024846
   * face ames    : sx = 59,2018,  sz = +156,6667 -> sigma_eq = 137,02
   */
  const r = interactionPlatine(120.651669, 59.201751, 23.5, 30, 235, 1);

  it('la face cote support gouverne', () => {
    expect(r.sigma_z).toBeCloseTo(156.666667, 6);
    expect(r.taux).toBeCloseTo(1.024846, 5);
  });

  it('refuse une epaisseur nulle', () => {
    expect(() => interactionPlatine(1, 1, 1, 0, 235, 1)).toThrow(/epaisseur/);
  });
});
