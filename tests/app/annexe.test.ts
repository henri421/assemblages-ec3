/**
 * Annexe nationale luxembourgeoise (lot E, audit R4) : profil LU et ses sources,
 * coefficients modifiables marques « imposés », annexe enregistree et relue, note
 * (norme, avertissement, sources visibles), valeurs recommandees inchangees.
 */

import { describe, expect, it } from 'vitest';
import { avertissementAnnexeLu, type ElementNote } from 'aedificium-ui';
import { lireModele, serialiser } from '../../src/index';
import { lireSaisie, valeursDepuisModele, valeursParDefaut } from '../../app/src/form';
import {
  annexeDuFichier,
  avecAnnexe,
  profilDeCalcul,
  profilDeLAnnexe,
  profilEC3,
} from '../../app/src/annexe';
import { calculer } from '../../app/src/calcul';
import { noteDuCalcul } from '../../app/src/sorties';

const CARTOUCHE = { projet: 'Pont de la Sûre', element: 'Tête d’ancrage T4', date: '2026-11-18' };

/** Modele de depart (tete d'ancrage) avec l'annexe et, eventuellement, un coefficient change. */
function modele(annexe: 'recommande' | 'lu', surcharge: Record<string, string> = {}) {
  const v = { ...valeursParDefaut('chaise-ancrage'), annexe, ...surcharge };
  const lecture = lireSaisie('chaise-ancrage', v);
  if (!lecture.ok) throw new Error(lecture.message);
  return lecture.modele;
}

/** La note de calcul de la tete d'ancrage pour une annexe et des coefficients donnes. */
function note(annexe: 'recommande' | 'lu', surcharge: Record<string, string> = {}) {
  const v = { ...valeursParDefaut('chaise-ancrage'), annexe, ...surcharge };
  const lecture = lireSaisie('chaise-ancrage', v);
  if (!lecture.ok) throw new Error(lecture.message);
  return noteDuCalcul('chaise-ancrage', v, calculer(lecture.modele), CARTOUCHE);
}

/** Lignes du bloc « Coefficients » de la note. */
function lignesCoefficients(n: ReturnType<typeof note>): ReadonlyArray<{ symbole: string; libelle: string; valeur: string }> {
  const bloc = n.sections.hypotheses?.find((e: ElementNote) => e.type === 'bloc' && e.bloc.titre === 'Coefficients');
  if (bloc === undefined || bloc.type !== 'bloc') throw new Error('bloc Coefficients absent de la note');
  return bloc.bloc.lignes;
}

describe('profil luxembourgeois', () => {
  it('chaque valeur est sourcee AN-LU, et les valeurs presumees egalent les recommandees', () => {
    const lu = profilDeLAnnexe('lu');
    for (const [cle, v] of Object.entries(lu.valeurs)) {
      expect(v.source, cle).toContain('ILNAS-EN');
      expect(v.source, cle).toContain('/AN-LU:2020');
      expect(v.source, cle).toContain('valeur recommandée présumée retenue');
    }
    expect(lu.valeurs.gamma_M2.source).toBe('ILNAS-EN 1993-1-8/AN-LU:2020, tableau 2.1 : valeur recommandée présumée retenue, non vérifiée sur l’annexe');
    expect(profilEC3(lu)).toEqual({ ...profilEC3(profilDeLAnnexe('recommande')), name: profilEC3(lu).name });
  });

  it('le nom du profil mentionne Luxembourg ; le profil recommande garde son nom', () => {
    expect(profilDeLAnnexe('lu').nom).toContain('Luxembourg');
    expect(profilDeLAnnexe('recommande').nom).toBe('EC3_recommande');
  });
});

describe('valeur changee par l utilisateur', () => {
  it('une valeur differente de l annexe est marquee imposee ; les autres gardent leur source', () => {
    const p = profilDeCalcul('lu', { gamma_M2: 1.1 });
    expect(p.valeurs.gamma_M2.valeur).toBe(1.1);
    expect(p.valeurs.gamma_M2.source).toContain('valeur imposée par l’utilisateur (profil : 1,25');
    expect(p.valeurs.gamma_M0.source).toContain('ILNAS-EN 1993-1-1/AN-LU:2020');
  });

  it('une valeur egale a celle de l annexe n est pas marquee', () => {
    const p = profilDeCalcul('recommande', { gamma_M2: 1.25 });
    expect(p.valeurs.gamma_M2.source).toBe('EN 1993-1-8 tableau 2.1');
  });
});

describe('fichier de saisie', () => {
  it('l annexe est enregistree et relue ; le fichier reste lisible par le noyau', () => {
    const texte = avecAnnexe(serialiser(modele('lu')), 'lu');
    expect(annexeDuFichier(texte)).toBe('lu');
    expect(lireModele(texte).detail).toBe('chaise-ancrage');
  });

  it('un ancien fichier sans annexe se relit avec les valeurs recommandees', () => {
    expect(annexeDuFichier(serialiser(modele('recommande')))).toBe('recommande');
  });

  it('les coefficients modifies sont relus avec leur valeur', () => {
    const m = modele('lu', { gamma_M2: '1,1' });
    const relu = valeursDepuisModele(m).valeurs;
    expect(relu.gamma_M2).toBe('1,1');
    expect(relu.gamma_M0).toBe('1');
  });
});

describe('saisie et calcul', () => {
  it('le profil du calcul porte le coefficient saisi et le nom de l annexe', () => {
    const m = modele('lu', { gamma_M2: '1,1' });
    expect(m.donnees.profil?.gamma_M2).toBe(1.1);
    expect(m.donnees.profil?.name).toContain('Luxembourg');
  });

  it('les valeurs recommandees sont inchangees', () => {
    const m = modele('recommande');
    expect(m.donnees.profil).toEqual({
      name: 'EC3_recommande',
      gamma_M0: 1,
      gamma_M1: 1,
      gamma_M2: 1.25,
      eta: 1.2,
      E: 210000,
      beta_j: 2 / 3,
      gamma_c: 1.5,
    });
  });
});

describe('note de calcul', () => {
  it('annexe luxembourgeoise : norme completee, avertissement en tete, sources des coefficients', () => {
    const n = note('lu');
    expect(n.cartouche.norme).toBe('EN 1993-1-8:2005, ILNAS-EN 1993-1-8/AN-LU:2020');
    expect(n.avertissements?.[0]).toBe(avertissementAnnexeLu());
    const lignes = lignesCoefficients(n);
    const m2 = lignes.find((l) => l.symbole === 'gamma_M2');
    expect(m2?.libelle).toContain('AN-LU:2020');
    expect(m2?.libelle).toContain('tableau 2.1');
  });

  it('valeur changee : marquee imposee dans la note', () => {
    const lignes = lignesCoefficients(note('lu', { gamma_M2: '1,1' }));
    expect(lignes.find((l) => l.symbole === 'gamma_M2')?.libelle).toContain('valeur imposée par l’utilisateur');
    expect(lignes.find((l) => l.symbole === 'gamma_M0')?.libelle).not.toContain('imposée');
  });

  it('annexe recommandee : norme inchangee, pas d avertissement d annexe', () => {
    const n = note('recommande');
    expect(n.cartouche.norme).toBe('EN 1993-1-8:2005');
    expect(n.avertissements).not.toContain(avertissementAnnexeLu());
    expect(lignesCoefficients(n).find((l) => l.symbole === 'gamma_M0')?.libelle).toContain('EN 1993-1-1');
  });
});
