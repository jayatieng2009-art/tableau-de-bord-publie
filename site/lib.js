// Fonctions pures du tableau de bord : âge des données, libellés.
// Utilisable dans le navigateur et dans Node (tests/lib.test.mjs).

const SECONDE = 1000;
const MINUTE = 60 * SECONDE;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

// Durée écoulée depuis `iso`, en millisecondes ; null si la date est illisible.
function ecoule(iso, maintenant) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : maintenant.getTime() - t;
}

export function ageLisible(iso, maintenant) {
  const ms = ecoule(iso, maintenant);
  if (ms === null) return "date inconnue";
  if (ms < MINUTE) return "à l'instant"; // inclut les dates futures (horloge du PC en avance)
  if (ms < HEURE) return `il y a ${Math.floor(ms / MINUTE)} min`;
  if (ms < JOUR) return `il y a ${Math.floor(ms / HEURE)} h`;
  return `il y a ${Math.floor(ms / JOUR)} j`;
}

export function estPerime(iso, maintenant, seuilHeures) {
  const ms = ecoule(iso, maintenant);
  if (ms === null) return true; // une date illisible ne prouve pas que la donnée est fraîche
  return ms > seuilHeures * HEURE;
}

const LIBELLES_STATUT = {
  ok: "Relevé réussi",
  introuvable: "Dossier introuvable",
  "pas-de-git": "Pas de dépôt git",
  "aucun-commit": "Aucun commit",
  erreur: "Erreur de relevé",
};

export function libelleStatut(statut) {
  return Object.hasOwn(LIBELLES_STATUT, statut) ? LIBELLES_STATUT[statut] : "Statut inconnu";
}
