/**
 * Methode directionnelle — EN 1993-1-8:2005 §4.5.3.2(6).
 *
 *   racine( sigma_perp^2 + 3 (tau_perp^2 + tau_para^2) ) <= f_u / (beta_w gamma_M2)
 *   sigma_perp                                           <= 0,9 f_u / gamma_M2
 *
 * Unites : contraintes en MPa.
 */

import type { ContraintesGorge } from './gorge';

export interface ResistanceSoudure {
  /** Resistance ultime nominale de la piece la plus faible (MPa). */
  f_u: number;
  /** Facteur de correlation, tableau 4.1 (-). */
  beta_w: number;
  gamma_M2: number;
  /** Reduction des assemblages longs, §4.11 ; 1 par defaut (-). */
  beta_Lw?: number;
}

export interface ResultatDirectionnel extends ContraintesGorge {
  /** racine(sigma_perp^2 + 3 (tau_perp^2 + tau_para^2)) (MPa). */
  contrainteEquivalente: number;
  /** f_u / (beta_w gamma_M2), reduite par beta_Lw (MPa). */
  limiteEquivalente: number;
  tauxEquivalent: number;
  /** 0,9 f_u / gamma_M2 (MPa). */
  limiteNormale: number;
  /** Faux quand sigma_perp est une compression. */
  critereNormalApplicable: boolean;
  /** Pourquoi le second critere ne s applique pas ; null s il s applique. */
  motifNonApplicable: string | null;
  /** sigma_perp / limiteNormale, null quand le critere ne s applique pas. */
  tauxNormal: number | null;
  /** Le plus grand des taux applicables. */
  taux: number;
}

/** Controle commun des parametres de resistance. */
export function resistanceValide(r: ResistanceSoudure): Required<ResistanceSoudure> {
  if (!Number.isFinite(r.f_u) || r.f_u <= 0) {
    throw new Error('La resistance ultime f_u doit etre un nombre strictement positif (MPa).');
  }
  if (!Number.isFinite(r.beta_w) || r.beta_w <= 0) {
    throw new Error('Le facteur de correlation beta_w doit etre un nombre strictement positif (-).');
  }
  if (!Number.isFinite(r.gamma_M2) || r.gamma_M2 <= 0) {
    throw new Error('Le coefficient gamma_M2 doit etre un nombre strictement positif (-).');
  }
  const beta_Lw = r.beta_Lw ?? 1;
  if (!Number.isFinite(beta_Lw) || beta_Lw <= 0 || beta_Lw > 1) {
    throw new Error('Le coefficient beta_Lw doit etre dans ]0 ; 1] (-).');
  }
  return { f_u: r.f_u, beta_w: r.beta_w, gamma_M2: r.gamma_M2, beta_Lw };
}

/**
 * Verification d un point de cordon par la methode directionnelle,
 * EN 1993-1-8 §4.5.3.2(6).
 *
 * LE SECOND CRITERE NE S APPLIQUE QU EN TRACTION. Il ne derive pas d un
 * critere de plasticite : il borne la contrainte normale de traction dans la
 * gorge pour couvrir la rupture fragile du metal fondu et les defauts de
 * racine. En compression il est declare NON APPLICABLE — jamais « satisfait »,
 * ce qui laisserait croire qu une verification a eu lieu.
 *
 * sigma_para, contrainte normale parallele a l axe, n entre dans aucun des
 * deux criteres (§4.5.3.2(5)) : elle n est pas meme demandee ici.
 *
 * beta_Lw (§4.11) reduit la resistance de calcul du cordon : il est applique
 * aux deux membres de droite, la reduction portant sur le cordon et non sur
 * l un de ses criteres.
 */
export function verifierDirectionnelle(
  contraintes: ContraintesGorge,
  resistance: ResistanceSoudure,
): ResultatDirectionnel {
  const { f_u, beta_w, gamma_M2, beta_Lw } = resistanceValide(resistance);
  const { sigma_perp, tau_perp, tau_para } = contraintes;
  for (const [nom, v] of [
    ['sigma_perp', sigma_perp],
    ['tau_perp', tau_perp],
    ['tau_para', tau_para],
  ] as const) {
    if (!Number.isFinite(v)) {
      throw new Error(`La contrainte ${nom} doit etre un nombre fini (MPa).`);
    }
  }

  const contrainteEquivalente = Math.sqrt(
    sigma_perp ** 2 + 3 * (tau_perp ** 2 + tau_para ** 2),
  );
  const limiteEquivalente = (beta_Lw * f_u) / (beta_w * gamma_M2);
  const tauxEquivalent = contrainteEquivalente / limiteEquivalente;

  const limiteNormale = (beta_Lw * 0.9 * f_u) / gamma_M2;
  const critereNormalApplicable = sigma_perp > 0;
  const tauxNormal = critereNormalApplicable ? sigma_perp / limiteNormale : null;

  return {
    sigma_perp,
    tau_perp,
    tau_para,
    contrainteEquivalente,
    limiteEquivalente,
    tauxEquivalent,
    limiteNormale,
    critereNormalApplicable,
    motifNonApplicable: critereNormalApplicable
      ? null
      : 'sigma_perp est une compression (ou nulle) : le critere 0,9 f_u / gamma_M2 ne vise que la traction',
    tauxNormal,
    taux: Math.max(tauxEquivalent, tauxNormal ?? 0),
  };
}
