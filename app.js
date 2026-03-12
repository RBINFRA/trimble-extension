/**
 * app.js — Extension Trimble Connect 3D
 * Utilise modelId + id numérique pour getObjectProperties
 */

const PSET_NAME = "PSET-MENSURA";
const POLL_INTERVAL_MS = 800;

const statusEl  = document.getElementById("status");
const contentEl = document.getElementById("content");

function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className   = type;
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

function stringifyForDebug(value) {
  return JSON.stringify(value, (_, current) => (
    typeof current === "bigint" ? current.toString() : current
  ), 2);
}

function extractMensuraProps(propertySets) {
  const sets = Array.isArray(propertySets) ? propertySets : (propertySets ? [propertySets] : []);
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

function getSelectionTarget(selection) {
  const groups = Array.isArray(selection) ? selection : (selection ? [selection] : []);
  for (const group of groups) {
    const runtimeIds = [
      group?.objectRuntimeIds,
      group?.runtimeIds,
      group?.objectIds,
      group?.ids
    ].find(Array.isArray) ?? [];

    if (runtimeIds.length === 0) continue;

    const runtimeId = Number(runtimeIds[0]);
    if (!group?.modelId || !Number.isFinite(runtimeId)) continue;

    return {
      modelId: group.modelId,
      runtimeId
    };
  }

  return null;
}

function getPropertySets(result) {
  if (Array.isArray(result?.properties)) {
    return result.properties;
  }

  if (!Array.isArray(result) || result.length === 0) {
    return [];
  }

  if (result[0]?.name && Array.isArray(result[0]?.properties)) {
    return result;
  }

  return Array.isArray(result[0]?.properties) ? result[0].properties : [];
}

async function loadProperties(api, selectionTarget) {
  setStatus("Chargement…");

  try {
    const { modelId, runtimeId } = selectionTarget;
    if (!modelId || !Number.isFinite(runtimeId)) {
      setStatus("Sélection invalide.", "error");
      contentEl.innerHTML = `<p class="empty-pset">Impossible d’identifier l’objet sélectionné.</p>`;
      return;
    }

    console.log("[Mensura] modelId:", modelId, "runtimeId:", runtimeId);

    const result = await api.viewer.getObjectProperties(modelId, [runtimeId]);
    console.log("[Mensura] getObjectProperties résultat:", stringifyForDebug(result));

    const sets = getPropertySets(result);

    if (sets.length === 0) {
      setStatus("Aucun PSET retourné.", "error");
      contentEl.innerHTML = `<p class="empty-pset">Aucune propriété trouvée pour cet objet.</p>`;
      return;
    }

    const mensuraProps = extractMensuraProps(sets);

    if (mensuraProps) {
      setStatus("Objet sélectionné.", "ok");
      contentEl.innerHTML = buildTable(mensuraProps);
    } else {
      const psetNames = sets.map(s => s.name ?? s.setName ?? "(sans nom)");
      setStatus(`PSET "${PSET_NAME}" introuvable.`, "error");
      contentEl.innerHTML = `
        <p class="empty-pset">PSET disponibles :</p>
        <ul style="font-size:11px;padding-left:16px;margin-top:4px;">
          ${psetNames.map(n => `<li><code>${escapeHtml(n)}</code></li>`).join("")}
        </ul>`;
    }

  } catch (err) {
    console.error("[Mensura] Erreur:", err);
    setStatus("Erreur : " + err.message, "error");
    contentEl.innerHTML = `<p class="empty-pset">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

async function main() {
  setStatus("Connexion à Trimble Connect…");

  if (typeof TrimbleConnectWorkspace === "undefined") {
    setStatus("Erreur : librairie Trimble non chargée.", "error");
    return;
  }

  let api;
  try {
    api = await TrimbleConnectWorkspace.connect(window.parent, null, 30000);
    setStatus("Connecté ✓ — En attente de sélection.", "ok");
    contentEl.innerHTML = `<p style="color:#999;font-style:italic;text-align:center;margin-top:30px;">Sélectionnez un objet dans la maquette.</p>`;
  } catch (err) {
    setStatus("Connexion échouée : " + err.message, "error");
    return;
  }

  let lastId = null;
  setInterval(async () => {
    try {
      const selection = await api.viewer.getSelection();
      const target = getSelectionTarget(selection);
      const currentId = target ? `${target.modelId}:${target.runtimeId}` : null;
      if (currentId === lastId) return;
      lastId = currentId;
      if (!currentId) {
        setStatus("Connecté ✓ — En attente de sélection.", "ok");
        contentEl.innerHTML = `<p style="color:#999;font-style:italic;text-align:center;margin-top:30px;">Sélectionnez un objet dans la maquette.</p>`;
        return;
      }
      await loadProperties(api, target);
    } catch (_) {}
  }, POLL_INTERVAL_MS);
}

main();
