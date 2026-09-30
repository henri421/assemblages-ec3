# Assemblages soudés — EN 1993-1-8:2005

Vérification d'assemblages soudés et des platines d'appui de têtes d'ancrage
de tirants, selon l'**EN 1993-1-8:2005** (Eurocode 3, 1ʳᵉ génération).

> **L'outil CONSTATE et ne PRESCRIT PAS.**
> Il rend des contraintes, des taux de travail et la gorge qui satisfait
> l'inéquation normative. Jamais un détail de soudure à exécuter, jamais un plan.

> ⚠ **Aide au calcul.** Cet outil constate, il ne prescrit pas. Les résultats
> relèvent de la responsabilité de l'ingénieur qui les emploie et doivent être
> vérifiés. Les valeurs sont celles recommandées par l'EN 1993 ; une annexe
> nationale peut les modifier. L'EN 1993-1-8:2024, deuxième génération, est
> publiée mais n'est pas encore applicable dans l'attente de son annexe
> nationale : la transposition est prévue au plus tard en septembre 2027 et le
> retrait des normes conflictuelles au plus tard en mars 2028.

## L'interface

Une page web, construite dans `docs/`, servie par GitHub Pages et reliée depuis
le hub [WebAedificium](https://henri421.github.io/WebAedificium/). Elle
s'installe comme application (PWA) et fonctionne hors ligne.

**Aucune donnée ne quitte le navigateur.** Les données de projet sont couvertes
par le secret professionnel : il n'y a ni serveur, ni mesure d'audience, ni
requête réseau. L'enregistrement est un téléchargement JSON, la relecture un
choix de fichier local ; le dernier modèle est gardé dans la mémoire locale du
navigateur, sur le poste.

Six détails, choisis en tête de page (ou par l'adresse, `?detail=te`) :

| Détail | Paramètre | Ce qui est vérifié |
| --- | --- | --- |
| Tête d'ancrage de tirant | `chaise-ancrage` | cordons, platine, âmes, appui, arrachement lamellaire, service |
| Té soudé | `te` | cordons ou pénétration, plat attaché, arrachement lamellaire |
| Cruciforme | `cruciforme` | idem, plat traversant sollicité dans son épaisseur |
| Assemblage d'angle | `angle` | idem, Z_b = 8 |
| Recouvrement | `recouvrement` | cordons latéraux et frontal, assemblages longs §4.11, plats |
| Profilé sur platine | `profile-platine` | cordons d'âme et de semelles, arrachement lamellaire |

Sorties : le **verdict** et son motif ; **trois constats distincts** —
résistance, service (tête d'ancrage), dispositions constructives — jamais
fusionnés ; le **tableau des taux de travail**, trié, avec la clause en regard
et les mécanismes sans objet affichés comme tels ; le **tableau des cordons**,
point par point ; le **tableau des dispositions** ; les **grandeurs
intermédiaires**. Dessins SVG à l'échelle, résultats CSV, note de calcul HTML
imprimable.

## La tête d'ancrage

```
      ||  [bloc]  ||        âmes : raidisseurs soudés sur la face libre
    ==++==+====+==++==      platine percée, posée sur le support
    ##################      béton (appui continu) ou lierne (appui aux extrémités)
```

La platine porte sur le support ; les deux âmes sont soudées sur sa face libre
et le bloc d'ancrage et le vérin prennent place entre elles.

- **Appui continu, sur béton.** Tronçon en T comprimé (§6.2.5) : contour rigide
  de la couronne, élargi de `c = t √(f_y / (3 f_jd γ_M0))`, auquel s'ajoutent les
  âmes si l'espace qui les sépare de la couronne n'excède pas `c` — la platine
  leur transmet alors la charge. Les âmes collectent la pression sous leur bande
  et la ramènent vers la couronne en poutres en T. La flexion de la platine est
  couverte par la définition de `c` : elle n'est pas vérifiée une seconde fois.
- **Appui aux extrémités, sur lierne ou berlinoise.** Rien ne porte la platine
  entre ses appuis : elle franchit l'entraxe (bornes `N e / 8` et `N e / 4`,
  `N e / 6` retenu en prédimensionnement, modèle de plaque signalé au-delà de
  0,80), et se suspend aux âmes. L'ensemble est une poutre de portée `L` dont la
  platine est la semelle **tendue** et le chant libre des âmes la fibre
  **comprimée**. Section nette au droit du perçage, interaction de la flexion de
  poutre et de la flexion locale dans la platine (§6.2.1(5)), charge
  transversale sur l'âme de la lierne (EN 1993-1-5 §6), très souvent
  dimensionnante.

Effort de dimensionnement : `N_Ed = max(N_ELU ; P_p ; 0,9 F_tk)`, le terme
gouvernant étant nommé — un ancrage soumis à une épreuve doit rompre dans
l'armature, jamais dans la pièce métallique.

Le **moment local** d'encastrement de la platine sur l'âme remet de la traction
dans la gorge sous un effort global de compression : c'est la cause la plus
fréquente de fissuration en pied de cordon. Il n'est jamais omis, même avec le
contact direct, qui ne retire que des compressions. Il est borné par les
moments plastiques de la platine et de l'âme : le nœud ne transmet pas plus que
ce que la plus faible des deux pièces développe.

**Service (TA 2020).** Le CFMS, *Tirants d'ancrage TA 2020*, exige que la
plaque d'appui se déforme de façon négligeable au transfert de la charge du
vérin à la tête. L'outil constate que la pièce reste élastique sous la traction
de blocage, et compare la flèche à une limite si l'ingénieur en fixe une.
Note de cadrage : le TA 2020 définit le système d'appui (plaque, cales, chaise,
lierne) comme distinct du système d'ancrage et **n'en explicite pas les
justifications**, qu'il renvoie à la construction métallique. C'est pourquoi ce
dépôt applique l'EN 1993-1-8 et non un texte géotechnique.

## Soudures

Méthode directionnelle, §4.5.3.2 :

```
√(σ⊥² + 3 (τ⊥² + τ//²))  ≤  f_u / (β_w γ_M2)
σ⊥                       ≤  0,9 f_u / γ_M2        (traction seulement)
```

Le second critère borne la **traction** dans la gorge ; en compression il est
déclaré **non applicable**, jamais « satisfait ». La méthode simplifiée
(§4.5.3.3) est donnée pour contrôle ; les deux **coïncident** en cisaillement
longitudinal pur, et l'interface le dit au lieu d'afficher deux fois le même
nombre. Groupes de cordons : gorges rabattues sur le plan de joint, répartition
élastique, vérification aux deux extrémités de chaque cordon (les critères sont
convexes, le maximum y est atteint). Gorge de pleine résistance
`a = t f_y β_w γ_M2 / (√2 f_u γ_M0)`, soit 0,46 t en S235 et 0,55 t en S355.

## Limites assumées

- Chargement statique ; la fatigue n'est pas couverte.
- Tête d'ancrage : appui continu sur béton seulement ; sur lierne, appui aux
  extrémités. Déversement couvert par le critère de voilement par torsion du
  raidisseur plat (EN 1993-1-5 §9.2.1(8)), non calculé. Résistance élastique
  des poutres en T, interaction M-V appliquée à toute la section (conservatif).
  Interaction de la charge transversale et de la flexion de la lierne non
  vérifiée (elle relève du calcul de la paroi).
- Arrachement lamellaire : inéquation `Z_Ed ≤ Z_Rd` de l'EN 1993-1-10 avec
  Z_Rd = 15, 25, 35 (10 sans exigence), plus sévère que le tableau 3.2 de
  l'EN 1993-1-1 ; réduction de Z_c pour pièce comprimée non appliquée.
- Détails types : flexion de la pièce de base non vérifiée ; recouvrement
  simple : flexion d'excentricité hors plan non calculée ; profilé : congé
  négligé, profilé lui-même non vérifié.

Les cas de validation, résolus à la main, sont dans
[`docs/validation/vasse.md`](docs/validation/vasse.md).

## Développement

```bash
npm install
npm test           # tests
npm run typecheck  # typage
npm run dev        # interface en local
npm run build      # construction dans docs/, servie par GitHub Pages
```

Unités : efforts en kN, longueurs en mm, contraintes en MPa, moments en kN·m.
Le noyau (`src/`) est pur et n'importe rien de l'interface ; celle-ci (`app/`)
ne calcule rien. Aucune dépendance de production.

## Références

EN 1993-1-8:2005 ; EN 1993-1-1 ; EN 1993-1-5 ; EN 1993-1-10 ; EN 1090-2 ;
EN 10164 ; EN 1537. CFMS, *Tirants d'ancrage TA 2020*.

## Licence

MIT, sans garantie d'aucune sorte — voir [LICENSE](LICENSE).
