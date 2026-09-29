/**
 * Interaction, dans la platine, de la flexion de poutre et de la flexion
 * transversale — EN 1993-1-1:2005 §6.2.1(5), critere elastique (6.1).
 *
 *   (sx / f)^2 + (sz / f)^2 - (sx / f)(sz / f) <= 1,   f = f_y / gamma_M0
 *
 * Unites : contraintes en MPa, moments lineiques en kN (kN.mm/mm).
 */

export interface ResultatInteraction {
  /** Contrainte transversale de flexion locale au droit de l ame, 6 m / t^2 (MPa). */
  sigma_z: number;
  /** Contraintes de poutre sur les deux faces, traction positive (MPa). */
  sigma_x_support: number;
  sigma_x_ame: number;
  /** Contrainte equivalente la plus forte des deux faces (MPa). */
  sigma_eq: number;
  taux: number;
}

/**
 * En appui aux extremites, la platine est a la fois semelle TENDUE de la
 * poutre de portee L et plaque flechie entre les ames. Au droit de l ame,
 * les deux sollicitations sont maximales ensemble : contrainte de poutre
 * sigma_x, et moment local m_Ed d encastrement de la platine (celui qui
 * sollicite les cordons), elastique : sigma_z = 6 m_Ed / t^2.
 *
 * La platine flechit en s eloignant des ames : au droit de l ame, sa face
 * cote ames est tendue transversalement, sa face cote support comprimee.
 * Les deux faces sont examinees.
 */
export function interactionPlatine(
  sigma_x_support: number,
  sigma_x_ame: number,
  m_Ed: number,
  t: number,
  f_y: number,
  gamma_M0: number,
): ResultatInteraction {
  if (!Number.isFinite(t) || t <= 0) {
    throw new Error('L epaisseur de platine t doit etre un nombre strictement positif (mm).');
  }
  const sigma_z = (6 * m_Ed * 1000) / t ** 2;
  const f = f_y / gamma_M0;
  const eq = (sx: number, sz: number): number => Math.sqrt(sx * sx + sz * sz - sx * sz);
  const sigma_eq = Math.max(eq(sigma_x_support, -sigma_z), eq(sigma_x_ame, sigma_z));
  return { sigma_z, sigma_x_support, sigma_x_ame, sigma_eq, taux: sigma_eq / f };
}
