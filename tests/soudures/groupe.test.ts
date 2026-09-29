import { describe, expect, it } from 'vitest';

import { analyserGroupe, proprietesDuGroupe, type CordonGroupe } from '../../src/soudures/groupe';

/**
 * Double cordon d un plat de 20 x 200 mm soude sur une platine, gorge 6 mm.
 * Plat centre a l origine : faces y = -10 et y = +10, longueur selon z.
 * Axes des cordons selon +z : la normale a +90 degres est -y, d ou
 * cote = +1 a gauche (e_2 = -y) et cote = -1 a droite (e_2 = +y).
 *
 * A = 2 * 6 * 200 = 2400 mm2
 * I_zz = 2 * 6 * 200^3 / 12 = 8 000 000 mm4
 * Cordons places au droit des faces, y = +-10, l inertie propre transversale
 * des bandes etant negligee : I_yy = 2400 * 10^2 = 240 000 mm4.
 */
function doubleCordon(): CordonGroupe[] {
  return [
    { id: 'gauche', y1: -10, z1: -100, y2: -10, z2: 100, a: 6, cote: 1 },
    { id: 'droit', y1: 10, z1: -100, y2: 10, z2: 100, a: 6, cote: -1 },
  ];
}

describe('proprietesDuGroupe', () => {
  it('aire, centre et inerties du double cordon', () => {
    const p = proprietesDuGroupe(doubleCordon());
    expect(p.A).toBe(2400);
    expect(p.y_G).toBe(0);
    expect(p.z_G).toBe(0);
    expect(p.I_zz).toBeCloseTo(8_000_000, 6);
    expect(p.I_yy).toBeCloseTo(240_000, 6);
    expect(p.I_yz).toBeCloseTo(0, 9);
  });

  it('refuse un groupe vide et un cordon de longueur nulle', () => {
    expect(() => proprietesDuGroupe([])).toThrow(/au moins un cordon/);
    expect(() =>
      proprietesDuGroupe([{ id: 'x', y1: 0, z1: 0, y2: 0, z2: 0, a: 5, cote: 1 }]),
    ).toThrow(/longueur/);
  });

  it('refuse une gorge nulle', () => {
    expect(() =>
      proprietesDuGroupe([{ id: 'x', y1: 0, z1: 0, y2: 0, z2: 10, a: 0, cote: 1 }]),
    ).toThrow(/gorge/);
  });
});

describe('analyserGroupe — double cordon en te', () => {
  it('traction N : p_1 = N / (2 l) sur chaque cordon', () => {
    // N = 240 kN : sigma_w = 240000 / 2400 = 100 MPa ; p_1 = 100 * 6 / 1000 = 0,6 kN/mm
    const r = analyserGroupe(doubleCordon(), { N: 240 });
    for (const c of r.cordons) {
      for (const pt of c.points) {
        expect(pt.sigma_w).toBeCloseTo(100, 9);
        expect(pt.efforts.p_1).toBeCloseTo(0.6, 12);
        // gorge d angle : 600 / (6 racine 2) = 70,710678 MPa
        expect(pt.gorge.sigma_perp).toBeCloseTo(70.710678, 5);
        expect(pt.gorge.tau_perp).toBeCloseTo(70.710678, 5);
      }
    }
  });

  it('moment dans le plan du plat : sigma_w = M z / I_zz', () => {
    // M_y = 16 kN.m = 16e6 N.mm ; en z = 100 : 16e6 * 100 / 8e6 = 200 MPa
    const r = analyserGroupe(doubleCordon(), { M_y: 16 });
    const droit = r.cordons[1];
    expect(droit.points[0].sigma_w).toBeCloseTo(-200, 9);
    expect(droit.points[1].sigma_w).toBeCloseTo(200, 9);
  });

  it('moment autour de l axe des cordons : couple entre les deux cordons', () => {
    // M_z = 2,4 kN.m : sigma_w = 2,4e6 * 10 / 240000 = 100 MPa, signes opposes
    const r = analyserGroupe(doubleCordon(), { M_z: 2.4 });
    expect(r.cordons[0].points[0].sigma_w).toBeCloseTo(-100, 9);
    expect(r.cordons[1].points[0].sigma_w).toBeCloseTo(100, 9);
  });

  it('effort tranchant le long des cordons : cisaillement longitudinal pur', () => {
    // V_z = 120 kN : tau = 120000 / 2400 = 50 MPa, le long de l axe (+z)
    const r = analyserGroupe(doubleCordon(), { V_z: 120 });
    for (const c of r.cordons) {
      expect(c.points[0].tau_u).toBeCloseTo(50, 9);
      expect(c.points[0].tau_n).toBeCloseTo(0, 9);
      expect(c.points[0].gorge.tau_para).toBeCloseTo(50, 9);
    }
  });

  it('effort tranchant a travers l epaisseur : les deux cordons en sens contraires', () => {
    // V_y = 120 kN vers +y : cordon droit (e_2 = +y) -> tau_n = +50, gauche -> -50
    const r = analyserGroupe(doubleCordon(), { V_y: 120 });
    expect(r.cordons[1].points[0].tau_n).toBeCloseTo(50, 9);
    expect(r.cordons[0].points[0].tau_n).toBeCloseTo(-50, 9);
    // Pousser le plat vers le cordon droit comprime sa gorge.
    expect(r.cordons[1].points[0].gorge.sigma_perp).toBeLessThan(0);
    expect(r.cordons[0].points[0].gorge.sigma_perp).toBeGreaterThan(0);
  });

  it('torsion : tau = T r / I_p', () => {
    // T = 8,24 kN.m ; I_p = 8 240 000 ; au point (10, 100) :
    // tau_y = -T dz / I_p = -8,24e6 * 100 / 8,24e6 = -100 ; tau_z = T dy / I_p = 10
    const r = analyserGroupe(doubleCordon(), { T: 8.24 });
    const pt = r.cordons[1].points[1];
    expect(pt.tau_u).toBeCloseTo(10, 9);
    expect(pt.tau_n).toBeCloseTo(-100, 9);
  });

  it('cisaillement reserve a certains cordons', () => {
    const cordons = doubleCordon().map((c) => ({ ...c, reprendVz: c.id === 'droit' }));
    const r = analyserGroupe(cordons, { V_z: 120 });
    expect(r.cordons[1].points[0].tau_u).toBeCloseTo(100, 9);
    expect(r.cordons[0].points[0].tau_u).toBe(0);
  });
});

describe('analyserGroupe — groupes degeneres', () => {
  it('un cordon unique ne reprend pas de moment autour de son axe', () => {
    const seul: CordonGroupe[] = [{ id: 's', y1: 0, z1: -50, y2: 0, z2: 50, a: 5, cote: 1 }];
    expect(() => analyserGroupe(seul, { M_z: 1 })).toThrow(/aligne/);
    // mais un moment dans son plan, si
    expect(analyserGroupe(seul, { M_y: 1 }).cordons[0].points[1].sigma_w).toBeGreaterThan(0);
  });

  it('refuse une sollicitation non finie', () => {
    expect(() => analyserGroupe(doubleCordon(), { N: Number.NaN })).toThrow(/N/);
  });

  it('refuse un tranchant qu aucun cordon ne reprend', () => {
    const cordons = doubleCordon().map((c) => ({ ...c, reprendVy: false }));
    expect(() => analyserGroupe(cordons, { V_y: 10 })).toThrow(/V_y/);
  });
});
