/**
 * Profile en I ou en H soude sur une platine : platine d about, pied de
 * poteau — EN 1993-1-8:2005 §4.5.3, repartition elastique.
 *
 * Unites : efforts en kN, moments en kN.m, longueurs en mm, contraintes en MPa.
 *
 * Repere du plan de joint (face de la platine) : z selon la hauteur du profil
 * (ame), y selon la largeur des semelles, origine au centre du profil.
 * Cordons :
 *   - semelle, face exterieure : longueur b ;
 *   - semelle, face interieure : deux cordons de (b - t_w)/2 ;
 *   - ame, deux faces : longueur h - 2 t_f.
 * Le conge de raccordement d un profile lamine est neglige : les cordons
 * interieurs sont un peu plus longs qu en realite, ce qui n est PAS
 * conservatif de plus de r/(b/2) sur ces seuls cordons ; le signaler est
 * l affaire de la regle `conge-lamine`.
 */

import { REGLES_CORDONS, type ContexteCordons, type Regle } from '../dispositions/regles';
import { verifierDispositions, type ResultatDispositions } from '../dispositions/verifier-dispositions';
import { taux, type Taux } from '../domaines/taux-de-travail';
import {
  CONDITIONS_PAR_DEFAUT,
  verifierArrachement,
  type ConditionsSoudage,
  type ResultatArrachement,
} from '../epaisseur/arrachement-lamellaire';
import type { Materiau } from '../model/materiau';
import { resistanceUltime } from '../norms/acier';
import { betaW } from '../norms/beta-w';
import { ec3Recommande, validerProfil, type ProfilEC3 } from '../norms/ec3-recommande';
import type { CordonGroupe } from '../soudures/groupe';
import {
  conclure,
  cordon,
  fini,
  positif,
  verifierCordons,
  type Constats,
  type ResultatCordons,
  type VerdictDetail,
} from './commun';

export interface DonneesProfile {
  /** Hauteur, largeur, epaisseurs d ame et de semelle du profile (mm). */
  h: number;
  b: number;
  t_w: number;
  t_f: number;
  /** Gorges des cordons de semelle et d ame (mm). */
  a_f: number;
  a_w: number;
  /** Epaisseur de la platine (mm). */
  t_platine: number;
  sollicitations: {
    /** Effort normal, traction positive (kN). */
    N: number;
    /** Tranchant selon l ame (kN), repris par les cordons d ame. */
    V_z: number;
    /** Tranchant selon les semelles (kN), repris par les cordons de semelle. */
    V_y: number;
    /** Moment de flexion forte, positif s il tend la semelle z > 0 (kN.m). */
    M_y: number;
    /** Moment de flexion faible, positif s il tend le cote y > 0 (kN.m). */
    M_z: number;
  };
  materiau: Materiau;
  profil?: ProfilEC3;
  conditionsSoudage?: ConditionsSoudage;
}

export interface ResultatProfile {
  detail: 'profile-platine';
  verdict: VerdictDetail;
  motif: string;
  constats: Constats;
  f_u: number;
  beta_w: number;
  cordons: ResultatCordons;
  arrachement: ResultatArrachement;
  dispositions: ResultatDispositions;
  taux: Taux[];
  mecanismeGouvernant: string;
}

interface ContexteProfile extends ContexteCordons {
  donnees: DonneesProfile;
}

const REGLES_PROFILE: readonly Regle<ContexteProfile>[] = [
  ...REGLES_CORDONS,
  {
    id: 'conge-lamine',
    clause: 'geometrie',
    severite: 'information',
    enonce: 'conge de raccordement neglige',
    applicabilite: () => null,
    evaluer: () =>
      'les cordons interieurs de semelle sont comptes sur (b - t_w)/2 : sur un profile lamine, en ' +
      'deduire le conge de raccordement r de chaque cote de l ame',
  },
  {
    id: 'tranchant-par-l-ame',
    clause: 'EN 1993-1-8 §4.5.3',
    severite: 'information',
    enonce: 'repartition du tranchant',
    applicabilite: () => null,
    evaluer: () =>
      'V_z est repris par les seuls cordons d ame et V_y par les seuls cordons de semelle, ' +
      'repartition usuelle qui suit la raideur de chaque paroi',
  },
];

/**
 * Verification des cordons d un profile en I sur sa platine.
 *
 * Effort normal et moments se repartissent ELASTIQUEMENT sur l ensemble des
 * gorges rabattues (Navier) ; chaque cordon recoit en outre le tranchant de
 * la paroi qui le porte. Les cordons exterieurs de semelle, les plus eloignes
 * de l axe neutre, gouvernent en general sous M_y.
 *
 * La platine est verifiee a l arrachement lamellaire, sous le cordon le plus
 * epais. Sa flexion et son appui (troncon en te, boulons) ne sont pas
 * verifies ici : ils dependent de ce sur quoi elle porte.
 */
