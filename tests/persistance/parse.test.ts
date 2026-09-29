import { describe, expect, it } from 'vitest';

import { verifierAssemblage, type DonneesAssemblage } from '../../src/domaines/verifier-assemblage';
import { ec3Recommande } from '../../src/norms/ec3-recommande';
import { serialiser } from '../../src/persistance/format-modele';
import { lireModele } from '../../src/persistance/parse';
import type { DonneesProfile } from '../../src/details/profile-platine';
import type { DonneesRecouvrement } from '../../src/details/recouvrement';
import type { DonneesTe } from '../../src/details/te';
import { chaiseDeReference } from '../fixtures/chaise';

function donnees(): DonneesAssemblage {
  return {
    assemblage: chaiseDeReference(),
    materiau: { nuance: 'S235', qualiteZ: 'Z15' },
    actions: { N_ELU: 1000, P_blocage: 600 },
    profil: ec3Recommande(),
    conditionsSoudage: { forme: 'angle-multipasse', bridage: 'faible', prechauffage: false },
    delta_lim: 0.5,
  };
}

describe('serialiser puis lireModele', () => {
  it('aller-retour sans perte, meme verdict', () => {
    const d = donnees();
    const relu = lireModele(serialiser({ detail: 'chaise-ancrage', donnees: d }));
    if (relu.detail !== 'chaise-ancrage') throw new Error('type de detail perdu');
    expect(relu.donnees).toEqual(JSON.parse(JSON.stringify(d)));
    expect(verifierAssemblage(relu.donnees).taux).toEqual(verifierAssemblage(d).taux);
  });
});

describe('serialiser puis lireModele — details types', () => {
  it('te', () => {
    const d: DonneesTe = {
      nature: 'angle', t_p: 20, L: 200, t_b: 20,
      soudure: { type: 'angle', a: 6, cotes: 2 },
      sollicitations: { N: 240, V_para: 0, V_perp: 0, M_plan: 0, M_hors: 0 },
      materiau: { nuance: 'S355', qualiteZ: 'Z25' },
    };
    const relu = lireModele(serialiser({ detail: 'te', donnees: d }));
    expect(relu).toEqual({ format: 'assemblages-ec3', version: 1, detail: 'te', donnees: d });
  });

  it('recouvrement', () => {
    const d: DonneesRecouvrement = {
      b_p: 100, t_p: 10, b_b: 120, t_b: 10, L_r: 100, a: 5,
      cordons: { lateraux: true, frontal: false },
      sollicitations: { N: 100, V: 0, M: 0 },
      materiau: { nuance: 'S235', qualiteZ: 'aucune' },
    };
    expect(lireModele(serialiser({ detail: 'recouvrement', donnees: d })).donnees).toEqual(d);
  });

  it('profile sur platine', () => {
    const d: DonneesProfile = {
      h: 200, b: 200, t_w: 10, t_f: 15, a_f: 7, a_w: 5, t_platine: 20,
      sollicitations: { N: 0, V_y: 0, V_z: 100, M_y: 50, M_z: 0 },
      materiau: { nuance: 'S235', qualiteZ: 'aucune' },
    };
    expect(lireModele(serialiser({ detail: 'profile-platine', donnees: d })).donnees).toEqual(d);
  });

  it('refuse un nombre de cotes absurde', () => {
    const f = { format: 'assemblages-ec3', version: 1, detail: 'te', donnees: { soudure: { cotes: 3 }, sollicitations: {} } };
    expect(() => lireModele(JSON.stringify(f))).toThrow(/cotes/);
  });
});

describe('lireModele — refus motives', () => {
  it('pas du JSON', () => {
    expect(() => lireModele('{')).toThrow(/JSON/);
  });

  it('mauvais format', () => {
    expect(() => lireModele('{"format":"autre","version":1}')).toThrow(/format/);
  });

  it('version future', () => {
    expect(() => lireModele('{"format":"assemblages-ec3","version":2}')).toThrow(/Version/);
  });

  it('champ manquant nomme par son chemin', () => {
    const f = JSON.parse(serialiser({ detail: 'chaise-ancrage', donnees: donnees() }));
    delete f.donnees.assemblage.platine.t;
    expect(() => lireModele(JSON.stringify(f))).toThrow(/platine\.t/);
  });

  it('nuance inconnue', () => {
    const f = JSON.parse(serialiser({ detail: 'chaise-ancrage', donnees: donnees() }));
    f.donnees.materiau.nuance = 'S999';
    expect(() => lireModele(JSON.stringify(f))).toThrow(/nuance/);
  });
});
