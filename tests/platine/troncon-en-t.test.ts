import { describe, expect, it } from 'vitest';

import type { Assemblage } from '../../src/model/assemblage';
import { ec3Recommande } from '../../src/norms/ec3-recommande';
import {
  aireEffective,
  largeurDAppuiExtremite,
  verifierTronconEnT,
} from '../../src/platine/troncon-en-t';
import { chaiseDeReference } from '../fixtures/chaise';

/** Ecart relatif, pour les aires integrees sur grille. */
function ecartRelatif(a: number, b: number): number {
  return Math.abs(a - b) / Math.abs(b);
}

describe('aireEffective — cas sans recouvrement, forme fermee', () => {
  // Platine 1000 x 1000, couronne D = 100, percage 40, c = 50 :
  //   disque R = 100 prive du percage : pi (100^2 - 20^2) = 30 159,29 mm2
  //   deux ames 20 x 400 elargies de 50 : 2 * 120 * 500 = 120 000 mm2
  //   bord interieur des bandes a 300 - 60 = 240 > 100 : aucun recouvrement
  const large: Assemblage = {
    ...chaiseDeReference(),
    platine: { b: 1000, h: 1000, t: 30, d_0: 40 },
    plats: { t_w: 20, h_w: 150, L_w: 400, e: 600 },
    ancrage: { D: 100, inclinaison: 0 },
  };

  it('avec les ames : 150 159,29 mm2', () => {
    expect(ecartRelatif(aireEffective(large, 50, true), 150159.29)).toBeLessThan(1e-3);
  });

  it('sans les ames : 30 159,29 mm2', () => {
    expect(ecartRelatif(aireEffective(large, 50, false), 30159.29)).toBeLessThan(1e-3);
  });
});

describe('verifierTronconEnT — chaise de reference, appui continu', () => {
  /**
   * f_cd = 30 / 1,5 = 20 ; f_jd = 2/3 * 20 = 13,3333 MPa
   * c = 30 racine(235 / (3 * 13,3333)) = 72,715198 mm
   * g = 110 - 10 - 75 = 25 <= c : ames dans le contour
   * Bandes des ames |y| >= 27,284802 sur toute la platine : 73 629,12 mm2
   * Disque R = 147,715198 dans |y| < 27,284802 : 16 029,37 mm2
   * Percage : pi 40^2 = 5 026,55 mm2
   * A_eff = 84 631,94 mm2 ; F_c,Rd = 1128,43 kN ; taux = 0,886190
   */
  const r = verifierTronconEnT(chaiseDeReference(), 1000, 235, ec3Recommande());

  it('resistance d appui et largeur c', () => {
    expect(r.f_cd).toBeCloseTo(20, 12);
    expect(r.f_jd).toBeCloseTo(13.333333, 6);
    expect(r.c).toBeCloseTo(72.715198, 6);
    expect(r.g).toBe(25);
    expect(r.amesDansLeContour).toBe(true);
  });

  it('aire efficace et taux', () => {
    expect(ecartRelatif(r.A_eff, 84631.94)).toBeLessThan(1e-3);
    expect(r.taux).toBeCloseTo(0.88619, 3);
    expect(r.sigma_c).toBeCloseTo(11.8159, 2);
  });

  it('largeur collectee par une ame : 20 + 30 + 12,5', () => {
    expect(r.b_ext).toBe(30);
    expect(r.w_s).toBeCloseTo(62.5, 12);
  });

  it('les ames sortent du contour quand g depasse c', () => {
    const a = chaiseDeReference();
    a.plats.e = 400;
    a.platine.b = 500;
    const loin = verifierTronconEnT(a, 1000, 235, ec3Recommande());
    // g = 200 - 10 - 75 = 115 > 72,7
    expect(loin.amesDansLeContour).toBe(false);
    expect(loin.motifAmesExclues).toMatch(/115/);
    expect(loin.w_s).toBe(0);
  });

  it('k_j releve la resistance d appui', () => {
    const a = chaiseDeReference();
    a.appui.k_j = 2;
    const r2 = verifierTronconEnT(a, 1000, 235, ec3Recommande());
    expect(r2.f_jd).toBeCloseTo(26.666667, 6);
  });
});

describe('verifierTronconEnT — appui aux extremites', () => {
  it('bandes t_w + 2c sous chaque ame, sur la longueur d appui', () => {
    const a = chaiseDeReference();
    a.schema = 'appui-extremites';
    a.plats.L = 600;
    a.appui.l_appui = 100;
    const r = verifierTronconEnT(a, 1000, 235, ec3Recommande());
    // bandes [-150 ; -27,2848] et [27,2848 ; 150] : 245,430396 mm
    expect(r.A_eff).toBeCloseTo(24543.0396, 3);
    expect(r.N_appui).toBe(500);
  });
});

describe('largeurDAppuiExtremite', () => {
  it('deux bandes disjointes', () => {
    expect(largeurDAppuiExtremite(300, 220, 20, 72.715198)).toBeCloseTo(245.430396, 5);
  });
  it('deux bandes qui se recouvrent se fondent', () => {
    expect(largeurDAppuiExtremite(300, 100, 20, 50)).toBe(220);
  });
});

describe('verifierTronconEnT — entrees invalides', () => {
  it('refuse un beton sans f_ck', () => {
    const a = chaiseDeReference();
    a.appui = { type: 'beton' };
    expect(() => verifierTronconEnT(a, 1000, 235, ec3Recommande())).toThrow(/f_ck/);
  });
  it('refuse k_j hors de [1 ; 3]', () => {
    const a = chaiseDeReference();
    a.appui.k_j = 3.5;
    expect(() => verifierTronconEnT(a, 1000, 235, ec3Recommande())).toThrow(/k_j/);
  });
  it('refuse une longueur d appui absente en appui aux extremites', () => {
    const a = chaiseDeReference();
    a.schema = 'appui-extremites';
    expect(() => verifierTronconEnT(a, 1000, 235, ec3Recommande())).toThrow(/longueur d appui/);
  });
});
