/**
 * Arrachement lamellaire — EN 1993-1-10:2005 §3.2 et EN 1993-1-1:2005 §3.2.4.
 *
 *   Z_Ed = Z_a + Z_b + Z_c + Z_d + Z_e  <=  Z_Rd
 *
 * Unites : epaisseurs et gorges en mm ; les valeurs Z sont sans dimension.
 */

import type { QualiteZ } from '../model/materiau';

/** Forme et position de la soudure, EN 1993-1-10 tableau 3.2 b). */
export type FormeSoudure =
  | 'angle-monopasse'
  | 'angle-multipasse'
  | 'penetration-sequence'
  | 'penetration'
  | 'assemblage-angle';

/** Bridage du retrait par le reste de la structure, tableau 3.2 d). */
export type Bridage = 'faible' | 'moyen' | 'fort';

export interface ConditionsSoudage {
  forme: FormeSoudure;
  bridage: Bridage;
  /** Prechauffage d au moins 100 degres C. */
  prechauffage: boolean;
}

export const CONDITIONS_PAR_DEFAUT: ConditionsSoudage = {
  forme: 'angle-multipasse',
  bridage: 'faible',
  prechauffage: false,
};

export interface DonneesArrachement {
  /** Epaisseur de la piece sollicitee dans le sens de son epaisseur (mm). */
  t: number;
  /** Gorge du cordon (mm) — ou profondeur de penetration pour une soudure bout a bout. */
  a: number;
  /** Cordon d angle : la profondeur efficace est la longueur du cote, a racine(2). */
  cordonDAngle: boolean;
  conditions: ConditionsSoudage;
  qualite: QualiteZ;
}

export interface ResultatArrachement {
  /** Profondeur de soudure efficace a_eff (mm). */
  a_eff: number;
  Z_a: number;
  Z_b: number;
  Z_c: number;
  Z_d: number;
  Z_e: number;
  Z_Ed: number;
  /** Valeur disponible de la qualite choisie (-). */
  Z_Rd: number;
  /** Qualite minimale qui satisfait Z_Ed <= Z_Rd. */
  qualiteRequise: QualiteZ;
  taux: number;
}

/**
 * Z_a, profondeur efficace de la soudure, tableau 3.2 a).
 *
 * Le seuil est celui de a_eff, la profondeur de metal fondu qui se retracte.
 * Pour un cordon d angle, c est la longueur du cote, a racine(2) : c est ce
 * que traduit le couple « a_eff <= 7 mm, a = 5 mm » du tableau.
 */
export function valeurZa(a_eff: number): number {
  if (a_eff <= 7) return 0;
  if (a_eff <= 10) return 3;
  if (a_eff <= 20) return 6;
  if (a_eff <= 30) return 9;
  if (a_eff <= 40) return 12;
  return 15;
}

const ZB: Record<FormeSoudure, number> = {
  'angle-monopasse': -5,
  'angle-multipasse': 0,
  'penetration-sequence': 3,
  'penetration': 5,
  'assemblage-angle': 8,
};

/** Z_c, effet de l epaisseur sur le bridage du retrait, tableau 3.2 c). */
export function valeurZc(t: number): number {
  if (t <= 10) return 2;
  if (t <= 20) return 4;
  if (t <= 30) return 6;
  if (t <= 40) return 8;
  if (t <= 50) return 10;
  if (t <= 60) return 12;
  return 15;
}

const ZD: Record<Bridage, number> = { faible: 0, moyen: 3, fort: 5 };

/**
 * Valeur disponible de la qualite, EN 1993-1-10 §3.2(2) : Z_Rd = Z15, Z25 ou
 * Z35. Sans exigence, Z_Rd = 10, seuil sous lequel l EN 1993-1-1 tableau 3.2
 * n exige aucune qualite.
 *
 * L EN 1993-1-1 tableau 3.2 est plus permissif sur le choix de la classe (Z15
 * jusqu a Z_Ed = 20, Z25 jusqu a 30) : l outil retient l inequation de
 * l EN 1993-1-10, plus severe, faute d un motif de l ecarter.
 */
export const Z_RD: Record<QualiteZ, number> = { aucune: 10, Z15: 15, Z25: 25, Z35: 35 };

const ORDRE: readonly QualiteZ[] = ['aucune', 'Z15', 'Z25', 'Z35'];

/**
 * Z_Ed et comparaison a la qualite choisie, EN 1993-1-10 §3.2.
 *
 * La piece a verifier est celle que les cordons sollicitent DANS SON
 * EPAISSEUR : la platine d une tete d ancrage, la piece traversante d un
 * assemblage cruciforme. C est le risque majeur de ces configurations.
 *
 * La note b du tableau 3.2 autorise a diviser Z_c par deux quand la piece
 * est comprimee dans son epaisseur sous charges statiques. La reduction
 * n est PAS appliquee : le moment local remet de la traction au pied des
 * cordons meme sous un effort global de compression.
 *
 * Au-dela de Z35, aucune qualite ne suffit : `qualiteRequise` vaut alors Z35
 * et le taux depasse 1.
 */
export function verifierArrachement(d: DonneesArrachement): ResultatArrachement {
  if (!Number.isFinite(d.t) || d.t <= 0) {
    throw new Error('L epaisseur t de la piece doit etre un nombre strictement positif (mm).');
  }
  if (!Number.isFinite(d.a) || d.a <= 0) {
    throw new Error('La gorge a doit etre un nombre strictement positif (mm).');
  }
  const a_eff = d.cordonDAngle ? d.a * Math.SQRT2 : d.a;
  const Z_a = valeurZa(a_eff);
  const Z_b = ZB[d.conditions.forme];
  const Z_c = valeurZc(d.t);
  const Z_d = ZD[d.conditions.bridage];
  const Z_e = d.conditions.prechauffage ? -8 : 0;
  if (Z_b === undefined || Z_d === undefined) {
    throw new Error('Conditions de soudage inconnues pour l arrachement lamellaire.');
  }
  const Z_Ed = Z_a + Z_b + Z_c + Z_d + Z_e;
  const Z_Rd = Z_RD[d.qualite];
  if (Z_Rd === undefined) {
    throw new Error(`Qualite Z inconnue : ${String(d.qualite)}.`);
  }
  const qualiteRequise = ORDRE.find((q) => Z_Ed <= Z_RD[q]) ?? 'Z35';
  return { a_eff, Z_a, Z_b, Z_c, Z_d, Z_e, Z_Ed, Z_Rd, qualiteRequise, taux: Math.max(0, Z_Ed) / Z_Rd };
}
