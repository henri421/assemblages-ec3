/**
 * Platines d appui de tetes d ancrage et leurs soudures — EN 1993-1-8:2005.
 *
 * Point d entree public du noyau de calcul.
 */

export const NORME_DE_REFERENCE = 'EN 1993-1-8:2005';

export type { Actions } from './model/actions';
export type {
  Ancrage,
  Appui,
  Assemblage,
  Platine,
  Plats,
  SchemaAppui,
  Soudure,
} from './model/assemblage';
export { NUANCES, QUALITES_Z, type Materiau, type Nuance, type QualiteZ } from './model/materiau';

export { ec3Recommande, validerProfil, type ProfilEC3 } from './norms/ec3-recommande';
export { betaW } from './norms/beta-w';
export { epsilon, limiteElastique, resistanceUltime } from './norms/acier';

export {
  contraintesDansLaGorge,
  type ContraintesGorge,
  type EffortsLineiques,
  type TypeCordon,
} from './soudures/gorge';
export { verifierDirectionnelle, type ResultatDirectionnel, type ResistanceSoudure } from './soudures/directionnelle';
export { verifierSimplifiee, type ResultatSimplifie } from './soudures/simplifiee';
export { gorgePleineResistance, type ResultatPleineResistance } from './soudures/pleine-resistance';
export {
  analyserGroupe,
  proprietesDuGroupe,
  type CordonGroupe,
  type EtatCordon,
  type PointCordon,
  type ProprietesGroupe,
  type ResultatGroupe,
  type SollicitationsGroupe,
} from './soudures/groupe';
export { fluxDansLesCordons, type CasCordon, type FluxSoudures } from './soudures/flux';
export { verifierSoudures, type ResultatSoudures, type VerificationCas } from './soudures/verifier-soudures';

export { verifierPlatine, type ResultatPlatine } from './platine/verifier-platine';
export { aireEffective, verifierTronconEnT, type ResultatTronconEnT } from './platine/troncon-en-t';
export { sectionEnTe, type SectionEnTe } from './ames/section-composee';
export { verifierAmes, type ResultatAmes } from './ames/verifier-ames';

export {
  CONDITIONS_PAR_DEFAUT,
  verifierArrachement,
  type Bridage,
  type ConditionsSoudage,
  type FormeSoudure,
  type ResultatArrachement,
} from './epaisseur/arrachement-lamellaire';
export { verifierService, type ResultatService } from './service/deformation-platine';

export {
  REGLES_CHAISE,
  REGLES_CORDONS,
  type ContexteChaise,
  type ContexteCordons,
  type Regle,
  type Severite,
} from './dispositions/regles';
export {
  verifierDispositions,
  type ConstatRegle,
  type ResultatDispositions,
} from './dispositions/verifier-dispositions';

export { effortDimensionnant, type EffortDimensionnant, type OrigineEffort } from './domaines/effort-dimensionnant';
export { trierTaux, type Taux } from './domaines/taux-de-travail';
export {
  verifierAssemblage,
  type Constat,
  type DonneesAssemblage,
  type ResultatAssemblage,
  type Verdict,
} from './domaines/verifier-assemblage';

export { FORMAT, VERSION, serialiser, type FichierModele, type TypeDetail } from './persistance/format-modele';
export { lireModele } from './persistance/parse';
