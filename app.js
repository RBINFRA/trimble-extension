/**
 * app.js — Extension Trimble Connect 3D
 * CDN officiel Trimble (IIFE) — TrimbleConnectWorkspace global
 * Écoute la sélection par polling sur api.viewer.getSelection()
 */

const PSET_NAME = "PSET - Attributs Mensura";
const POLL_INTERVAL_MS = 800;

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

async function handleObjectSelected(api, objectId) {
  setStatus(`Chargement… (id: ${objectId})`);
  try {
    const propertySets = await api.viewer.getObjectProperties(objectId);

    // ── DIAGNOSTIC : affiche la structure brute dans la console ──────────────
    console.log("[Mensura] getObjectProperties brut :", JSON.stringify(propertySets, null, 2));

    // Affiche aussi tous les noms de PSET disponibles dans le panneau
    const sets = Array.isArray(propertySets) ? propertySets : [propertySets];
    const psetNames = sets.map(s => s.name ?? s.setName ?? "(sans nom)");
    console.log("[Mensura] Noms de PSET disponibles :", psetNames);

    // Affiche les noms dans le panneau pour diagnostic visuel
    contentEl.innerHTML = `
      <div style="font-size:11px;padding:8px;background:#fff3cd;border:1px solid #ffc107;border-radius:4px;margin-bottom:8px;">
        <strong>PSET disponibles sur cet objet :</strong><br>
        ${psetNames.map(n => `• ${escapeHtml(n)}`).join("<br>")}
      </div>`;

    if (!propertySets) {
      setStatus("Aucune propriété retournée par l'API.", "error");
      showMessage("L'API n'a retourné aucune propriété pour cet objet.");
      return;
    }

    const mensuraProps = extractMensuraProps(propertySets);

    if (mensuraProps === null) {
      setStatus("PSET introuvable — voir liste ci-dessous.", "error");
      return;
    }

    setStatus("Objet sélectionné.", "ok");
    contentEl.innerHTML = buildTable(mensuraProps);

  } catch (err) {
    console.error("[Mensura] Erreur propriétés :", err);
    setStatus("Erreur lors de la récupération des propriétés.", "error");
    showMessage(`Erreur : ${escapeHtml(err.message)}`);
  }
}

function startSelectionPolling(api) {
  let lastObjectId = null;

  setInterval(async () => {
    try {
      const selection = await api.viewer.getSelection();
      const ids = Array.isArray(selection)
        ? selection
        : (selection?.ids ?? selection?.objectIds ?? []);
      const currentId = ids.length > 0 ? String(ids[0]) : null;
      if (currentId === lastObjectId) return;
      lastObjectId = currentId;
      if (!currentId) {
        showMessage("Sélectionnez un objet dans la maquette.");
        setStatus("En attente de sélection.");
        return;
      }
      await handleObjectSelected(api, currentId);
    } catch (_) {}
  }, POLL_INTERVAL_MS);
}

async function main() {
  setStatus("Connexion à Trimble Connect…");
  if (typeof TrimbleConnectWorkspace === "undefined") {
    setStatus("Erreur : librairie Trimble non chargée.", "error");
    showMessage("La librairie TrimbleConnectWorkspace n'est pas disponible.");
    return;
  }
  try {
    const api = await TrimbleConnectWorkspace.connect(window.parent, null, 30000);
    setStatus("Connecté. En attente de sélection.", "ok");
    showMessage("Sélectionnez un objet dans la maquette.");
    startSelectionPolling(api);
  } catch (err) {
    console.error("[Mensura] Connexion échouée :", err);
    setStatus("Connexion à Trimble Connect échouée.", "error");
    showMessage("Impossible de se connecter à l'API Trimble Connect.");
  }
}

main();
