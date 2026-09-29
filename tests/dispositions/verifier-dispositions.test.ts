import { describe, expect, it } from 'vitest';

import { REGLES_CHAISE, REGLES_CORDONS, type ContexteChaise } from '../../src/dispositions/regles';
import { verifierDispositions } from '../../src/dispositions/verifier-dispositions';
import { chaiseDeReference } from '../fixtures/chaise';

function ctx(): ContexteChaise {
  return { assemblage: chaiseDeReference(), materiau: { nuance: 'S235', qualiteZ: 'aucune' } };
}

function constat(r: ReturnType<typeof verifierDispositions>, id: string) {
  const c = r.constats.find((x) => x.id === id);
  if (c === undefined) throw new Error(`regle absente : ${id}`);
  return c;
}

describe('REGLES_CHAISE — chaise de reference', () => {
  const r = verifierDispositions(REGLES_CHAISE, ctx());

  it('aucune regle bloquante violee', () => {
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('qualite Z non applicable : la gorge de 10 n excede pas 0,5 t_w = 10', () => {
    // a = 10 n est PAS > 0,5 * 20 : la regle ne s applique pas
    expect(constat(r, 'qualite-z').applicable).toBe(false);
  });

  it('les informations sont rendues sans etre des violations', () => {
    expect(constat(r, 'exc3').applicable).toBe(true);
    expect(r.informations.some((i) => i.includes('EXC3'))).toBe(true);
    expect(constat(r, 'retours-extremite').motif).toMatch(/28,3|28\.3/);
  });

  it('contact direct non applicable quand il n est pas pose', () => {
    expect(constat(r, 'contact-direct').applicable).toBe(false);
    expect(constat(r, 'contact-direct').notApplicableReason).toMatch(/contact/);
  });
});

describe('REGLES_CHAISE — violations multiples, toutes rapportees', () => {
  it('gorge trop faible ET entraxe trop court ET inclinaison excessive', () => {
    const c = ctx();
    c.assemblage.soudure.a = 2.5;
    c.assemblage.plats.e = 180;
    c.assemblage.ancrage.inclinaison = 5;
    const r = verifierDispositions(REGLES_CHAISE, c);
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(3);
    expect(r.violations.join('\n')).toMatch(/§4\.5\.2\(2\)/);
    expect(r.violations.join('\n')).toMatch(/TA 2020/);
    expect(r.violations.join('\n')).toMatch(/EN 1537/);
  });

  it('qualite Z : avertissement, pas violation', () => {
    const c = ctx();
    c.assemblage.soudure.a = 12;
    const r = verifierDispositions(REGLES_CHAISE, c);
    expect(constat(r, 'qualite-z').satisfaite).toBe(false);
    expect(r.avertissements.some((a) => a.includes('Z25'))).toBe(true);
    expect(r.ok).toBe(true);
  });

  it('ame de classe 4 : h_w / t_w > 14 eps', () => {
    const c = ctx();
    c.assemblage.plats.h_w = 300;
    const r = verifierDispositions(REGLES_CHAISE, c);
    expect(constat(r, 'classe-ame').satisfaite).toBe(false);
  });

  it('percage trop large et couronne qui tombe dedans', () => {
    const c = ctx();
    c.assemblage.platine.d_0 = 270;
    const r = verifierDispositions(REGLES_CHAISE, c);
    expect(constat(r, 'pince-percage').satisfaite).toBe(false);
    expect(constat(r, 'couronne-sur-percage').satisfaite).toBe(false);
  });

  it('une regle qui leve est rapportee comme non evaluable, sans interrompre les autres', () => {
    const c = ctx();
    c.assemblage.plats.t_w = 120; // hors du tableau 3.1 : limiteElastique leve
    const r = verifierDispositions(REGLES_CHAISE, c);
    expect(constat(r, 'classe-ame').notApplicableReason).toMatch(/non evaluable/);
    expect(constat(r, 'gorge-min').applicable).toBe(true);
  });
});

describe('REGLES_CORDONS', () => {
  it('longueur efficace trop courte', () => {
    const r = verifierDispositions(REGLES_CORDONS, {
      cordons: [{ id: 'x', a: 8, l: 40, t_min: 20, type: 'angle' }],
      epaisseurs: [20, 20],
    });
    // max(30 ; 48) = 48 > 40
    expect(r.violations[0]).toMatch(/48/);
  });

  it('epaisseur hors domaine', () => {
    const r = verifierDispositions(REGLES_CORDONS, {
      cordons: [{ id: 'x', a: 3, l: 100, t_min: 3, type: 'angle' }],
      epaisseurs: [3, 10],
    });
    expect(r.violations.some((v) => v.includes('§4.1(1)'))).toBe(true);
  });

  it('les regles de gorge ne visent pas la penetration partielle', () => {
    const r = verifierDispositions(REGLES_CORDONS, {
      cordons: [{ id: 'x', a: 2, l: 10, t_min: 20, type: 'penetration-partielle' }],
      epaisseurs: [20, 20],
    });
    expect(r.ok).toBe(true);
    expect(r.constats.find((c) => c.id === 'gorge-min')?.applicable).toBe(false);
  });
});
