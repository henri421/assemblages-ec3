import { describe, expect, it } from 'vitest';

import { sectionEnTe } from '../../src/ames/section-composee';
import { chaiseDeReference } from '../fixtures/chaise';

describe('sectionEnTe — chaise de reference', () => {
  const a = chaiseDeReference();
  const s = sectionEnTe(a.platine, a.plats, 235, false);

  it('largeurs participantes', () => {
    expect(s.b_eff_max).toBe(55);
    expect(s.b_int).toBe(55);
    expect(s.b_ext).toBe(30);
    expect(s.B_f).toBe(105);
  });

  it('aire, axe neutre, inertie, moment statique', () => {
    expect(s.A).toBe(6150);
    expect(s.z_G).toBeCloseTo(58.902439, 6);
    expect(s.I).toBeCloseTo(18307591.46, 1);
    expect(s.S_f).toBeCloseTo(138292.68, 1);
    expect(s.W_platine).toBeCloseTo(310812.11, 1);
    expect(s.W_chant).toBeCloseTo(151180.51, 1);
  });

  it('le percage de 80 ne touche pas la largeur participante (bord a 45 mm de l axe)', () => {
    const net = sectionEnTe(a.platine, a.plats, 235, true);
    expect(net.percageDeduit).toBe(false);
    expect(net.B_f).toBe(105);
  });

  it('un percage de 120 en retire 15 mm cote tirant', () => {
    const net = sectionEnTe({ ...a.platine, d_0: 120 }, a.plats, 235, true);
    expect(net.percageDeduit).toBe(true);
    expect(net.b_int).toBe(40);
  });
});

describe('sectionEnTe — 15 eps t gouverne une platine mince', () => {
  it('t = 3 mm en S355 : 15 * 0,813616 * 3 = 36,6127 mm', () => {
    const a = chaiseDeReference();
    const s = sectionEnTe({ ...a.platine, t: 3 }, a.plats, 355, false);
    expect(s.b_eff_max).toBeCloseTo(36.61274, 4);
  });
});

describe('sectionEnTe — entrees invalides', () => {
  const a = chaiseDeReference();
  it('refuse une epaisseur d ame nulle', () => {
    expect(() => sectionEnTe(a.platine, { ...a.plats, t_w: 0 }, 235, false)).toThrow(/epaisseur d ame/i);
  });
  it('refuse une platine trop etroite pour les ames', () => {
    expect(() => sectionEnTe({ ...a.platine, b: 200 }, a.plats, 235, false)).toThrow(/couvrir/);
  });
});
