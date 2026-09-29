import { describe, expect, it } from 'vitest';

import { verifierTe, type DonneesTe } from '../../src/details/te';

/**
 * Plat 20 x 200 soude sur platine de 20, cordons de 6 des deux cotes, S235.
 * Cordons rabattus a y = +-13 : A = 2400 mm2, I_yy = 2400 * 13^2 = 405 600 mm4.
 *
 * N = 240 kN : p_1 = 0,6 kN/mm ; sigma_perp = tau_perp = 70,7107 MPa ;
 *   equivalente 141,4214 ; taux 0,392837.
 * Metal : 240 000 / 4000 = 60 MPa ; 60 / 235 = 0,255319.
 * Arrachement : a_eff = 8,49 -> 3 ; multipasse 0 ; t = 20 -> 4 ; Z_Ed = 7 <= 10.
 */
function plat(s: Partial<DonneesTe['sollicitations']> = {}): DonneesTe {
  return {
    nature: 'te',
    t_p: 20,
    L: 200,
    t_b: 20,
    soudure: { type: 'angle', a: 6, cotes: 2 },
    sollicitations: { N: 240, V_para: 0, V_perp: 0, M_plan: 0, M_hors: 0, ...s },
    materiau: { nuance: 'S235', qualiteZ: 'aucune' },
  };
}

describe('verifierTe — double cordon d angle', () => {
  it('traction : valeurs calculees a la main', () => {
    const r = verifierTe(plat());
    expect(r.cordons?.taux).toBeCloseTo(0.392837, 6);
    expect(r.metal.taux).toBeCloseTo(0.255319, 6);
    expect(r.arrachement.Z_Ed).toBe(7);
    expect(r.verdict).toBe('conforme');
    expect(r.mecanismeGouvernant).toBe('arrachement-lamellaire');
    expect(r.pleineResistance?.a_min).toBeCloseTo(9.231672, 5);
  });

  it('le moment autour de l axe s ajoute sur un cordon : couple M / (t_p + a)', () => {
    // M_hors = 2,4 kN.m : 2400 / 26 / 200 = 0,461538 kN/mm ; cote 1 : 1,061538
    // sigma_perp = 125,1035 ; equivalente 250,207 ; taux 0,695019
    const r = verifierTe(plat({ M_hors: 2.4 }));
    expect(r.cordons?.gouvernant.cordon).toBe('cote-1');
    expect(r.cordons?.taux).toBeCloseTo(0.695019, 6);
  });

  it('cisaillement longitudinal pur : les deux methodes coincident', () => {
    const r = verifierTe(plat({ N: 0, V_para: 120 }));
    expect(r.cordons?.methodesCoincident).toBe(true);
    const g = r.cordons!.gouvernant;
    expect(g.simplifiee.taux).toBeCloseTo(g.directionnelle.taux, 12);
  });

  it('pleine penetration : pas de calcul de gorge', () => {
    const d = plat();
    d.soudure.type = 'penetration-totale';
    const r = verifierTe(d);
    expect(r.cordons).toBeNull();
    expect(r.taux.find((t) => t.id === 'soudure')?.applicable).toBe(false);
  });

  it('penetration partielle : gorge parallele a la face de base', () => {
    const d = plat();
    d.soudure = { type: 'penetration-partielle', a: 6, cotes: 2 };
    // sigma_perp = 600 / 6 = 100 MPa, tau_perp = 0 : equivalente 100 / 360 = 0,277778,
    // mais la gorge est tendue : 100 / 259,2 = 0,385802 gouverne
    const g = verifierTe(d).cordons!.gouvernant.directionnelle;
    expect(g.tauxEquivalent).toBeCloseTo(0.277778, 6);
    expect(g.taux).toBeCloseTo(0.385802, 6);
  });
});

describe('verifierTe — cordon unique', () => {
  it('refuse la traction (§4.12)', () => {
    const d = plat();
    d.soudure.cotes = 1;
    expect(() => verifierTe(d)).toThrow(/§4\.12/);
  });

  it('admet le cisaillement', () => {
    const d = plat({ N: 0, V_para: 60 });
    d.soudure.cotes = 1;
    // A = 1200 ; tau = 50 MPa ; equivalente 86,6025 ; taux 0,240563
    expect(verifierTe(d).cordons?.taux).toBeCloseTo(0.240563, 6);
  });
});

describe('verifierTe — cruciforme et angle', () => {
  it('cruciforme : meme mecanique que le te', () => {
    const r = verifierTe({ ...plat(), nature: 'cruciforme' });
    expect(r.detail).toBe('cruciforme');
    expect(r.cordons?.taux).toBeCloseTo(0.392837, 6);
  });

  it('angle : Z_b = 8, la piece de base reclame Z15', () => {
    const r = verifierTe({ ...plat(), nature: 'angle' });
    expect(r.arrachement.Z_b).toBe(8);
    expect(r.arrachement.Z_Ed).toBe(15);
    expect(r.arrachement.qualiteRequise).toBe('Z15');
    expect(r.verdict).toBe('non-conforme-resistance');
  });
});

describe('verifierTe — entrees invalides', () => {
  it('refuse une longueur nulle', () => {
    expect(() => verifierTe({ ...plat(), L: 0 })).toThrow(/longueur soudee/);
  });
  it('refuse une penetration partielle qui traverse', () => {
    const d = plat();
    d.soudure = { type: 'penetration-partielle', a: 10, cotes: 2 };
    expect(() => verifierTe(d)).toThrow(/penetration partielle/);
  });
});
