/**
 * Hypothèses et limites de chaque détail, et avertissements conditionnels.
 * Module PUR. Textes affichés en clair : pas de notation source, ces chaines
 * ne passent pas toutes par `notationHtml`.
 */

import type { Calcul } from './calcul';
import type { Outil } from './form';

const COMMUNES = [
  "Valeurs recommandées de l'EN 1993 ; une annexe nationale peut les modifier.",
  'Méthode directionnelle (§4.5.3.2) retenue pour le verdict ; méthode simplifiée (§4.5.3.3) donnée pour contrôle.',
  "Chargement statique ; la fatigue (EN 1993-1-9) n'est pas couverte.",
];

export function hypotheses(outil: Outil): string[] {
  switch (outil) {
    case 'chaise-ancrage':
      return [
        'Empilement : platine sur le support, âmes raidisseuses soudées sur sa face libre, bloc et vérin entre les âmes.',
        "Effort de dimensionnement : le maximum de l'effort ELU, de la traction d'épreuve et de 0,9 fois la résistance de l'armature, pour que la ruine se produise dans l'armature.",
        "Appui continu : platine sur béton, tronçon en té (§6.2.5), βj = 2/3 (calage d'au plus 0,2 fois la plus petite dimension).",
        'Appui aux extrémités : platine en franchissement ; flexion entre âmes par les bornes N·e/8 et N·e/4, N·e/6 retenu.',
        "Moment local sur les cordons borné par les moments plastiques de la platine et de l'âme.",
        'Déversement couvert par le critère de torsion du raidisseur plat (EN 1993-1-5 §9.2.1(8)).',
        'Service (TA 2020) : élasticité au blocage ; flèche comparée à une limite seulement si elle est fixée.',
        ...COMMUNES,
      ];
    case 'te':
    case 'cruciforme':
    case 'angle':
      return [
        'Gorges rabattues sur le plan de joint, répartition élastique (Navier).',
        "Pleine pénétration : résistance de l'élément le plus faible (§4.7.1), pas de calcul de gorge.",
        'Métal de base : contraintes maximales cumulées, critère élastique §6.2.1(5), du côté de la sécurité.',
        "Flexion de l'élément de base non vérifiée : elle dépend de ce qui la porte.",
        ...COMMUNES,
      ];
    case 'recouvrement':
      return [
        'Sollicitations données au centre de gravité des cordons ; torsion répartie élastiquement.',
        'Assemblage long (§4.11) : coefficient βLw appliqué aux seuls cordons latéraux.',
        "Flexion d'excentricité hors plan d'un recouvrement simple non calculée.",
        ...COMMUNES,
      ];
    case 'eclissage-boulonne':
      return [
        'Boulons ordinaires en cisaillement, catégorie A (pression diamétrale) ; trous normaux.',
        'Effort axial centré sur le groupe, partagé également entre les boulons.',
        'Pince transversale déduite de la largeur de chaque plat, boulons centrés.',
        'Cisaillement de bloc : bloc central entre les files extrêmes seulement.',
        "Recouvrement simple : flexion d'excentricité hors plan non calculée.",
        "Valeurs recommandées de l'EN 1993 ; une annexe nationale peut les modifier.",
        "Chargement statique ; la fatigue (EN 1993-1-9) n'est pas couverte.",
      ];
    case 'profile-platine':
      return [
        "Répartition élastique de N et des moments sur toutes les gorges ; l'effort tranchant Vz par l'âme, Vy par les semelles.",
        'Congé de raccordement négligé dans la longueur des cordons intérieurs.',
        'Flexion et appui de la platine non vérifiés ; résistance du profilé non vérifiée.',
        ...COMMUNES,
      ];
  }
}

/** Mises en garde conditionnelles, à placer en évidence. */
export function avertissements(c: Calcul): string[] {
  const a: string[] = [];
  if (c.detail === 'chaise-ancrage') {
    const r = c.resultat;
    if (r.platine.sectionNette?.modeleDePlaqueNecessaire) {
      a.push(
        'Flexion de la platine : taux supérieur à 0,80, le modèle de poutre ne suffit plus — un modèle de plaque est nécessaire.',
      );
    }
    if (r.platine.troncon !== null && !r.platine.troncon.amesDansLeContour) {
      a.push(`Tronçon en té : ${r.platine.troncon.motifAmesExclues ?? ''} ; les âmes ne sont pas comptées.`);
    }
    if (c.modele.donnees.assemblage.soudure.contactDirect) {
      a.push("Contact direct supposé : l'ajustage plan sur plan doit être prescrit et contrôlé (EN 1090-2).");
    }
    if (r.effort.inclinaisonPriseEnCompte) {
      a.push(
        'Inclinaison supérieure à 3 degrés : composante tangentielle introduite ; une cale biaisée ou une tête articulée est requise.',
      );
    }
  }
  return a;
}
