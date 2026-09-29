import { describe, expect, it } from 'vitest';

import { verifierProfilePlatine, type DonneesProfile } from '../../src/details/profile-platine';

/**
 * Profile soude 200 x 200, ame 10, semelles 15 ; gorges 7 (semelles), 5 (ame).
 * Cordons rabattus : exterieurs z = +-103,5 (A = 1400), interieurs z = +-81,5
 * (4 x 95 x 7 = 4 x 665), ame y = +-7,5 sur 170 (A = 850).
 * I_zz = 2*1400*103,5^2 + 4*665*81,5^2 + 2*5*170^3/12 = 51 756 851,67 mm4
 *
 * M_y = 50 kN.m, V_z = 100 kN :
 *   exterieur : sigma = 50e6 * 103,5 / I = 99,9868 MPa -> taux 0,392785
 *   ame, z = 85 : sigma = 82,1147, tau_para = 100 000 / 1700 = 58,8235
 *     equivalente 154,4872 -> taux 0,429131 : l ame gouverne
 */
function profile(): DonneesProfile {
  return {
    h: 200,
    b: 200,
    t_w: 10,
    t_f: 15,
    a_f: 7,
    a_w: 5,
    t_platine: 20,
    sollicitations: { N: 0, V_y: 0, V_z: 100, M_y: 50, M_z: 0 },
    materiau: { nuance: 'S235', qualiteZ: 'aucune' },
  };
}

describe('verifierProfilePlatine', () => {
  const r = verifierProfilePlatine(profile());

  it('inertie du groupe', () => {
    expect(r.cordons.groupe.proprietes.I_zz).toBeCloseTo(51756851.67, 1);
  });

  it('les cordons d ame gouvernent sous M_y et V_z', () => {
    expect(r.cordons.gouvernant.cordon).toMatch(/^ame/);
    expect(r.cordons.taux).toBeCloseTo(0.429131, 6);
  });

  it('cordon exterieur de semelle', () => {
    const ext = r.cordons.points.filter((p) => p.cordon === 'semelle-haute-ext');
    expect(ext[0].directionnelle.tauxEquivalent).toBeCloseTo(0.392785, 6);
  });

  it('le tranchant V_z ne charge pas les semelles', () => {
    const sem = r.cordons.groupe.cordons.find((c) => c.cordon.id === 'semelle-haute-ext');
    expect(sem?.points[0].tau_u).toBe(0);
    expect(sem?.points[0].tau_n).toBe(0);
  });

  it('refuse des semelles plus epaisses que la demi-hauteur', () => {
    expect(() => verifierProfilePlatine({ ...profile(), t_f: 100 })).toThrow(/2 t_f < h/);
  });
});
