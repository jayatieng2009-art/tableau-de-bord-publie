// Page du tableau de bord : récupère data.json et affiche les relevés.
// Le DOM est construit avec textContent uniquement (jamais innerHTML).
import { ageLisible, estPerime, libelleStatut } from "./lib.js";

const NOMS_SOURCES = { "local-pc": "Relevé du PC" };
const STATUTS_CONNUS = ["ok", "introuvable", "pas-de-git", "aucun-commit", "erreur"];

const message = document.getElementById("message");
const contenu = document.getElementById("contenu");
const generation = document.getElementById("generation");

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

function afficherMessage(texte, type) {
  message.textContent = texte;
  message.dataset.type = type;
}

function dateLocale(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function ligneDetail(liste, nom, valeur) {
  liste.append(el("dt", "", nom), el("dd", "", valeur));
}

function carteProjet(projet) {
  const statut = STATUTS_CONNUS.includes(projet.statut) ? projet.statut : "inconnu";
  const carte = el("article", "carte");
  carte.append(el("h3", "", projet.nom), el("span", `statut statut-${statut}`, libelleStatut(projet.statut)));

  if (projet.statut === "ok") {
    const details = projet.details ?? {};
    const commit = details.dernier_commit ?? {};
    const liste = el("dl");
    ligneDetail(liste, "Branche", details.branche ?? "?");
    ligneDetail(liste, "Dernier commit", commit.sujet ?? "?");
    ligneDetail(liste, "Date du commit", commit.date ? dateLocale(commit.date) : "?");
    ligneDetail(liste, "Modifications non validées", String(details.modifications_non_validees ?? "?"));
    carte.append(liste);
  } else if (projet.message) {
    carte.append(el("p", "discret", projet.message));
  }
  return carte;
}

function sectionSource(id, releve, maintenant) {
  const perime = estPerime(releve.releve_a, maintenant, releve.seuil_perime_heures);
  const section = el("section", perime ? "source source-perimee" : "source");

  const entete = el("div", "source-entete");
  entete.append(el("h2", "", NOMS_SOURCES[id] ?? id));
  entete.append(el("span", "discret", `Mis à jour ${ageLisible(releve.releve_a, maintenant)}`));
  if (perime) entete.append(el("span", "badge-perime", "Périmé"));
  section.append(entete);

  if (perime) {
    section.append(el("p", "avertissement", "Ces données sont anciennes (PC éteint ou collecte arrêtée) : ne vous y fiez pas."));
  }
  if (releve.projets.length === 0) {
    section.append(el("p", "discret", "Aucun projet dans ce relevé."));
  }
  const cartes = el("div", "cartes");
  for (const projet of releve.projets) cartes.append(carteProjet(projet));
  section.append(cartes);
  return section;
}

function afficher(paquet) {
  const maintenant = new Date();
  // Sources fraîches d'abord, les périmées ensuite ; à égalité, ordre alphabétique.
  const rang = (r) => (estPerime(r.releve_a, maintenant, r.seuil_perime_heures) ? 1 : 0);
  const sources = Object.entries(paquet.releves).sort(([a, ra], [b, rb]) => rang(ra) - rang(rb) || a.localeCompare(b));
  const sections = sources.map(([id, releve]) => sectionSource(id, releve, maintenant));
  contenu.replaceChildren(...sections);
  contenu.hidden = false;
  message.textContent = "";
  generation.textContent = `Page générée ${ageLisible(paquet.genere_a, maintenant)}`;
}

async function charger() {
  let paquet;
  try {
    const reponse = await fetch("data.json", { cache: "no-store" });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    paquet = await reponse.json();
  } catch {
    afficherMessage("Aucune donnée disponible.", "erreur");
    return;
  }
  try {
    afficher(paquet);
  } catch {
    afficherMessage("Données illisibles : le fichier est abîmé ou d'une version inconnue.", "erreur");
  }
}

charger();
