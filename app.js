/**
 * app.js — Extension Trimble Connect 3D
 * Utilise le CDN officiel Trimble (IIFE) : TrimbleConnectWorkspace global
 * Affiche les propriétés "PSET - Attributs Mensura" de l'objet sélectionné.
 */

const PSET_NAME = "PSET - Attributs Mensura";

const statusEl  = document.getElementById("status");
const contentEl = document.getElementById("content");

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
  return `<div class="pset-title">${escapeHtml(PSET_NAME)}</div>
    <table><tbody>${rows}</tbody></table>`;
}

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
    } catch (_) {}
  }
  return null;
}

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

async function main() {
  setStatus("Connexion à Trimble Connect…");

  // Attend que TrimbleConnectWorkspace soit disponible (chargé par le script IIFE)
  if (typeof TrimbleConnectWorkspace === "undefined") {
    setStatus("Erreur : librairie Trimble non chargée.", "error");
    showMessage("La librairie TrimbleConnectWorkspace n'est pas disponible.");
    return;
  }

  try {
    const api = await TrimbleConnectWorkspace.connect(
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
