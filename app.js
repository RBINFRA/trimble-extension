/**
 * app.js — Extension Trimble Connect 3D — MODE DIAGNOSTIC
 */

const PSET_NAME = "PSET - Attributs Mensura";
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
    return `<p style="color:#999;font-style:italic">Aucune propriété dans « ${escapeHtml(PSET_NAME)} ».</p>`;
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

// Affiche le résultat brut dans le panneau
function showRaw(data) {
  try {
    const sets = Array.isArray(data) ? data : [data];
    const psetNames = sets.map(s => s.name ?? s.setName ?? "(sans nom)");

    contentEl.innerHTML = `
      <div style="font-size:11px;padding:8px;background:#fff3cd;border:1px solid #ffc107;border-radius:4px;margin-bottom:8px;">
        <strong>PSET disponibles (${sets.length}) :</strong><br>
        ${psetNames.map(n => `• <code>${escapeHtml(n)}</code>`).join("<br>")}
      </div>`;

    // Cherche Mensura
    const props = extractMensuraProps(data);
    if (props) {
      setStatus("PSET Mensura trouvé !", "ok");
      contentEl.innerHTML += buildTable(props);
    } else {
      setStatus(`PSET "${PSET_NAME}" introuvable.`, "error");
    }
  } catch(e) {
    contentEl.innerHTML = `<pre style="font-size:10px;overflow:auto">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
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
    setStatus("Connecté ✓ — sélectionnez un objet puis cliquez le bouton.", "ok");
  } catch (err) {
    setStatus("Connexion échouée : " + err.message, "error");
    return;
  }

  // Bouton de test manuel
  contentEl.innerHTML = `
    <button id="btnTest" style="
      display:block;width:100%;padding:10px;margin-bottom:10px;
      background:#0072c6;color:white;border:none;border-radius:4px;
      font-size:13px;cursor:pointer;">
      📋 Lire la sélection actuelle
    </button>
    <div id="result"><p style="color:#999;font-style:italic;text-align:center;margin-top:20px;">
      Sélectionnez un objet dans la maquette puis cliquez le bouton.
    </p></div>`;

  document.getElementById("btnTest").addEventListener("click", async () => {
    const resultEl = document.getElementById("result");
    setStatus("Lecture en cours…");

    try {
      // Test getSelection
      const selection = await api.viewer.getSelection();
      const ids = Array.isArray(selection)
        ? selection
        : (selection?.ids ?? selection?.objectIds ?? []);

      resultEl.innerHTML = `<p style="font-size:11px;margin-bottom:8px;">
        <strong>getSelection() :</strong> ${escapeHtml(JSON.stringify(ids))}
      </p>`;

      if (ids.length === 0) {
        setStatus("Aucun objet sélectionné.", "error");
        return;
      }

      const objectId = String(ids[0]);
      setStatus(`Objet : ${objectId} — chargement propriétés…`);

      const propertySets = await api.viewer.getObjectProperties(objectId);
      showRaw(propertySets);

    } catch (err) {
      setStatus("Erreur : " + err.message, "error");
      resultEl.innerHTML = `<pre style="font-size:10px;color:red;">${escapeHtml(err.stack)}</pre>`;
    }
  });

  // Polling en parallèle
  let lastId = null;
  setInterval(async () => {
    try {
      const selection = await api.viewer.getSelection();
      const ids = Array.isArray(selection)
        ? selection
        : (selection?.ids ?? selection?.objectIds ?? []);
      const currentId = ids.length > 0 ? String(ids[0]) : null;
      if (currentId === lastId) return;
      lastId = currentId;
      if (!currentId) {
        setStatus("Connecté ✓ — En attente de sélection.", "ok");
        return;
      }
      setStatus(`Objet détecté : ${currentId}`, "ok");
      const propertySets = await api.viewer.getObjectProperties(currentId);
      showRaw(propertySets);
    } catch (_) {}
  }, POLL_INTERVAL_MS);
}

main();
