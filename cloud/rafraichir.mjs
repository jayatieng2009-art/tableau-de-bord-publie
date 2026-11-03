// Le robot « sans PC » : tourne sur GitHub (voir deployer.yml) quand le PC est éteint et relève les chiffres PUBLICS (le nombre d'abonnés du
// canal Telegram et ses dernières publications). Il écrit `site/data.cloud.enc.json`, chiffré avec le même mot de passe, le même sel et les
// mêmes itérations que `site/data.enc.json` (la page ne calcule la clé qu'une fois). Ce fichier n'est jamais commité : il n'existe que dans
// ce que le workflow met en ligne.
//
// Copié par le PC dans le dépôt de publication sous `cloud/rafraichir.mjs` (le dossier `site/` est à côté de `cloud/`, comme `publication/` à côté
// de `site/` dans le projet). Le mot de passe vient du secret GitHub MOT_DE_PASSE_PAGE.
//
// Règles : ne fait JAMAIS échouer le déploiement (toute panne = rien d'écrit, sortie 0) ; le journal d'un dépôt public est public, donc il ne
// contient ni mot de passe, ni nom de canal, ni chiffre.
import { createCipheriv, pbkdf2, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { deriverCle, dechiffrer, enveloppeValide } from "../site/chiffre.js";

const derivee = promisify(pbkdf2);
const NOM_CANAL = /^[A-Za-z][A-Za-z0-9_]{2,39}$/;
const CANAUX_MAX = 5;
const PUBLICATIONS_MAX = 10;
const TEXTE_MAX = 150;
const DELAI_TELECHARGEMENT = 15000;

// « 1.2K » -> 1200, « 2 134 » -> 2134, « 3,5M » -> 3500000 ; null si illisible.
function nombre(texte) {
  let propre = String(texte).replace(/[\s  ]/g, "").replace(",", ".");
  let facteur = 1;
  const dernier = propre.slice(-1).toUpperCase();
  if (dernier === "K" || dernier === "M") {
    facteur = dernier === "K" ? 1000 : 1000000;
    propre = propre.slice(0, -1);
  }
  if (!/^\d+(\.\d+)?$/.test(propre)) return null;
  const valeur = Math.round(Number(propre) * facteur);
  return Number.isSafeInteger(valeur) && valeur >= 0 && valeur < 1e12 ? valeur : null;
}

function deshtml(texte) {
  const nommees = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return texte.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (entier, code) => {
    if (code[0] !== "#") return nommees[code.toLowerCase()] ?? entier;
    const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entier;
  });
}

function nettoyerTexte(fragment) {
  const sansScripts = fragment.replace(/<(script|style)\b.*?<\/\1\s*>/gis, " ").replace(/<br\s*\/?>/gi, " ");
  const sansBalises = sansScripts.replace(/<[^>]*>/g, " ");
  return deshtml(sansBalises).replace(/[\u0000-\u001f\u007f-\u009f]/g, "").replace(/\s+/g, " ").trim().slice(0, TEXTE_MAX);
}

function iso(valeur) {
  const t = Date.parse(valeur);
  return Number.isFinite(t) ? new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z") : null;
}

// La page publique d'un canal (https://t.me/s/<canal>) -> { abonnes: nombre|null, publications: [{ id, vues, quand, texte }] }.
export function lireCanal(page) {
  let abonnes = null;
  for (const [, valeur, type] of String(page).matchAll(/<span class="counter_value">([^<]{1,20})<\/span>\s*<span class="counter_type">([^<]{1,30})<\/span>/gs)) {
    if (/^\s*(subscriber|abonn)/i.test(type)) {
      abonnes = nombre(valeur);
      break;
    }
  }
  const debuts = [...String(page).matchAll(/data-post="[A-Za-z0-9_]{3,40}\/(\d{1,12})"/g)];
  const publications = debuts.map((m, i) => {
    const bloc = page.slice(m.index, i + 1 < debuts.length ? debuts[i + 1].index : page.length);
    const vues = /<span class="tgme_widget_message_views">([^<]{1,20})<\/span>/.exec(bloc);
    const quand = /<time[^>]*datetime="([^"]{10,40})"/.exec(bloc);
    const texte = /<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)<\/div>/s.exec(bloc);
    return { id: Number(m[1]), vues: vues ? nombre(vues[1]) : null, quand: quand ? iso(quand[1]) : null, texte: texte ? nettoyerTexte(texte[1]) : "" };
  });
  publications.sort((a, b) => b.id - a.id);
  return { abonnes, publications: publications.slice(0, PUBLICATIONS_MAX) };
}

