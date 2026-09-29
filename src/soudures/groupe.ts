/**
 * Groupe de cordons sous sollicitations quelconques — methode elastique des
 * gorges rabattues, EN 1993-1-8:2005 §4.5.3.
 *
 * Unites : efforts en kN, moments en kN.m, longueurs en mm, contraintes en MPa.
 *
 * Repere. Les cordons sont des segments du PLAN DE JOINT (y, z) : la face de
 * l element de base sur laquelle l element attache est soude. L axe x est
 * normal a ce plan, oriente de la base vers l element attache.
 *
 * Hypotheses, classiques et du cote de la securite pour un groupe compact :
 * - la gorge de chaque cordon est rabattue sur le plan de joint, ou elle
 *   occupe une bande de largeur a le long du cordon ;
 * - les efforts hors plan (N, M_y, M_z) donnent une contrainte normale
 *   lineaire sur ces bandes (Navier, section non symetrique admise) ;
 * - les efforts tranchants se repartissent uniformement sur les cordons
 *   designes pour les reprendre, la torsion elastiquement sur tout le groupe.
 */

import { N_PAR_KN, contraintesDansLaGorge, type ContraintesGorge, type EffortsLineiques, type TypeCordon } from './gorge';

export interface CordonGroupe {
  id: string;
  /** Extremites dans le plan de joint (mm). */
  y1: number;
  z1: number;
  y2: number;
  z2: number;
  /** Gorge (mm). */
  a: number;
  /**
   * Orientation de e_2, direction du plan de joint perpendiculaire au cordon
   * et orientee a l oppose de l element attache : +1 pour la normale obtenue
   * en tournant l axe (y1,z1)->(y2,z2) de +90 degres, -1 pour l autre.
   */
  cote: 1 | -1;
  type?: TypeCordon;
  /** Le cordon reprend-il l effort tranchant V_y ? Vrai par defaut. */
  reprendVy?: boolean;
  /** Le cordon reprend-il l effort tranchant V_z ? Vrai par defaut. */
  reprendVz?: boolean;
}

export interface SollicitationsGroupe {
  /** Effort normal au plan de joint, arrachement de l element attache positif (kN). */
  N?: number;
  /** Efforts tranchants dans le plan de joint, appliques a l element attache (kN). */
  V_y?: number;
  V_z?: number;
  /**
   * Moments hors plan, definis par la contrainte qu ils produisent (kN.m) :
   * M_y = integrale de sigma (z - z_G) dA, M_z = integrale de sigma (y - y_G) dA.
   * Un M_y positif tend les fibres de z superieur au centre de gravite.
   */
  M_y?: number;
  M_z?: number;
  /** Torsion dans le plan, sens trigonometrique autour du centre de gravite (kN.m). */
  T?: number;
}

export interface ProprietesGroupe {
  /** Aire des gorges rabattues (mm2). */
  A: number;
  /** Centre de gravite (mm). */
  y_G: number;
  z_G: number;
  /** integrale (y - y_G)^2 dA (mm4). */
  I_yy: number;
  /** integrale (z - z_G)^2 dA (mm4). */
  I_zz: number;
  /** integrale (y - y_G)(z - z_G) dA (mm4). */
  I_yz: number;
  /** Moment polaire I_yy + I_zz (mm4). */
  I_p: number;
  /** Aires reprenant V_y et V_z (mm2). */
  A_Vy: number;
  A_Vz: number;
}

/** Etat d un point de cordon (une extremite). */
export interface PointCordon {
  y: number;
  z: number;
  /** Contrainte normale sur la gorge rabattue (MPa). */
  sigma_w: number;
  /** Cisaillement le long du cordon (MPa). */
  tau_u: number;
  /** Cisaillement selon e_2 (MPa). */
  tau_n: number;
  /** Efforts lineiques equivalents (kN/mm). */
  efforts: EffortsLineiques;
  gorge: ContraintesGorge;
}

export interface EtatCordon {
  cordon: CordonGroupe;
  longueur: number;
  points: [PointCordon, PointCordon];
}

export interface ResultatGroupe {
  proprietes: ProprietesGroupe;
  cordons: EtatCordon[];
}

