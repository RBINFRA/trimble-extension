/**
 * app.js — Extension Trimble Connect 3D
 * Affiche uniquement les propriétés "PSET - Attributs Mensura"
 * de l'objet sélectionné dans la maquette.
 *
 * Format conforme à la documentation officielle Trimble Connect Workspace API.
 */

import { connect } from "https://unpkg.com/trimble-connect-workspace-api@0.3.34/dist/trimble-connect-workspace-api.esm.js";

// ── Constante ─────────────────────────────────────────────────────────────────
const PSET_NAME = "PSET - Attributs Mensura";

// ── DOM ───────────────────────────────────────────────────────────────────────
const statusEl  = document.getElementById("status");
const contentEl = document.getElementById("content");

// ── UI ────────────────────────────────────────────────────────────────────────
function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className   = type;
}

function showMessage(msg) {
  contentEl.innerHTML = `<p class="no-selection">${msg}</p>`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTable(props) {
  const entries = Object.entries(props);
  if (entries.length === 0) {
    return `<p class="empty-pset">Aucune propriété dans « ${escapeHtml(PSET_NAME)} ».</p>`;
  }
  const rows = entries
    .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join("");
  return `
    <div class="pset-title">${escapeHtml(PSET_NAME)}</div>
    <table><tbody>${rows}</tbody></table>`;
}

// ── Extraction du PSET ────────────────────────────────────────────────────────
function extractMensuraProps(propertySets) {
  const sets = Array.isArray(propertySets) ? propertySets : [propertySets];
  for (const pset of sets) {
    const name = pset.name ?? pset.setName ?? "";
    if (name !== PSET_NAME) continue;
    if (Array.isArray(pset.properties)) {
      const result = {};
      for (const p of pset.properties) { result[p.name] = p.value; }
      return result;
    }
    if (pset.properties && typeof pset.properties === "object") {
      return { ...pset.properties };
    }
  }
  return null;
}

// ── Récupération des propriétés ───────────────────────────────────────────────
async function fetchProperties(api, objectId) {
  const methods = [
    () => api.viewer.getObjectProperties(objectId),
    () => api.viewer.getProperties(objectId),
    () => api.model?.getObjectProperties?.(objectId),
  ];
  for (const fn of methods) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (_) { /* méthode indisponible */ }
  }
  return null;
}

// ── Callback sélection ────────────────────────────────────────────────────────
async function onSelectionChange(api, rawSelection) {
  const ids = Array.isArray(rawSelection)
    ? rawSelection
    : (rawSelection?.ids ?? rawSelection?.objectIds ?? []);

  if (ids.length === 0) {
    showMessage("Sélectionnez un objet dans la maquette.");
    setStatus("En attente de sélection.");
    return;
  }

  const objectId = ids[0];
  setStatus(`Chargement… (id: ${objectId})`);

  try {
    const propertySets = await fetchProperties(api, objectId);

    if (!propertySets) {
      setStatus("Aucune propriété retournée par l'API.", "error");
      showMessage("L'API n'a retourné aucune propriété pour cet objet.");
      return;
    }

    const mensuraProps = extractMensuraProps(propertySets);

    if (mensuraProps === null) {
      setStatus("PSET introuvable sur cet objet.", "error");
      contentEl.innerHTML =
        `<p class="empty-pset">Le PSET « ${escapeHtml(PSET_NAME)} » n'existe pas sur cet objet.</p>`;
      return;
    }

    setStatus(`${ids.length} objet${ids.length > 1 ? "s" : ""} sélectionné${ids.length > 1 ? "s" : ""}.`, "ok");
    contentEl.innerHTML = buildTable(mensuraProps);

  } catch (err) {
    console.error("[Mensura] Erreur propriétés :", err);
    setStatus("Erreur lors de la récupération des propriétés.", "error");
    showMessage(`Erreur : ${escapeHtml(err.message)}`);
  }
}

// ── Abonnement aux événements de sélection ────────────────────────────────────
function listenToSelection(api) {
  if (typeof api.viewer?.onSelectionChanged === "function") {
    api.viewer.onSelectionChanged((data) => onSelectionChange(api, data));
    return;
  }
  if (typeof api.viewer?.addEventListener === "function") {
    api.viewer.addEventListener("selectionChanged", (data) => onSelectionChange(api, data));
    return;
  }
  console.warn("[Mensura] Aucune méthode d'écoute de sélection trouvée.");
  setStatus("Impossible d'écouter la sélection.", "error");
}

// ── Point d'entrée — conforme à la doc officielle ─────────────────────────────
async function main() {
  setStatus("Connexion à Trimble Connect…");
  try {
    // Signature officielle : connect(parent, eventHandler, timeout)
    const api = await connect(
      window.parent,
      (event, data) => {
        console.log("[Mensura] event:", event, data);
      },
      30000
    );

    setStatus("Connecté. En attente de sélection.", "ok");
    showMessage("Sélectionnez un objet dans la maquette.");
    listenToSelection(api);

  } catch (err) {
    console.error("[Mensura] Connexion échouée :", err);
    setStatus("Connexion à Trimble Connect échouée.", "error");
    showMessage(
      "Impossible de se connecter à l'API Trimble Connect.<br>" +
      "Vérifiez que l'extension est chargée depuis Trimble Connect."
    );
  }
}

main();
