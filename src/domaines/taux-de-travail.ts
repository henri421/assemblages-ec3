/**
 * Tableau des taux de travail : un par mecanisme, du plus sollicite au moins
 * sollicite, les mecanismes sans objet a la fin avec leur motif.
 */

export type Famille = 'resistance' | 'service';

export interface Taux {
  id: string;
  clause: string;
  libelle: string;
  famille: Famille;
  /** Taux de travail (-), NaN si non applicable. */
  valeur: number;
  applicable: boolean;
  /** Pourquoi le mecanisme est sans objet ; null s il s applique. */
  notApplicableReason: string | null;
}

/** Un mecanisme verifie. */
export function taux(id: string, clause: string, libelle: string, valeur: number, famille: Famille = 'resistance'): Taux {
  return { id, clause, libelle, famille, valeur, applicable: true, notApplicableReason: null };
}

/** Un mecanisme sans objet dans ce cas, avec son motif. */
export function sansObjet(id: string, clause: string, libelle: string, motif: string, famille: Famille = 'resistance'): Taux {
  return { id, clause, libelle, famille, valeur: Number.NaN, applicable: false, notApplicableReason: motif };
}

/**
 * Tri decroissant des taux applicables, puis les mecanismes sans objet dans
 * leur ordre d origine : ils restent affiches, pour qu on sache qu ils ont
 * ete examines.
 */
export function trierTaux(liste: readonly Taux[]): Taux[] {
  const applicables = liste.filter((t) => t.applicable).sort((a, b) => b.valeur - a.valeur);
  return [...applicables, ...liste.filter((t) => !t.applicable)];
}

/** Mecanisme de resistance le plus sollicite, ou null. */
export function gouvernant(liste: readonly Taux[], famille: Famille = 'resistance'): Taux | null {
  let max: Taux | null = null;
  for (const t of liste) {
    if (t.applicable && t.famille === famille && (max === null || t.valeur > max.valeur)) max = t;
  }
  return max;
}
