import { describe, expect, it } from 'vitest';

import {
  sollicitationsContinu,
  sollicitationsExtremites,
  verifierFlexionTranchant,
} from '../../src/ames/flexion-tranchant';
import { sectionEnTe } from '../../src/ames/section-composee';
import { chaiseSurLierne } from '../fixtures/chaise';

describe('sollicitationsContinu', () => {
  it('console (L_w - D)/2 sous q = sigma_c w_s', () => {
    // q = 12 * 62,5 = 750 N/mm ; l = 75 ; M = 750 * 75^2 / 2 = 2,109375 kN.m ; V = 56,25 kN
    const s = sollicitationsContinu(12, 62.5, 300, 150);
    expect(s.M_Ed).toBeCloseTo(2.109375, 12);
    expect(s.V_Ed).toBeCloseTo(56.25, 12);
  });

  it('des ames plus courtes que la couronne ne portent rien', () => {
    expect(sollicitationsContinu(12, 62.5, 140, 150).M_Ed).toBe(0);
  });
});

describe('sollicitationsExtremites', () => {
  it('part N L / 4 et part N / 2', () => {
    const s = sollicitationsExtremites(1000, 0.5, 300);
    expect(s.M_Ed).toBeCloseTo(37.5, 12);
    expect(s.V_Ed).toBe(250);
  });

  it('refuse une portee absente', () => {
    expect(() => sollicitationsExtremites(1000, 0.5, Number.NaN)).toThrow(/portee/);
  });
});

describe('verifierFlexionTranchant — chaise sur lierne, L = 300', () => {
  const a = chaiseSurLierne();
  const section = sectionEnTe(a.platine, a.plats, 235, true);
  const r = verifierFlexionTranchant(
    sollicitationsExtremites(1000, 0.5, 300), section, 30, 150, 20, 235, 235, 1,
  );

  /**
   * M_el,Rd = W_chant f_y = 151 180,51 * 235 = 35,527421 kN.m
   * V_pl,Rd = 150 * 20 * 235 / racine(3) = 407,031940 kN
   * V / V_pl = 0,614202 > 0,5 : rho = (1,228405 - 1)^2 = 0,052169
   * M_V,Rd = 33,673999 kN.m ; taux 37,5 / 33,674 = 1,113619
   */
  it('resistances', () => {
    expect(r.M_el_Rd).toBeCloseTo(35.527421, 6);
    expect(r.V_pl_Rd).toBeCloseTo(407.03194, 5);
  });

  it('interaction M-V', () => {
    expect(r.interactionMV).toBe(true);
    expect(r.rho).toBeCloseTo(0.052169, 6);
    expect(r.M_V_Rd).toBeCloseTo(33.673999, 6);
    expect(r.tauxFlexion).toBeCloseTo(1.113619, 6);
    expect(r.tauxTranchant).toBeCloseTo(0.614202, 6);
  });

  it('contraintes : chant comprime, platine tendue', () => {
    expect(r.sigma_chant).toBeCloseTo(248.047841, 5);
    expect(r.sigma_pied).toBeCloseTo(-59.201751, 5);
    expect(r.sigma_platine).toBeCloseTo(120.651669, 5);
  });

  it('sans interaction sous 0,5 V_pl,Rd', () => {
    const faible = verifierFlexionTranchant(
      sollicitationsExtremites(600, 0.5, 300), section, 30, 150, 20, 235, 235, 1,
    );
    expect(faible.interactionMV).toBe(false);
    expect(faible.rho).toBe(0);
    expect(faible.M_V_Rd).toBe(faible.M_el_Rd);
  });
});
