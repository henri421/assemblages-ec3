/**
 * Mise en forme des nombres et du texte. Module PUR.
 */

export { echapper, lireNombre, nombreFr } from 'aedificium-ui';
import { nombreFr } from 'aedificium-ui';

/** Nombre avec unite, espace insecable. */
export function avecUnite(valeur: number, decimales: number, unite: string): string {
  return unite === '' ? nombreFr(valeur, decimales) : `${nombreFr(valeur, decimales)} ${unite}`;
}
