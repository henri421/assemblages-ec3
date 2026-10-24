/**
 * Mise en forme des nombres et du texte. Module PUR.
 */

export { echapper, lireNombre, nombreAffiche, nombreFr, tauxAffiche } from 'aedificium-ui';
import { nombreAffiche } from 'aedificium-ui';

/** Nombre avec unite, trois decimales au plus et sans zeros inutiles. */
export function avecUnite(valeur: number, decimales: number, unite: string): string {
  const texte = nombreAffiche(valeur, Math.min(decimales, 3));
  return unite === '' ? texte : `${texte} ${unite}`;
}
