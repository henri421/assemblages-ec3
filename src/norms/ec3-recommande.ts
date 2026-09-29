/**
 * Coefficients de l EN 1993, valeurs recommandees.
 *
 * Aucune annexe nationale n est codee dans le noyau : l utilisateur derive son
 * propre profil (belge, luxembourgeois ou autre) a partir de celui-ci, comme
 * on le fait pour `ec2Recommended()` dans section-uls.
 */

export interface ProfilEC3 {
  name: string;
  /** Resistance des sections transversales, EN 1993-1-1 §6.1(1). */
  gamma_M0: number;
  /** Resistance des barres aux instabilites, EN 1993-1-1 §6.1(1). */
  gamma_M1: number;
  /** Resistance des soudures et des sections nettes, EN 1993-1-8 tableau 2.1. */
  gamma_M2: number;
  /** Coefficient eta du voilement par cisaillement, EN 1993-1-5 §5.1(2). */
  eta: number;
  /** Module d elasticite de l acier (MPa), EN 1993-1-1 §3.2.6. */
  E: number;
  /** Coefficient beta_j de la resistance d appui du beton, EN 1993-1-8 §6.2.5(7). */
  beta_j: number;
  /** Coefficient partiel du beton, EN 1992-1-1 tableau 2.1N. */
  gamma_c: number;
}

/** Valeurs recommandees de l EN 1993, sans annexe nationale. */
export function ec3Recommande(): ProfilEC3 {
  return {
    name: 'EC3_recommande',
    gamma_M0: 1.0,
    gamma_M1: 1.0,
    gamma_M2: 1.25,
    eta: 1.2,
    E: 210000,
    beta_j: 2 / 3,
    gamma_c: 1.5,
  };
}

/**
 * Controle d un profil derive par l utilisateur.
 *
 * Un coefficient partiel nul ou negatif rendrait des resistances infinies ou
 * de signe faux sans que rien ne le signale : il est refuse ici, une fois.
 */
export function validerProfil(profil: ProfilEC3): ProfilEC3 {
  const positifs: Array<[keyof ProfilEC3, string]> = [
    ['gamma_M0', 'Le coefficient gamma_M0'],
    ['gamma_M1', 'Le coefficient gamma_M1'],
    ['gamma_M2', 'Le coefficient gamma_M2'],
    ['eta', 'Le coefficient eta'],
    ['E', 'Le module d elasticite E'],
    ['beta_j', 'Le coefficient beta_j'],
    ['gamma_c', 'Le coefficient gamma_c'],
  ];
  for (const [cle, nom] of positifs) {
    const valeur = profil[cle];
    if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur <= 0) {
      throw new Error(`${nom} doit etre un nombre strictement positif (-).`);
    }
  }
  return profil;
}
