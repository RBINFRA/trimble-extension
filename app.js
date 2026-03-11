/**
 * app.js — Extension Trimble Connect 3D
 * Utilise getObjects() pour récupérer le GUID IFC depuis le runtime id
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

async function tryGetProperties(api, id) {
  try {
    const result = await api.viewer.getObjectProperties(id);
    const sets = Array.isArray(result) ? result : (result ? [result] : []);
    if (sets.length > 0) return sets;
  } catch (_) {}
  return null;
}

async function loadProperties(api, runtimeId) {
  setStatus("Chargement…");

  // Stratégie 1 : runtime id directement
  let sets = await tryGetProperties(api, runtimeId);

  // Stratégie 2 : convertToObjectIds → id IFC numérique
  if (!sets || sets.length === 0) {
    try {
      const converted = await api.viewer.convertToObjectIds([runtimeId]);
      if (converted && converted.length > 0 && converted[0]) {
        sets = await tryGetProperties(api, converted[0]);
      }
    } catch (_) {}
  }

  // Stratégie 3 : getObjects → récupère le GUID IFC
  if (!sets || sets.length === 0) {
    try {
      const objects = await api.viewer.getObjects({ runtimeIds: [runtimeId] });
      console.log("[Mensura] getObjects :", JSON.stringify(objects));

      if (objects && objects.length > 0) {
        const obj = objects[0];
        // Le GUID IFC peut être dans différents champs
        const ifcGuid = obj.ifcGuid ?? obj.guid ?? obj.id ?? obj.objectId;
        if (ifcGuid) {
          sets = await tryGetProperties(api, ifcGuid);
        }
      }
    } catch (err) {
      console.warn("[Mensura] getObjects échoué :", err.message);
    }
  }

  // Stratégie 4 : getEntities
  if (!sets || sets.length === 0) {
    try {
      const entities = await api.viewer.getEntities({ runtimeIds: [runtimeId] });
      console.log("[Mensura] getEntities :", JSON.stringify(entities));

      if (entities && entities.length > 0) {
        const entity = entities[0];
        const ifcGuid = entity.ifcGuid ?? entity.guid ?? entity.id ?? entity.objectId;
        if (ifcGuid) {
          sets = await tryGetProperties(api, ifcGuid);
        }
      }
    } catch (err) {
      console.warn("[Mensura] getEntities échoué :", err.message);
    }
  }

  // Résultat
  if (!sets || sets.length === 0) {
    setStatus("Impossible de récupérer les propriétés.", "error");
    contentEl.innerHTML = `<p class="empty-pset">
      Aucune propriété trouvée pour cet objet.<br>
      Essayez de sélectionner un objet du fichier REEFER.ifc qui contient PSET-MENSURA.
    </p>`;
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
      const ids = Array.isArray(selection)
        ? selection
        : (selection?.ids ?? selection?.objectIds ?? []);
      const currentId = ids.length > 0 ? String(ids[0]) : null;
      if (currentId === lastId) return;
      lastId = currentId;
      if (!currentId) {
        setStatus("Connecté ✓ — En attente de sélection.", "ok");
        contentEl.innerHTML = `<p style="color:#999;font-style:italic;text-align:center;margin-top:30px;">Sélectionnez un objet dans la maquette.</p>`;
        return;
      }
      await loadProperties(api, currentId);
    } catch (_) {}
  }, POLL_INTERVAL_MS);
}

main();
