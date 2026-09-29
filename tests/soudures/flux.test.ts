import { describe, expect, it } from 'vitest';

import {
  fluxDansLesCordons,
  longueurChargee,
  longueurDAppui,
  momentDEncastrement,
} from '../../src/soudures/flux';
import type { Assemblage } from '../../src/model/assemblage';
import { AME_DE_REFERENCE, chaiseDeReference } from '../fixtures/chaise';

/** Appui continu : pression et largeurs fixees a la main, pour des valeurs exactes. */
const CONTINU = { sigma_c: 12, w_s: 62.5, b_ext: 30 };
const COMMUN = { f_y_platine: 235, f_y_ame: 235, ame: AME_DE_REFERENCE };

function surLierne(): Assemblage {
  const a = chaiseDeReference();
  a.schema = 'appui-extremites';
  a.plats.L = 600;
  a.appui = { type: 'lierne-acier', t_w_lierne: 8, h_w_lierne: 200, t_f_lierne: 12, b_f_lierne: 90 };
  return a;
}

describe('longueurChargee', () => {
  it('diffusion a 45 degres dans la platine, bornee par le cordon', () => {
    expect(longueurChargee(300, 150, 30)).toBe(210);
    expect(longueurChargee(180, 150, 30)).toBe(180);
  });
});

describe('momentDEncastrement', () => {
  it('charge centree : P e / 8', () => {
    expect(momentDEncastrement(1000, 110, 220)).toBeCloseTo(27500, 9);
  });

  it('charge excentree : P x (e - x)^2 / e^2, plus fort sur l ame proche', () => {
    // x = 60, e = 220 : 1000 * 60 * 160^2 / 220^2 = 31 735,54
    expect(momentDEncastrement(1000, 60, 220)).toBeCloseTo(31735.53719, 5);
  });
});

describe('fluxDansLesCordons — appui continu, pression collectee', () => {
  /**
   * sigma_c = 12 MPa, w_s = 62,5 mm, b_ext = 30 mm :
   *   F_Ed = -12 * 62,5 / 1000 = -0,75 kN/mm ; -0,375 par cordon
   *   m = 12 * 30^2 / 2 / 1000 = 5,4 kN (sous 23,5 et 52,875) ; delta_F = 0,18
   *   V = 12 * 62,5 * 150 / 2 / 1000 = 56,25 kN ; v = 0,4249037 kN/mm
   */
  const f = fluxDansLesCordons({
    assemblage: chaiseDeReference(), N_Ed: 1000, ...COMMUN, appuiContinu: CONTINU,
  });

  it('effort transversal et moment de console', () => {
    expect(f.F_Ed).toBeCloseTo(-0.75, 12);
    expect(f.m_elastique).toBeCloseTo(5.4, 12);
    expect(f.borne).toBe('elastique');
    expect(f.delta_F).toBeCloseTo(0.18, 12);
  });

  it('flux longitudinal de la poutre en te', () => {
    expect(f.V_Ed).toBeCloseTo(56.25, 12);
    expect(f.v_Ed).toBeCloseTo(0.4249037, 6);
    expect(f.l_appui).toBeNull();
  });

  it('cordons : interieur -0,195, exterieur -0,555 kN/mm', () => {
    expect(f.cas.find((c) => c.id === 'interieur')?.efforts.p_1).toBeCloseTo(-0.195, 12);
    expect(f.cas.find((c) => c.id === 'exterieur')?.efforts.p_1).toBeCloseTo(-0.555, 12);
    expect(f.cas).toHaveLength(2);
  });

  it('refuse l absence du troncon en te', () => {
    expect(() =>
      fluxDansLesCordons({ assemblage: chaiseDeReference(), N_Ed: 1000, ...COMMUN }),
    ).toThrow(/troncon en te/);
  });

  it('ames hors contour : aucun effort ne leur parvient', () => {
    const g = fluxDansLesCordons({
      assemblage: chaiseDeReference(), N_Ed: 1000, ...COMMUN,
      appuiContinu: { sigma_c: 12, w_s: 0, b_ext: 30 },
    });
    expect(g.F_Ed === 0).toBe(true);
    expect(g.delta_F).toBe(0);
    expect(g.v_Ed).toBe(0);
  });
});

describe('fluxDansLesCordons — le moment local est present meme avec contact direct', () => {
  it('appui continu : la compression quitte la gorge, la traction du couple y reste', () => {
    const a = chaiseDeReference();
    a.soudure.contactDirect = true;
    const f = fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...COMMUN, appuiContinu: CONTINU });
    // Sous un effort global de compression, le cordon interieur est TENDU.
    expect(f.cas.find((c) => c.id === 'interieur')?.efforts.p_1).toBeCloseTo(0.18, 12);
    expect(f.cas.find((c) => c.id === 'exterieur')?.efforts.p_1).toBe(0);
  });

  it('extremites : le couple s ajoute a la suspension, contact ou non', () => {
    const avec = surLierne();
    avec.soudure.contactDirect = true;
    const fAvec = fluxDansLesCordons({ assemblage: avec, N_Ed: 1000, ...COMMUN });
    const fSans = fluxDansLesCordons({ assemblage: surLierne(), N_Ed: 1000, ...COMMUN });
    const pAvec = fAvec.cas.find((c) => c.id === 'interieur')?.efforts.p_1;
    expect(pAvec).toBeCloseTo(1.97381, 5);
    expect(pAvec).toBe(fSans.cas.find((c) => c.id === 'interieur')?.efforts.p_1);
  });
});

