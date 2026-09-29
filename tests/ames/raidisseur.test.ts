import { describe, expect, it } from 'vitest';

import { classeAme, torsionRaidisseur } from '../../src/ames/raidisseur';

describe('classeAme', () => {
  it('chant comprime, pied tendu : psi = -0,238671, k_sigma = 0,624108', () => {
    // Chaise sur lierne : sigma_chant = 248,048 ; sigma_pied = -59,202 MPa
    const c = classeAme(150, 20, 235, -59.201751, 248.047841);
    expect(c.elancement).toBe(7.5);
    expect(c.psi).toBeCloseTo(-0.238671, 6);
    expect(c.k_sigma).toBeCloseTo(0.624108, 6);
    // 21 racine(0,624108) = 16,590110
    expect(c.limiteClasse3).toBeCloseTo(16.59011, 5);
    expect(c.classe3Atteinte).toBe(true);
  });

  it('compression uniforme : k_sigma = 0,43, limite 21 racine(0,43) = 13,77 eps', () => {
    const c = classeAme(150, 10, 235, 100, 100);
    expect(c.k_sigma).toBeCloseTo(0.43, 12);
    expect(c.limiteClasse3).toBeCloseTo(13.770621, 6);
    expect(c.classe3Atteinte).toBe(false);
  });

  it('psi est borne a -3', () => {
    const c = classeAme(150, 10, 235, -1000, 100);
    expect(c.psi).toBe(-3);
    expect(c.k_sigma).toBeCloseTo(0.57 + 0.63 + 0.63, 12);
  });

  it('un chant libre non comprime ne se classe pas', () => {
    const c = classeAme(150, 10, 235, 50, -20);
    expect(c.classe3Atteinte).toBe(true);
    expect(c.limiteClasse3).toBe(Infinity);
  });

  it('refuse une epaisseur nulle', () => {
    expect(() => classeAme(150, 0, 235, 1, 1)).toThrow(/epaisseur d ame/);
  });
});

describe('torsionRaidisseur', () => {
  it('racine(E / (5,3 f_y)) = 12,984875 en S235', () => {
    const r = torsionRaidisseur(150, 20, 235, 210000);
    expect(r.limite).toBeCloseTo(12.984875, 6);
    expect(r.taux).toBeCloseTo(0.577595, 6);
  });

  it('un plat de 200 x 12 depasse la limite', () => {
    expect(torsionRaidisseur(200, 12, 235, 210000).taux).toBeGreaterThan(1);
  });
});
