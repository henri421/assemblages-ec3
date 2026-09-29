import { describe, expect, it } from 'vitest';

import { verifierDirectionnelle } from '../../src/soudures/directionnelle';
import { contraintesDansLaGorge } from '../../src/soudures/gorge';
import { verifierSimplifiee } from '../../src/soudures/simplifiee';

const S235 = { f_u: 360, beta_w: 0.8, gamma_M2: 1.25 };

describe('verifierSimplifiee', () => {
  it('resultante et resistance, calculees a la main', () => {
    // f_vw,d = 360 / (1,7320508 * 0,8 * 1,25) = 207,846097 MPa
    // F_w,Rd = 5 * 207,846097 / 1000 = 1,039230 kN/mm
    // F_w,Ed = hypot(0,6 ; 0,8 ; 0) = 1,0 kN/mm
    const r = verifierSimplifiee({ p_1: 0.6, p_2: 0.8, p_para: 0 }, 5, S235);
    expect(r.f_vw_d).toBeCloseTo(207.846097, 5);
    expect(r.F_w_Rd).toBeCloseTo(1.03923, 5);
    expect(r.F_w_Ed).toBeCloseTo(1, 12);
    expect(r.taux).toBeCloseTo(0.962250, 6);
  });

  it('refuse une gorge nulle', () => {
    expect(() => verifierSimplifiee({ p_1: 1, p_2: 0, p_para: 0 }, 0, S235)).toThrow(/gorge/i);
  });
});

describe('equivalence des deux methodes en cisaillement longitudinal pur', () => {
  it('les taux coincident rigoureusement', () => {
    // p_para = 1 kN/mm, a = 5 : tau_para = 200 MPa, equivalente = 346,410162
    // taux = 346,410162 / 360 = 0,962250 = 1 / 1,039230
    const efforts = { p_1: 0, p_2: 0, p_para: 1 };
    const dir = verifierDirectionnelle(contraintesDansLaGorge(efforts, 5), S235);
    const simp = verifierSimplifiee(efforts, 5, S235);

    expect(dir.tauxEquivalent).toBeCloseTo(0.96225, 5);
    expect(simp.taux).toBeCloseTo(dir.tauxEquivalent, 12);
  });

  it('la methode simplifiee est plus severe des qu un effort transversal apparait', () => {
    const efforts = { p_1: 1, p_2: 0, p_para: 0 };
    const dir = verifierDirectionnelle(contraintesDansLaGorge(efforts, 5), S235);
    const simp = verifierSimplifiee(efforts, 5, S235);
    // 0,785674 contre 1 / 1,039230 = 0,962250
    expect(simp.taux).toBeGreaterThan(dir.taux);
  });
});
