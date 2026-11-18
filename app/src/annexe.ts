/**
 * Annexe nationale (lot E, audit R4) : profil de calcul selon l'annexe choisie et
 * les coefficients saisis. Module PUR.
 *
 * Le noyau ne connait aucune annexe : le profil luxembourgeois est construit ici a
 * partir du profil recommande du noyau et de `valeurLu` (aedificium-ui). Chaque
 * coefficient saisi est prerempli par l'annexe et reste modifiable ; une valeur
 * changee est marquee « valeur imposée par l’utilisateur » dans sa source.
 */

import { avertissementAnnexeLu, lireAnnexe, nombreAffiche, valeurLu, type AnnexeNationale } from 'aedificium-ui';
import { ec3Recommande, type ProfilEC3 } from '../../src/index';

/** Coefficients saisis dans le formulaire (champs existants, pas de champ nouveau). */
export const COEFS = ['gamma_M0', 'gamma_M1', 'gamma_M2', 'gamma_c'] as const;
export type CleCoef = (typeof COEFS)[number];
/** Valeurs saisies ; un coefficient absent du formulaire garde la valeur de l'annexe. */
export type Coefs = Partial<Record<CleCoef, number>>;

/** Toutes les valeurs sourcees du profil du noyau ; les quatre premieres sont saisies. */
export const CLES_PROFIL = ['gamma_M0', 'gamma_M1', 'gamma_M2', 'eta', 'E', 'beta_j', 'gamma_c'] as const;
export type CleProfil = (typeof CLES_PROFIL)[number];

/** Source recommandee de chaque valeur : partie d'Eurocode, puis clause ou tableau. */
const SOURCES: Record<CleProfil, string> = {
  gamma_M0: 'EN 1993-1-1 §6.1(1)',
  gamma_M1: 'EN 1993-1-1 §6.1(1)',
  gamma_M2: 'EN 1993-1-8 tableau 2.1',
  eta: 'EN 1993-1-5 §5.1(2)',
  E: 'EN 1993-1-1 §3.2.6',
  beta_j: 'EN 1993-1-8 §6.2.5(7)',
  gamma_c: 'EN 1992-1-1 tableau 2.1N',
};

export interface ValeurSourcee {
  valeur: number;
  source: string;
}

export type ProfilSource = Record<CleProfil, ValeurSourcee>;

export interface ProfilAnnexe {
  nom: string;
  valeurs: ProfilSource;
}

const NOM_RECOMMANDE = 'EC3_recommande';
const NOM_LU = 'EC3_Luxembourg (ILNAS AN-LU:2020, valeurs présumées)';

/** Partie d'Eurocode et clause d'une source recommandee (repli : partie EN 1993, source entiere). */
export function decomposerSource(source: string): { partie: string; clause: string } {
  const m = /^(EN \d{4}(?:-\d+)*)\s+(.+)$/.exec(source);
  return m === null ? { partie: 'EN 1993', clause: source } : { partie: m[1] ?? 'EN 1993', clause: m[2] ?? source };
}

function profilRecommande(): ProfilSource {
  const p: ProfilEC3 = ec3Recommande();
  return {
    gamma_M0: { valeur: p.gamma_M0, source: SOURCES.gamma_M0 },
    gamma_M1: { valeur: p.gamma_M1, source: SOURCES.gamma_M1 },
    gamma_M2: { valeur: p.gamma_M2, source: SOURCES.gamma_M2 },
    eta: { valeur: p.eta, source: SOURCES.eta },
    E: { valeur: p.E, source: SOURCES.E },
    beta_j: { valeur: p.beta_j, source: SOURCES.beta_j },
    gamma_c: { valeur: p.gamma_c, source: SOURCES.gamma_c },
  };
}

/** Profil luxembourgeois : chaque valeur sourcee passe par `valeurLu`. */
function profilLu(): ProfilSource {
  const rec = profilRecommande();
  const lu = (k: CleProfil): ValeurSourcee => {
    const { partie, clause } = decomposerSource(rec[k].source);
    return valeurLu(partie, k, rec[k], clause);
  };
  return {
    gamma_M0: lu('gamma_M0'),
    gamma_M1: lu('gamma_M1'),
    gamma_M2: lu('gamma_M2'),
    eta: lu('eta'),
    E: lu('E'),
    beta_j: lu('beta_j'),
    gamma_c: lu('gamma_c'),
  };
}

/** Profil normatif de l'annexe choisie, valeurs sourcees. */
export function profilDeLAnnexe(a: AnnexeNationale): ProfilAnnexe {
  return a === 'lu' ? { nom: NOM_LU, valeurs: profilLu() } : { nom: NOM_RECOMMANDE, valeurs: profilRecommande() };
}

/** Valeurs des coefficients saisis d'une annexe, pour prefremplir le formulaire. */
export function coefsDeLAnnexe(a: AnnexeNationale): Record<CleCoef, number> {
  const p = profilDeLAnnexe(a).valeurs;
  return { gamma_M0: p.gamma_M0.valeur, gamma_M1: p.gamma_M1.valeur, gamma_M2: p.gamma_M2.valeur, gamma_c: p.gamma_c.valeur };
}

/**
 * Profil de calcul : celui de l'annexe, chaque coefficient saisi different de sa
 * valeur d'annexe marque « valeur imposée par l’utilisateur ».
 */
export function profilDeCalcul(a: AnnexeNationale, saisis: Coefs): ProfilAnnexe {
  const base = profilDeLAnnexe(a);
  const valeurs: ProfilSource = { ...base.valeurs };
  for (const k of COEFS) {
    const x = saisis[k];
    const b = base.valeurs[k];
    if (x !== undefined && x !== b.valeur) {
      valeurs[k] = {
        valeur: x,
        source: `valeur imposée par l’utilisateur (profil : ${nombreAffiche(b.valeur, 4)}, ${b.source})`,
      };
    }
  }
  return { nom: base.nom, valeurs };
}

/** Profil numerique attendu par le noyau. */
export function profilEC3(p: ProfilAnnexe): ProfilEC3 {
  const v = p.valeurs;
  return {
    name: p.nom,
    gamma_M0: v.gamma_M0.valeur,
    gamma_M1: v.gamma_M1.valeur,
    gamma_M2: v.gamma_M2.valeur,
    eta: v.eta.valeur,
    E: v.E.valeur,
    beta_j: v.beta_j.valeur,
    gamma_c: v.gamma_c.valeur,
  };
}

/** Le fichier de saisie : le modele du noyau, plus l'annexe choisie. */
export function avecAnnexe(texte: string, annexe: AnnexeNationale): string {
  const o = JSON.parse(texte) as Record<string, unknown>;
  return `${JSON.stringify({ ...o, annexe }, null, 2)}\n`;
}

/** Annexe d'un fichier enregistre ; un ancien fichier sans annexe donne `recommande`. */
export function annexeDuFichier(texte: string): AnnexeNationale {
  try {
    const o = JSON.parse(texte) as Record<string, unknown>;
    return lireAnnexe(o.annexe);
  } catch {
    return 'recommande';
  }
}

/** Avertissement de l'annexe luxembourgeoise, vide quand les valeurs sont verifiees. */
export function avertissementDeLAnnexe(a: AnnexeNationale): string {
  return a === 'lu' ? avertissementAnnexeLu() : '';
}
