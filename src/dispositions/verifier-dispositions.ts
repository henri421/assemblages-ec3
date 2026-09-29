/**
 * Moteur des dispositions constructives.
 *
 * Une seule implementation, deux points d appel : en temps reel pendant la
 * saisie, pour l assistance et les alertes, et en fin de parcours, pour le
 * tableau formel. Ne pas la dupliquer.
 */

import type { Regle, Severite } from './regles';

export interface ConstatRegle {
  id: string;
  clause: string;
  severite: Severite;
  enonce: string;
  applicable: boolean;
  /** Pourquoi la regle ne regit pas le cas ; null quand elle s applique. */
  notApplicableReason: string | null;
  /** Vrai si la regle est satisfaite ; toujours vrai pour une information. */
  satisfaite: boolean;
  /** Motif de la violation, ou texte de l information. */
  motif: string | null;
}

export interface ResultatDispositions {
  /** Vrai si aucune regle bloquante n est violee. */
  ok: boolean;
  constats: ConstatRegle[];
  /**
   * Regles bloquantes violees, chacune nommee par sa clause.
   *
   * Une LISTE et non un motif unique : une piece peut etre a la fois
   * sous-dimensionnee en gorge et non conforme en entraxe, et n en signaler
   * qu une en cacherait une.
   */
  violations: string[];
  avertissements: string[];
  informations: string[];
}

/**
 * Evalue un catalogue de regles sur un contexte.
 *
 * Une regle dont l evaluation leve — donnee absente ou invalide pendant la
 * saisie — n interrompt pas le catalogue : elle est rapportee comme non
 * evaluable, et les autres le sont.
 */
export function verifierDispositions<C>(regles: readonly Regle<C>[], ctx: C): ResultatDispositions {
  const constats: ConstatRegle[] = [];
  const violations: string[] = [];
  const avertissements: string[] = [];
  const informations: string[] = [];

  for (const r of regles) {
    const commun = { id: r.id, clause: r.clause, severite: r.severite, enonce: r.enonce };
    let raison: string | null;
    let motif: string | null;
    try {
      raison = r.applicabilite(ctx);
      motif = raison === null ? r.evaluer(ctx) : null;
    } catch (erreur) {
      const detail = erreur instanceof Error ? erreur.message : 'donnee invalide';
      constats.push({
        ...commun,
        applicable: false,
        notApplicableReason: `non evaluable : ${detail}`,
        satisfaite: false,
        motif: null,
      });
      continue;
    }

    if (raison !== null) {
      constats.push({ ...commun, applicable: false, notApplicableReason: raison, satisfaite: true, motif: null });
      continue;
    }

    const satisfaite = r.severite === 'information' || motif === null;
    constats.push({ ...commun, applicable: true, notApplicableReason: null, satisfaite, motif });
    if (motif === null) continue;
    const ligne = `${r.clause} : ${motif}`;
    if (r.severite === 'bloquante') violations.push(ligne);
    else if (r.severite === 'avertissement') avertissements.push(ligne);
    else informations.push(ligne);
  }

  return { ok: violations.length === 0, constats, violations, avertissements, informations };
}