export function verifierProfilePlatine(d: DonneesProfile): ResultatProfile {
  const profil = validerProfil(d.profil ?? ec3Recommande());
  const h = positif(d.h, 'La hauteur du profile h', 'mm');
  const b = positif(d.b, 'La largeur des semelles b', 'mm');
  const t_w = positif(d.t_w, 'L epaisseur d ame t_w', 'mm');
  const t_f = positif(d.t_f, 'L epaisseur de semelle t_f', 'mm');
  const a_f = positif(d.a_f, 'La gorge des cordons de semelle a_f', 'mm');
  const a_w = positif(d.a_w, 'La gorge des cordons d ame a_w', 'mm');
  const t_platine = positif(d.t_platine, 'L epaisseur de platine', 'mm');
  if (2 * t_f >= h) {
    throw new Error('Les semelles doivent laisser une ame : 2 t_f < h (mm).');
  }
  if (t_w >= b) {
    throw new Error('L ame doit etre plus mince que la semelle n est large : t_w < b (mm).');
  }
  const s = {
    N: fini(d.sollicitations.N, 'L effort N', 'kN'),
    V_y: fini(d.sollicitations.V_y, 'Le tranchant V_y', 'kN'),
    V_z: fini(d.sollicitations.V_z, 'Le tranchant V_z', 'kN'),
    M_y: fini(d.sollicitations.M_y, 'Le moment M_y', 'kN.m'),
    M_z: fini(d.sollicitations.M_z, 'Le moment M_z', 'kN.m'),
  };

  const f_u = Math.min(
    resistanceUltime(d.materiau.nuance, Math.max(t_w, t_f)),
    resistanceUltime(d.materiau.nuance, t_platine),
  );
  const beta_w = betaW(d.materiau.nuance);

  const semelle = { reprendVz: false, reprendVy: true };
  const ame = { reprendVz: true, reprendVy: false };
  const zExt = h / 2 + a_f / 2;
  const zInt = h / 2 - t_f - a_f / 2;
  const yAme = t_w / 2 + a_w / 2;
  const hAme = h / 2 - t_f;
  const groupe: CordonGroupe[] = [];
  for (const signe of [1, -1] as const) {
    const nom = signe > 0 ? 'semelle-haute' : 'semelle-basse';
    groupe.push(cordon(`${nom}-ext`, -b / 2, signe * zExt, b / 2, signe * zExt, a_f, [0, signe], semelle));
    groupe.push(cordon(`${nom}-int-1`, t_w / 2, signe * zInt, b / 2, signe * zInt, a_f, [0, -signe], semelle));
    groupe.push(cordon(`${nom}-int-2`, -b / 2, signe * zInt, -t_w / 2, signe * zInt, a_f, [0, -signe], semelle));
  }
  groupe.push(cordon('ame-1', yAme, -hAme, yAme, hAme, a_w, [1, 0], ame));
  groupe.push(cordon('ame-2', -yAme, -hAme, -yAme, hAme, a_w, [-1, 0], ame));

  const cordons = verifierCordons(groupe, s, () => ({ f_u, beta_w, gamma_M2: profil.gamma_M2 }));

  const arrachement = verifierArrachement({
    t: t_platine,
    a: Math.max(a_f, a_w),
    cordonDAngle: true,
    conditions: d.conditionsSoudage ?? CONDITIONS_PAR_DEFAUT,
    qualite: d.materiau.qualiteZ,
  });

  const ctx: ContexteProfile = {
    donnees: d,
    cordons: [
      { id: 'semelle-ext', a: a_f, l: b, t_min: Math.min(t_f, t_platine), type: 'angle' },
      { id: 'semelle-int', a: a_f, l: (b - t_w) / 2, t_min: Math.min(t_f, t_platine), type: 'angle' },
      { id: 'ame', a: a_w, l: h - 2 * t_f, t_min: Math.min(t_w, t_platine), type: 'angle' },
    ],
    epaisseurs: [t_w, t_f, t_platine],
  };
  const dispositions = verifierDispositions(REGLES_PROFILE, ctx);

  const fin = conclure(
    [
      taux('soudure', 'EN 1993-1-8 §4.5.3.2', `cordons d angle, ${cordons.gouvernant.cordon}`, cordons.taux),
      taux(
        'arrachement-lamellaire',
        'EN 1993-1-10 §3.2',
        `arrachement lamellaire de la platine, Z_Ed = ${arrachement.Z_Ed}`,
        arrachement.taux,
      ),
    ],
    dispositions,
  );
  return { detail: 'profile-platine', ...fin, f_u, beta_w, cordons, arrachement, dispositions };
}