// Les canaux Telegram que suit le bot dans le paquet des données : { releves: { x: { projets: [{ adaptateur: "bot-concours", details: { canal: { nom } } }] } } }.
export function canauxDuPaquet(paquet) {
  const releves = paquet && typeof paquet === "object" && paquet.releves && typeof paquet.releves === "object" ? Object.values(paquet.releves) : [];
  const noms = [];
  for (const releve of releves) {
    for (const projet of releve && Array.isArray(releve.projets) ? releve.projets : []) {
      if (!projet || projet.adaptateur !== "bot-concours") continue;
      const nom = projet.details && projet.details.canal && projet.details.canal.nom;
      if (typeof nom === "string" && NOM_CANAL.test(nom) && !noms.includes(nom)) noms.push(nom);
    }
  }
  return noms.slice(0, CANAUX_MAX);
}

async function telechargerTelegram(url) {
  const reponse = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; tableau-de-bord)" }, signal: AbortSignal.timeout(DELAI_TELECHARGEMENT) });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  return reponse.text();
}

async function chiffrerComme(enveloppeModele, objet, motDePasse) {
  const sel = Buffer.from(enveloppeModele.sel, "base64");
  const cle = await derivee(String(motDePasse).normalize("NFC"), sel, enveloppeModele.iterations, 32, "sha256");
  const iv = randomBytes(12); // neuf à chaque fichier : jamais deux fois le même vecteur avec la même clé
  const chiffreur = createCipheriv("aes-256-gcm", cle, iv);
  const donnees = Buffer.concat([chiffreur.update(JSON.stringify(objet), "utf8"), chiffreur.final(), chiffreur.getAuthTag()]);
  return { v: 1, kdf: "PBKDF2-SHA256", iterations: enveloppeModele.iterations, sel: enveloppeModele.sel, iv: iv.toString("base64"), donnees: donnees.toString("base64") };
}

// Renvoie « ok », « pas-de-mot-de-passe », « pas-de-donnees », « donnees-illisibles », « mot-de-passe-refuse » ou « rien-releve » ; ne lève jamais.
export async function rafraichir({ dossier, motDePasse, telecharger = telechargerTelegram, maintenant = new Date(), journal = console.log }) {
  try {
    if (typeof motDePasse !== "string" || motDePasse.trim() === "") {
      journal("robot cloud : pas de mot de passe (secret MOT_DE_PASSE_PAGE absent), rien à faire");
      return "pas-de-mot-de-passe";
    }
    let enveloppe;
    try {
      enveloppe = JSON.parse(await readFile(join(dossier, "site", "data.enc.json"), "utf8"));
    } catch {
      journal("robot cloud : pas de données à lire, rien à faire");
      return "pas-de-donnees";
    }
    if (!enveloppeValide(enveloppe)) {
      journal("robot cloud : fichier de données illisible, rien à faire");
      return "donnees-illisibles";
    }
    let charge;
    try {
      charge = await dechiffrer(enveloppe, await deriverCle(motDePasse, enveloppe));
    } catch (e) {
      const refuse = e && e.code === "mot-de-passe";
      journal(refuse ? "robot cloud : le mot de passe du secret ne correspond pas à celui de la page, rien à faire" : "robot cloud : données illisibles, rien à faire");
      return refuse ? "mot-de-passe-refuse" : "donnees-illisibles";
    }
    const canaux = {};
    for (const nom of canauxDuPaquet(charge && charge.paquet)) {
      try {
        const lu = lireCanal(await telecharger(`https://t.me/s/${nom}`));
        if (Number.isInteger(lu.abonnes)) canaux[nom] = lu;
      } catch {
        // un canal injoignable : on garde les autres
      }
    }
    const releves = Object.keys(canaux).length;
    if (releves === 0) {
      journal("robot cloud : rien relevé (Telegram injoignable ou page illisible), rien d'écrit");
      return "rien-releve";
    }
    const fichier = await chiffrerComme(enveloppe, { releve_a: maintenant.toISOString().replace(/\.\d{3}Z$/, "Z"), canaux }, motDePasse);
    await writeFile(join(dossier, "site", "data.cloud.enc.json"), JSON.stringify(fichier));
    journal(`robot cloud : ${releves} canal relevé, fichier chiffré écrit`);
    return "ok";
  } catch {
    journal("robot cloud : erreur inattendue, rien d'écrit");
    return "donnees-illisibles";
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  rafraichir({ dossier: join(dirname(fileURLToPath(import.meta.url)), ".."), motDePasse: process.env.MOT_DE_PASSE_PAGE }).then(() => process.exit(0), () => process.exit(0));
}