interface Segment {
  l: number;
  /** Vecteur unitaire de l axe. */
  u_y: number;
  u_z: number;
  /** Milieu. */
  y_m: number;
  z_m: number;
}

function segment(c: CordonGroupe): Segment {
  for (const [v, nom] of [
    [c.y1, 'y1'],
    [c.z1, 'z1'],
    [c.y2, 'y2'],
    [c.z2, 'z2'],
  ] as const) {
    if (!Number.isFinite(v)) {
      throw new Error(`La coordonnee ${nom} du cordon ${c.id} doit etre un nombre fini (mm).`);
    }
  }
  if (!Number.isFinite(c.a) || c.a <= 0) {
    throw new Error(`La gorge a du cordon ${c.id} doit etre un nombre strictement positif (mm).`);
  }
  const l = Math.hypot(c.y2 - c.y1, c.z2 - c.z1);
  if (l <= 0) {
    throw new Error(`La longueur du cordon ${c.id} doit etre strictement positive (mm).`);
  }
  return {
    l,
    u_y: (c.y2 - c.y1) / l,
    u_z: (c.z2 - c.z1) / l,
    y_m: (c.y1 + c.y2) / 2,
    z_m: (c.z1 + c.z2) / 2,
  };
}

/**
 * Proprietes du groupe de gorges rabattues : aire, centre de gravite,
 * inerties par rapport au centre de gravite.
 *
 * Chaque cordon est traite comme une ligne d epaisseur a : l inertie propre
 * d un segment est a l^3 / 12 projetee sur ses deux axes, l inertie de la
 * bande dans son epaisseur (l a^3 / 12) est negligee — elle l est dans toute
 * la litterature des groupes de soudures, et son omission est conservative.
 */
export function proprietesDuGroupe(cordons: readonly CordonGroupe[]): ProprietesGroupe {
  if (cordons.length === 0) {
    throw new Error('Le groupe doit comporter au moins un cordon.');
  }
  const segs = cordons.map(segment);

  let A = 0;
  let Sy = 0;
  let Sz = 0;
  let A_Vy = 0;
  let A_Vz = 0;
  cordons.forEach((c, i) => {
    const s = segs[i];
    const aire = c.a * s.l;
    A += aire;
    Sy += aire * s.y_m;
    Sz += aire * s.z_m;
    if (c.reprendVy ?? true) A_Vy += aire;
    if (c.reprendVz ?? true) A_Vz += aire;
  });
  const y_G = Sy / A;
  const z_G = Sz / A;

  let I_yy = 0;
  let I_zz = 0;
  let I_yz = 0;
  cordons.forEach((c, i) => {
    const s = segs[i];
    const aire = c.a * s.l;
    const propre = (c.a * s.l ** 3) / 12;
    const dy = s.y_m - y_G;
    const dz = s.z_m - z_G;
    I_yy += aire * dy * dy + propre * s.u_y * s.u_y;
    I_zz += aire * dz * dz + propre * s.u_z * s.u_z;
    I_yz += aire * dy * dz + propre * s.u_y * s.u_z;
  });

  return { A, y_G, z_G, I_yy, I_zz, I_yz, I_p: I_yy + I_zz, A_Vy, A_Vz };
}

/** Tolerance relative sous laquelle une inertie est tenue pour nulle. */
const TOLERANCE_INERTIE = 1e-9;

function fini(v: number | undefined, nom: string, unite: string): number {
  const x = v ?? 0;
  if (!Number.isFinite(x)) {
    throw new Error(`La sollicitation ${nom} doit etre un nombre fini (${unite}).`);
  }
  return x;
}

/**
 * Contraintes en chaque extremite de chaque cordon, et leur traduction dans
 * la section de gorge.
 *
 * Les champs de contrainte sont lineaires le long d un cordon rectiligne, et
 * les deux criteres du §4.5.3.2(6) sont convexes en ces contraintes : leur
 * maximum sur un cordon est atteint a l une de ses extremites. Examiner les
 * deux extremites suffit donc, sans discretisation.
 *
 * Un groupe dont les cordons sont tous alignes n a pas d inertie dans une
 * direction : un moment dans cette direction est refuse plutot que divise par
 * zero.
 */
