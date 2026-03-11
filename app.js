/**
 * app.js — Extension Trimble Connect
 * Affiche uniquement les propriétés "PSET - Attributs Mensura"
 * de l'objet sélectionné dans la maquette.
 *
 * Import ESM : évite le problème de MIME type du fichier .iife.js
 */

import * as WorkspaceAPI from "https://unpkg.com/trimble-connect-workspace-api@0.3.34/dist/trimble-connect-workspace-api.esm.js";

// ── Constantes ────────────────────────────────────────────────────────────────

const PSET_NAME = "PSET - Attributs Mensura";

// ── Éléments DOM ──────────────────────────────────────────────────────────────

const statusEl  = document.getElementById("status");
const contentEl = document.getElementById("content");

// ── Helpers UI ────────────────────────────────────────────────────────────────

function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className   = type; // "", "error", "ok"
}

function showMessage(msg) {
  contentEl.innerHTML = `<p class="no-selection">${msg}</p>`;
}

/**
 * Construit un tableau HTML à partir d'un objet { clé: valeur }.
 */
function buildTable(props) {
  if (!props || Object.keys(props).length === 0) {
    return `<p class="empty-pset">Aucune propriété trouvée dans « ${PSET_NAME} ».</p>`;
  }

  const rows = Object.entries(props)
    .map(([key, val]) => `
      <tr>
        <td>${escapeHtml(key)}</td>
        <td>${escapeHtml(String(val ?? ""))}</td>
      </tr>`)
    .join("");

  return `
    <div class="pset-title">${escapeHtml(PSET_NAME)}</div>
    <table>
      <tbody>${rows}</tbody>
    </table>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Extraction des propriétés Mensura ────────────────────────────────────────

/**
 * Parcourt la liste des property sets retournés par l'API
 * et retourne uniquement ceux dont le nom correspond à PSET_NAME.
 *
 * L'API peut retourner différentes structures selon la version ;
 * on tente les deux formes connues.
 */
function extractMensuraProps(propertySets) {
  // Forme 1 : tableau de { name, properties: [ { name, value } ] }
  // Forme 2 : tableau de { setName, properties: { key: value } }
  for (const pset of propertySets) {
    const name = pset.name ?? pset.setName ?? "";
    if (name !== PSET_NAME) continue;

    // Forme 1
    if (Array.isArray(pset.properties)) {
      const result = {};
      for (const p of pset.properties) {
        result[p.name] = p.value;
      }
      return result;
    }

    // Forme 2
    if (pset.properties && typeof pset.properties === "object") {
      return pset.properties;
    }
  }
  return null;
}

// ── Gestion de la sélection ───────────────────────────────────────────────────

/**
 * Appelé à chaque changement de sélection dans Trimble Connect.
 * @param {object} api     — instance WorkspaceAPI connectée
 * @param {string[]} ids   — tableau d'identifiants d'objets sélectionnés
 */
async function onSelectionChange(api, ids) {
  if (!ids || ids.length === 0) {
    showMessage("Sélectionnez un objet dans la maquette.");
    setStatus("En attente de sélection.");
    return;
  }

  // On ne traite que le premier objet sélectionné
  const objectId = ids[0];
  setStatus(`Chargement des propriétés… (id: ${objectId})`);

  try {
    // Récupère les property sets de l'objet
    // La méthode exacte peut varier selon la version de l'API :
    //   api.viewer.getObjectProperties(objectId)
    //   api.viewer.getProperties(objectId)
    //   api.model.getObjectProperties(objectId)
    // On essaie dans l'ordre et on prend le premier qui fonctionne.
    let propertySets = null;

    const candidates = [
      () => api.viewer.getObjectProperties(objectId),
      () => api.viewer.getProperties(objectId),
      () => api.model?.getObjectProperties?.(objectId),
    ];

    for (const fn of candidates) {
      try {
        const result = await fn();
        if (result) { propertySets = result; break; }
      } catch (_) {
        // méthode non disponible, on essaie la suivante
      }
    }

    if (!propertySets) {
      setStatus("Impossible de récupérer les propriétés.", "error");
      showMessage("L'API n'a retourné aucune propriété pour cet objet.");
      return;
    }

    // Normalise en tableau si l'API renvoie un objet directement
    const sets = Array.isArray(propertySets) ? propertySets : [propertySets];

    const mensuraProps = extractMensuraProps(sets);

    if (mensuraProps === null) {
      setStatus(`Objet sélectionné — PSET introuvable.`, "error");
      contentEl.innerHTML = `<p class="empty-pset">Le PSET « ${escapeHtml(PSET_NAME)} » n'existe pas sur cet objet.</p>`;
      return;
    }

    setStatus(`Objet sélectionné (${ids.length} objet${ids.length > 1 ? "s" : ""}).`, "ok");
    contentEl.innerHTML = buildTable(mensuraProps);

  } catch (err) {
    console.error("[Mensura] Erreur lors de la récupération des propriétés :", err);
    setStatus("Erreur lors de la récupération des propriétés.", "error");
    showMessage(`Erreur : ${err.message}`);
  }
}

// ── Point d'entrée ────────────────────────────────────────────────────────────

async function main() {
  setStatus("Connexion à Trimble Connect…");

  let api;
  try {
    // WorkspaceAPI.connect() retourne une promesse résolue avec l'API connectée
    api = await WorkspaceAPI.connect(
      window.parent,          // hôte Trimble Connect (iFrame parent)
      (event, data) => {      // callback d'événements globaux (optionnel)
        console.debug("[Mensura] event:", event, data);
      },
      30_000                  // timeout en ms
    );
  } catch (err) {
    console.error("[Mensura] Connexion échouée :", err);
    setStatus("Connexion à Trimble Connect échouée.", "error");
    showMessage("Impossible de se connecter à l'API Trimble Connect.<br>Vérifiez que l'extension est chargée depuis Trimble Connect.");
    return;
  }

  setStatus("Connecté. En attente de sélection.", "ok");
  showMessage("Sélectionnez un objet dans la maquette.");

  // Écoute les changements de sélection
  // Nom de l'événement selon la doc officielle :
  try {
    api.viewer.onSelectionChanged(async (selectionData) => {
      // selectionData peut être un tableau d'ids ou un objet { ids: [...] }
      const ids = Array.isArray(selectionData)
        ? selectionData
        : selectionData?.ids ?? selectionData?.objectIds ?? [];
      await onSelectionChange(api, ids);
    });
  } catch (err) {
    // Certaines versions utilisent un nom d'événement différent
    console.warn("[Mensura] onSelectionChanged non disponible, tentative via addEventListener.");
    try {
      api.viewer.addEventListener("selectionChanged", async (selectionData) => {
        const ids = Array.isArray(selectionData)
          ? selectionData
          : selectionData?.ids ?? selectionData?.objectIds ?? [];
        await onSelectionChange(api, ids);
      });
    } catch (err2) {
      console.error("[Mensura] Impossible d'écouter les événements de sélection :", err2);
      setStatus("Impossible d'écouter la sélection.", "error");
    }
  }
}

main();
