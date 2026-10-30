// Déchiffrement des données de la page en ligne (WebCrypto). Utilisable dans le navigateur et dans Node (tests/chiffre.test.mjs).
// Format produit par chiffrer.mjs : AES-256-GCM, clé = PBKDF2-SHA256(mot de passe, sel, itérations), données = texte chiffré + étiquette.
// Les bornes de l'enveloppe sont vérifiées AVANT tout calcul : une enveloppe trafiquée ne peut pas faire tourner le téléphone des minutes.

const ITERATIONS_MIN = 100000;
const ITERATIONS_MAX = 2000000;
const TAILLE_MAX_DONNEES = 8 * 1024 * 1024;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function erreur(code, message) {
  return Object.assign(new Error(message), { code });
}

function octets(base64) {
  if (typeof base64 !== "string" || base64.length === 0 || base64.length % 4 !== 0 || !BASE64.test(base64)) return null;
  try {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export function enveloppeValide(e) {
  if (!e || typeof e !== "object" || Array.isArray(e)) return false;
  if (e.v !== 1 || e.kdf !== "PBKDF2-SHA256") return false;
  if (!Number.isInteger(e.iterations) || e.iterations < ITERATIONS_MIN || e.iterations > ITERATIONS_MAX) return false;
  const sel = octets(e.sel);
  const iv = octets(e.iv);
  if (!sel || sel.length < 16 || sel.length > 64 || !iv || iv.length !== 12) return false;
  if (typeof e.donnees !== "string" || e.donnees.length > TAILLE_MAX_DONNEES * 1.4) return false;
  const donnees = octets(e.donnees);
  return Boolean(donnees) && donnees.length >= 17 && donnees.length <= TAILLE_MAX_DONNEES;
}

// La clé AES dérivée du mot de passe ; la dernière est gardée en mémoire (le calcul coûte quelques centaines de millisecondes).
let derniere = null;

export async function deriverCle(motDePasse, enveloppe) {
  if (!enveloppeValide(enveloppe)) throw erreur("format", "Enveloppe de données invalide.");
  const identifiant = `${enveloppe.sel}|${enveloppe.iterations}|${motDePasse}`;
  if (derniere && derniere.identifiant === identifiant) return derniere.cle;
  const sujet = globalThis.crypto.subtle;
  const matiere = await sujet.importKey("raw", new TextEncoder().encode(String(motDePasse).normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  const cle = await sujet.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: octets(enveloppe.sel), iterations: enveloppe.iterations },
    matiere, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
  );
  derniere = { identifiant, cle };
  return cle;
}

export async function dechiffrer(enveloppe, cle) {
  if (!enveloppeValide(enveloppe)) throw erreur("format", "Enveloppe de données invalide.");
  let clair;
  try {
    clair = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: octets(enveloppe.iv) }, cle, octets(enveloppe.donnees));
  } catch {
    throw erreur("mot-de-passe", "Mot de passe incorrect (ou données abîmées).");
  }
  try {
    return JSON.parse(new TextDecoder().decode(clair));
  } catch {
    throw erreur("format", "Données illisibles après déchiffrement.");
  }
}
