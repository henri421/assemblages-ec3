/**
 * Hypotheses et limites de chaque detail, et avertissements conditionnels.
 * Module PUR.
 */

import type { Calcul } from './calcul';
import type { Outil } from './form';

const COMMUNES = [
  "Valeurs recommandees de l'EN 1993 ; une annexe nationale peut les modifier.",
  'Methode directionnelle (§4.5.3.2) retenue pour le verdict ; methode simplifiee (§4.5.3.3) donnee pour controle.',
  "Chargement statique ; la fatigue (EN 1993-1-9) n'est pas couverte.",
];

export function hypotheses(outil: Outil): string[] {
  switch (outil) {
    case 'chaise-ancrage':
      return [
        'Empilement : platine sur le support, ames raidisseuses soudees sur sa face libre, bloc et verin entre les ames.',
        'Effort de dimensionnement : max(N_ELU ; P_p ; 0,9 F_tk), pour que la ruine se produise dans l armature.',
        'Appui continu : platine sur beton, troncon en te (§6.2.5), beta_j = 2/3 (calage d au plus 0,2 fois la plus petite dimension).',
        'Appui aux extremites : platine en franchissement ; flexion entre ames par les bornes N e / 8 et N e / 4, N e / 6 retenu.',
        'Moment local sur les cordons borne par les moments plastiques de la platine et de l ame.',
        'Deversement couvert par le critere de torsion du raidisseur plat (EN 1993-1-5 §9.2.1(8)).',
        'Service (TA 2020) : elasticite au blocage ; fleche comparee a une limite seulement si elle est fixee.',
        ...COMMUNES,
      ];
    case 'te':
    case 'cruciforme':
    case 'angle':
      return [
        'Gorges rabattues sur le plan de joint, repartition elastique (Navier).',
        'Pleine penetration : resistance de la piece la plus faible (§4.7.1), pas de calcul de gorge.',
        "Metal de base : contraintes maximales cumulees, critere elastique §6.2.1(5), du cote de la securite.",
        "Flexion de la piece de base non verifiee : elle depend de ce qui la porte.",
        ...COMMUNES,
      ];
    case 'recouvrement':
      return [
        'Sollicitations donnees au centre de gravite des cordons ; torsion repartie elastiquement.',
        'Assemblage long (§4.11) : beta_Lw applique aux seuls cordons lateraux.',
        'Flexion d excentricite hors plan d un recouvrement simple non calculee.',
        ...COMMUNES,
      ];
    case 'profile-platine':
      return [
        'Repartition elastique de N et des moments sur toutes les gorges ; V_z par l ame, V_y par les semelles.',
        'Conge de raccordement neglige dans la longueur des cordons interieurs.',
        'Flexion et appui de la platine non verifies ; resistance du profile non verifiee.',
        ...COMMUNES,
      ];
  }
}

/** Mises en garde conditionnelles, a placer en evidence. */
export function avertissements(c: Calcul): string[] {
  const a: string[] = [];
  if (c.detail === 'chaise-ancrage') {
    const r = c.resultat;
    if (r.platine.sectionNette?.modeleDePlaqueNecessaire) {
      a.push('Flexion de la platine : taux superieur a 0,80, le modele de poutre ne suffit plus — un modele de plaque est necessaire.');
    }
    if (r.platine.troncon !== null && !r.platine.troncon.amesDansLeContour) {
      a.push(`Troncon en te : ${r.platine.troncon.motifAmesExclues ?? ''} ; les ames ne sont pas comptees.`);
    }
    if (c.modele.donnees.assemblage.soudure.contactDirect) {
      a.push('Contact direct suppose : l ajustage plan sur plan doit etre prescrit et controle (EN 1090-2).');
    }
    if (r.effort.inclinaisonPriseEnCompte) {
      a.push('Inclinaison superieure a 3 degres : composante tangentielle introduite ; une cale biaise ou une tete articulee est requise.');
    }
  }
  return a;
}