describe('fluxDansLesCordons — appui aux extremites, suspension', () => {
  /**
   * l_charge = 210 ; F = 500 / 210 = 2,380952 kN/mm (traction)
   * m_enc = 27500 / 210 = 130,952 -> borne par l ame : 23,5 kN ; delta_F = 0,783333
   * V = 250 kN ; v = 250 * 138292,68 / 18307591,46 = 1,888461 kN/mm
   * interieur : 1,190476 + 0,783333 = 1,973810 ; exterieur : 0,407143
   * appui : p_1 = -250 / (2 * 90) = -1,388889 kN/mm
   */
  const f = fluxDansLesCordons({ assemblage: surLierne(), N_Ed: 1000, ...COMMUN });

  it('suspension et moment d encastrement borne', () => {
    expect(f.F_Ed).toBeCloseTo(2.380952, 6);
    expect(f.m_elastique).toBeCloseTo(130.952381, 6);
    expect(f.m_Ed).toBeCloseTo(23.5, 12);
    expect(f.borne).toBe('ame');
    expect(f.delta_F).toBeCloseTo(0.783333, 6);
  });

  it('cordons en zone chargee', () => {
    expect(f.cas.find((c) => c.id === 'interieur')?.efforts.p_1).toBeCloseTo(1.97381, 5);
    expect(f.cas.find((c) => c.id === 'exterieur')?.efforts.p_1).toBeCloseTo(0.407143, 6);
  });

  it('flux longitudinal et cas au droit de l appui', () => {
    expect(f.V_Ed).toBe(250);
    expect(f.v_Ed).toBeCloseTo(1.888461, 6);
    expect(f.l_appui).toBe(90);
    const appui = f.cas.find((c) => c.id === 'interieur-appui');
    expect(appui?.efforts.p_1).toBeCloseTo(-1.388889, 6);
    expect(appui?.efforts.p_para).toBeCloseTo(0.9442305, 6);
    expect(f.cas).toHaveLength(4);
  });

  it('le contact retire la compression d appui', () => {
    const b = surLierne();
    b.soudure.contactDirect = true;
    const g = fluxDansLesCordons({ assemblage: b, N_Ed: 1000, ...COMMUN });
    expect(g.cas.find((c) => c.id === 'exterieur-appui')?.efforts.p_1).toBe(0);
  });

  it('longueurDAppui : la semelle de lierne en tient lieu', () => {
    expect(longueurDAppui(surLierne())).toBe(90);
    const b = surLierne();
    b.appui = { type: 'beton', f_ck: 30 };
    expect(() => longueurDAppui(b)).toThrow(/longueur d appui/);
  });
});

describe('fluxDansLesCordons — excentrement et inclinaison', () => {
  it('l ame proche reprend plus de la moitie de l effort', () => {
    const a = surLierne();
    a.ancrage.excentrement = 22;
    const f = fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...COMMUN });
    expect(f.part).toBeCloseTo(0.6, 12);
    expect(f.x_charge).toBe(88);
  });

  it('refuse un tirant hors de l entraxe', () => {
    const a = surLierne();
    a.ancrage.excentrement = 110;
    expect(() => fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...COMMUN })).toThrow(
      /excentrement/,
    );
  });

  it('H_Ed est examine dans les trois directions', () => {
    const f = fluxDansLesCordons({
      assemblage: chaiseDeReference(), N_Ed: 1000, H_Ed: 80, ...COMMUN, appuiContinu: CONTINU,
    });
    // h = 80 / (4 * 300) = 0,066667 kN/mm
    expect(f.h_Ed).toBeCloseTo(0.0666667, 7);
    expect(f.cas).toHaveLength(6);
    expect(f.cas.find((c) => c.id === 'interieur-H-long')?.efforts.p_para).toBeCloseTo(
      0.2124517 + 0.0666667,
      6,
    );
  });
});

describe('fluxDansLesCordons — entrees invalides', () => {
  it('refuse une gorge nulle', () => {
    const a = surLierne();
    a.soudure.a = 0;
    expect(() => fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...COMMUN })).toThrow(/gorge/i);
  });

  it('refuse un effort nul', () => {
    expect(() => fluxDansLesCordons({ assemblage: surLierne(), N_Ed: 0, ...COMMUN })).toThrow(
      /N_Ed/,
    );
  });

  it('refuse une epaisseur de platine negative', () => {
    const a = surLierne();
    a.platine.t = -30;
    expect(() => fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...COMMUN })).toThrow(
      /epaisseur de platine/i,
    );
  });

  it('refuse une inertie nulle', () => {
    expect(() =>
      fluxDansLesCordons({ assemblage: surLierne(), N_Ed: 1000, ...COMMUN, ame: { S_f: 1, I: 0 } }),
    ).toThrow(/inertie/i);
  });

  it('refuse une pression d appui negative', () => {
    expect(() =>
      fluxDansLesCordons({
        assemblage: chaiseDeReference(), N_Ed: 1000, ...COMMUN,
        appuiContinu: { sigma_c: -1, w_s: 62.5, b_ext: 30 },
      }),
    ).toThrow(/sigma_c/);
  });
});
