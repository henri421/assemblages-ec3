/**
 * Voilement des ames et resistance de l ame du profil support —
 * EN 1993-1-5:2006 §5 et §6.
 *
 * Unites : efforts en kN, longueurs en mm, contraintes en MPa.
 */

import { epsilon } from '../norms/acier';

export interface VoilementCisaillement {
  elancement: number;
  /** 72 eps / eta (-). */
  limite: number;
  /** Vrai si le voilement par cisaillement doit etre verifie (non couvert). */
  aVerifier: boolean;
  taux: number;
}

/**
 * Faut-il verifier le voilement par cisaillement ? EN 1993-1-5 §5.1(2) :
 * oui si h_w / t_w > 72 eps / eta pour une ame non raidie.
 *
 * Le module ne CALCULE pas la resistance au voilement par cisaillement : au-
 * dela du seuil, il le dit, et le taux depasse 1.
 */
export function voilementParCisaillement(h_w: number, t_w: number, f_y: number, eta: number): VoilementCisaillement {
  const elancement = h_w / t_w;
  const limite = (72 * epsilon(f_y)) / eta;
  return { elancement, limite, aVerifier: elancement > limite, taux: elancement / limite };
}

export interface ProfilSupport {
  /** Epaisseur d ame (mm). */
  t_w: number;
  /** Hauteur d ame entre semelles (mm). */
  h_w: number;
  /** Epaisseur de la semelle chargee (mm). */
  t_f: number;
  /** Largeur de la semelle chargee (mm). */
  b_f: number;
  /** Limites elastiques de l ame et de la semelle (MPa). */
  f_yw: number;
  f_yf: number;
}

export interface ResultatChargeTransversale {
  /** Longueur d appui rigide (mm). */
  s_s: number;
  /** Largeur de semelle retenue, bornee a t_w + 15 eps t_f pour un U (mm). */
  b_f_eff: number;
  k_F: number;
  /** Charge critique (kN). */
  F_cr: number;
  m_1: number;
  m_2: number;
  /** Longueur chargee efficace (mm). */
  l_y: number;
  lambda_F: number;
  chi_F: number;
  L_eff: number;
  /** Resistance (kN). */
  F_Rd: number;
  /** Charge appliquee (kN). */
  F_Ed: number;
  taux: number;
}

/**
 * Resistance de l ame d un profil a une charge transversale appliquee par
 * une semelle et equilibree par le cisaillement de l ame — EN 1993-1-5 §6,
 * cas (a) de la figure 6.1, ame sans raidisseur transversal (a infini,
 * k_F = 6).
 *
 *   F_cr   = 0,9 k_F E t_w^3 / h_w
 *   m_1    = f_yf b_f / (f_yw t_w)
 *   m_2    = 0,02 (h_w / t_f)^2  si lambda_F > 0,5, sinon 0
 *   l_y    = s_s + 2 t_f (1 + racine(m_1 + m_2))
 *   lambda_F = racine(l_y t_w f_yw / F_cr),  chi_F = 0,5 / lambda_F <= 1
 *   F_Rd   = f_yw chi_F l_y t_w / gamma_M1
 *
 * m_2 dependant de lambda_F, le calcul est mene avec m_2, puis repris sans
 * lui si lambda_F <= 0,5 (§6.5(1)).
 *
 * La semelle d un U ne deborde que d un cote : sa largeur est bornee a
 * t_w + 15 eps t_f (§6.5(1), 15 eps t_f de chaque cote de l ame).
 *
 * C EST TRES FREQUEMMENT LE POINT DIMENSIONNANT DE L ENSEMBLE : il est
 * verifie meme s il sort de la piece etudiee. L interaction avec la flexion
 * de la lierne (§7.2) n est pas couverte : elle releve du calcul de la paroi.
 */
export function chargeTransversale(
  profil: ProfilSupport,
  s_s: number,
  F_Ed: number,
  E: number,
  gamma_M1: number,
): ResultatChargeTransversale {
  const champs: Array<[number, string, string]> = [
    [profil.t_w, 'L epaisseur d ame de la lierne t_w', 'mm'],
    [profil.h_w, 'La hauteur d ame de la lierne h_w', 'mm'],
    [profil.t_f, 'L epaisseur de semelle de la lierne t_f', 'mm'],
    [profil.b_f, 'La largeur de semelle de la lierne b_f', 'mm'],
    [s_s, 'La longueur d appui rigide s_s', 'mm'],
    [F_Ed, 'La charge transversale F_Ed', 'kN'],
  ];
  for (const [v, nom, unite] of champs) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(`${nom} doit etre un nombre strictement positif (${unite}).`);
    }
  }
  const { t_w, h_w, t_f, f_yw, f_yf } = profil;
  const b_f_eff = Math.min(profil.b_f, t_w + 15 * epsilon(f_yf) * t_f);
  const k_F = 6;
  const F_cr_N = (0.9 * k_F * E * t_w ** 3) / h_w;
  const m_1 = (f_yf * b_f_eff) / (f_yw * t_w);

  const calcul = (m_2: number): { l_y: number; lambda_F: number } => {
    const l_y = s_s + 2 * t_f * (1 + Math.sqrt(m_1 + m_2));
    return { l_y, lambda_F: Math.sqrt((l_y * t_w * f_yw) / F_cr_N) };
  };
  let m_2 = 0.02 * (h_w / t_f) ** 2;
  let { l_y, lambda_F } = calcul(m_2);
  if (lambda_F <= 0.5) {
    m_2 = 0;
    ({ l_y, lambda_F } = calcul(0));
  }
  const chi_F = Math.min(1, 0.5 / lambda_F);
  const L_eff = chi_F * l_y;
  const F_Rd = (f_yw * L_eff * t_w) / gamma_M1 / 1000;
  return {
    s_s,
    b_f_eff,
    k_F,
    F_cr: F_cr_N / 1000,
    m_1,
    m_2,
    l_y,
    lambda_F,
    chi_F,
    L_eff,
    F_Rd,
    F_Ed,
    taux: F_Ed / F_Rd,
  };
}