export function analyserGroupe(
  cordons: readonly CordonGroupe[],
  sollicitations: SollicitationsGroupe,
): ResultatGroupe {
  const p = proprietesDuGroupe(cordons);
  const N = fini(sollicitations.N, 'N', 'kN') * N_PAR_KN;
  const V_y = fini(sollicitations.V_y, 'V_y', 'kN') * N_PAR_KN;
  const V_z = fini(sollicitations.V_z, 'V_z', 'kN') * N_PAR_KN;
  const M_y = fini(sollicitations.M_y, 'M_y', 'kN.m') * N_PAR_KN * 1000;
  const M_z = fini(sollicitations.M_z, 'M_z', 'kN.m') * N_PAR_KN * 1000;
  const T = fini(sollicitations.T, 'T', 'kN.m') * N_PAR_KN * 1000;

  // sigma = N/A + alpha (z - z_G) + beta (y - y_G), avec
  //   M_y = alpha I_zz + beta I_yz,  M_z = alpha I_yz + beta I_yy.
  const echelle = Math.max(p.I_yy, p.I_zz, 1);
  const det = p.I_zz * p.I_yy - p.I_yz * p.I_yz;
  let alpha = 0;
  let beta = 0;
  if (Math.abs(det) > TOLERANCE_INERTIE * echelle * echelle) {
    alpha = (M_y * p.I_yy - M_z * p.I_yz) / det;
    beta = (M_z * p.I_zz - M_y * p.I_yz) / det;
  } else if (M_y !== 0 || M_z !== 0) {
    // Groupe aligne : une seule direction a de l inertie.
    if (p.I_zz > TOLERANCE_INERTIE * echelle && M_z === 0) {
      alpha = M_y / p.I_zz;
    } else if (p.I_yy > TOLERANCE_INERTIE * echelle && M_y === 0) {
      beta = M_z / p.I_yy;
    } else {
      throw new Error(
        'Le groupe de cordons est aligne : il ne reprend pas de moment dans cette direction.',
      );
    }
  }

  if (V_y !== 0 && p.A_Vy <= 0) {
    throw new Error('Aucun cordon n est designe pour reprendre l effort tranchant V_y.');
  }
  if (V_z !== 0 && p.A_Vz <= 0) {
    throw new Error('Aucun cordon n est designe pour reprendre l effort tranchant V_z.');
  }
  if (T !== 0 && p.I_p <= 0) {
    throw new Error('Le groupe de cordons n a pas d inertie polaire : il ne reprend pas de torsion.');
  }

  const etats: EtatCordon[] = cordons.map((c) => {
    const s = segment(c);
    // e_2 : normale a l axe, tournee de +90 degres puis orientee par `cote`.
    const n_y = -s.u_z * c.cote;
    const n_z = s.u_y * c.cote;
    const tau_Vy = (c.reprendVy ?? true) && V_y !== 0 ? V_y / p.A_Vy : 0;
    const tau_Vz = (c.reprendVz ?? true) && V_z !== 0 ? V_z / p.A_Vz : 0;

    const point = (y: number, z: number): PointCordon => {
      const dy = y - p.y_G;
      const dz = z - p.z_G;
      const sigma_w = N / p.A + alpha * dz + beta * dy;
      const tau_y = tau_Vy - (T === 0 ? 0 : (T * dz) / p.I_p);
      const tau_z = tau_Vz + (T === 0 ? 0 : (T * dy) / p.I_p);
      const tau_u = tau_y * s.u_y + tau_z * s.u_z;
      const tau_n = tau_y * n_y + tau_z * n_z;
      const efforts: EffortsLineiques = {
        p_1: (sigma_w * c.a) / N_PAR_KN,
        p_2: (tau_n * c.a) / N_PAR_KN,
        p_para: (tau_u * c.a) / N_PAR_KN,
      };
      return {
        y,
        z,
        sigma_w,
        tau_u,
        tau_n,
        efforts,
        gorge: contraintesDansLaGorge(efforts, c.a, c.type ?? 'angle'),
      };
    };

    return { cordon: c, longueur: s.l, points: [point(c.y1, c.z1), point(c.y2, c.z2)] };
  });

  return { proprietes: p, cordons: etats };
}
