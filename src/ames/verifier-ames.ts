/**
 * Verifications des ames d une tete d ancrage.
 *
 * Unites : efforts en kN, longueurs en mm, contraintes en MPa, moments en kN.m.
 */

import type { Assemblage } from '../model/assemblage';
import type { Nuance } from '../model/materiau';
import { limiteElastique } from '../norms/acier';
import type { ProfilEC3 } from '../norms/ec3-recommande';
import {
  sollicitationsContinu,
  sollicitationsExtremites,
  verifierFlexionTranchant,
  type ResultatFlexionTranchant,
} from './flexion-tranchant';
import { classeAme, torsionRaidisseur, type ClasseAme, type TorsionRaidisseur } from './raidisseur';
import { sectionEnTe, type SectionEnTe } from './section-composee';
import {
  chargeTransversale,
  voilementParCisaillement,
  type ResultatChargeTransversale,
  type VoilementCisaillement,
} from './voilement';

export interface ChargeSurLierne {
  /** L ame la plus chargee seule, s_s = t_w + 2t. */
  unique: ResultatChargeTransversale;
  /** Les deux ames ensemble, si leurs zones de diffusion se recouvrent. */
  combinee: ResultatChargeTransversale | null;
  /** Le plus defavorable des deux. */
  gouvernant: ResultatChargeTransversale;
}

export interface ResultatAmes {
  /** Section au droit du moment maximal, percage deduit. */
  section: SectionEnTe;
  flexion: ResultatFlexionTranchant;
  classe: ClasseAme;
  torsion: TorsionRaidisseur;
  voilementCisaillement: VoilementCisaillement;
  /** Constat en clair sur le deversement, qui n est pas passe sous silence. */
  deversement: string;
  /** Appui aux extremites sur lierne seulement. */
  lierne: ChargeSurLierne | null;
}

/** Ce que le troncon en te transmet aux ames en appui continu. */
export interface PressionCollectee {
  sigma_c: number;
  w_s: number;
}

const DEVERSEMENT =
  'Le chant libre des ames est la fibre comprimee et rien ne le tient lateralement. Le ' +
  'deversement n est pas calcule : il est couvert par le critere de voilement par torsion ' +
  'du raidisseur plat (EN 1993-1-5 §9.2.1(8)), qui exclut la rotation de l ame autour de ' +
  'son pied, seul mode par lequel ce chant se deroberait sur une piece aussi courte.';

/**
 * Verifications des ames selon le schema d appui.
 *
 * APPUI CONTINU : chaque ame est une poutre en te qui ramene vers la couronne
 * la pression d appui collectee sur sa bande (troncon en te).
 * APPUI AUX EXTREMITES : l ensemble est une poutre de portee L ; l ame la plus
 * chargee reprend la part `part` de l effort. Sur lierne, la charge
 * transversale sur l ame du profil support est verifiee (EN 1993-1-5 §6).
 */
export function verifierAmes(
  assemblage: Assemblage,
  N_Ed: number,
  part: number,
  nuance: Nuance,
  profil: ProfilEC3,
  pression?: PressionCollectee,
): ResultatAmes {
  const { platine, plats, ancrage, appui, schema } = assemblage;
  const f_y_platine = limiteElastique(nuance, platine.t);
  const f_y_ame = limiteElastique(nuance, plats.t_w);
  const section = sectionEnTe(platine, plats, f_y_platine, true);

  let sollicitations;
  if (schema === 'appui-extremites') {
    sollicitations = sollicitationsExtremites(N_Ed, part, plats.L ?? Number.NaN);
  } else {
    if (pression === undefined) {
      throw new Error('La pression d appui collectee est requise en appui continu.');
    }
    sollicitations = sollicitationsContinu(pression.sigma_c, pression.w_s, plats.L_w, ancrage.D);
  }

  const flexion = verifierFlexionTranchant(
    sollicitations,
    section,
    platine.t,
    plats.h_w,
    plats.t_w,
    f_y_platine,
    f_y_ame,
    profil.gamma_M0,
  );
  const classe = classeAme(plats.h_w, plats.t_w, f_y_ame, flexion.sigma_pied, flexion.sigma_chant);
  const torsion = torsionRaidisseur(plats.h_w, plats.t_w, f_y_ame, profil.E);
  const voilementCisaillement = voilementParCisaillement(plats.h_w, plats.t_w, f_y_ame, profil.eta);

  let lierne: ChargeSurLierne | null = null;
  if (schema === 'appui-extremites' && appui.type === 'lierne-acier') {
    lierne = chargeSurLierne(assemblage, N_Ed, part, nuance, profil);
  }

  return { section, flexion, classe, torsion, voilementCisaillement, deversement: DEVERSEMENT, lierne };
}

/**
 * Charge transversale apportee par les extremites des ames sur l ame d un
 * profil de la lierne.
 *
 * Chaque U recoit, a chaque extremite de la chaise, les deux ames, a
 * l entraxe e. L ame la plus chargee y apporte part N / 2, diffusee a 1:1
 * dans la platine : s_s = t_w + 2t (EN 1993-1-5 §6.3(1)). Si la longueur
 * chargee l_y d une ame depasse l entraxe, les deux zones se recouvrent : la
 * paire est alors verifiee ensemble, N / 2 sur s_s = e + t_w + 2t.
 */
function chargeSurLierne(
  assemblage: Assemblage,
  N_Ed: number,
  part: number,
  nuance: Nuance,
  profil: ProfilEC3,
): ChargeSurLierne {
  const { platine, plats, appui } = assemblage;
  const t_w = appui.t_w_lierne;
  const t_f = appui.t_f_lierne;
  const h_w = appui.h_w_lierne;
  const b_f = appui.b_f_lierne;
  if (t_w === undefined || t_f === undefined || h_w === undefined || b_f === undefined) {
    throw new Error(
      'La lierne doit etre decrite par t_w, h_w, t_f et b_f de son profil (mm).',
    );
  }
  const support = {
    t_w,
    h_w,
    t_f,
    b_f,
    f_yw: limiteElastique(nuance, t_w),
    f_yf: limiteElastique(nuance, t_f),
  };
  const s_s = plats.t_w + 2 * platine.t;
  const unique = chargeTransversale(support, s_s, (part * N_Ed) / 2, profil.E, profil.gamma_M1);
  const combinee =
    unique.l_y > plats.e
      ? chargeTransversale(support, s_s + plats.e, N_Ed / 2, profil.E, profil.gamma_M1)
      : null;
  const gouvernant = combinee !== null && combinee.taux > unique.taux ? combinee : unique;
  return { unique, combinee, gouvernant };
}
