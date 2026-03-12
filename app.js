/**
 * app.js — Extension Trimble Connect 3D
 * Utilise modelId + id numérique pour getObjectProperties
 */

const PSET_NAME = "PSET - Attributs Mensura";
const SECONDARY_PSET_NAME = "PSET-MENSURA";
const SECONDARY_PROPERTY_NAME = "Code de PTF";
const GENERAL_INFO_TITLE = "Information générale";
const MATERIALS_TITLE = "Matériaux";
const POLL_INTERVAL_MS = 800;
const REPO_OWNER = "RBINFRA";
const REPO_NAME = "trimble-extension";

const statusEl  = document.getElementById("status");
const contentEl = document.getElementById("content");
const branchEl = document.getElementById("branch");

function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className   = type;
}

function setBranch(branchName) {
  const label = branchName?.trim() || "inconnue";
  branchEl.textContent = `Branche active : ${label}`;
}

function getBranchFromQuery() {
  const branchName = new URLSearchParams(window.location.search).get("branch");
  return branchName?.trim() || null;
}

function getBranchFromUrl() {
  const { hostname, pathname } = window.location;
  const segments = pathname.split("/").filter(Boolean);

  if (hostname === "raw.githubusercontent.com" && segments.length >= 3) {
    return segments[2];
  }

  if (hostname === "raw.githack.com" && segments.length >= 3) {
    return segments[2];
  }

  return null;
}

async function getDefaultBranch() {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Échec de lecture de ${url} (statut ${response.status}).`);
  }

  const repo = await response.json();
  return repo.default_branch?.trim() || null;
}

async function initBranch() {
  try {
    const branchName = getBranchFromQuery()
      || getBranchFromUrl()
      || await getDefaultBranch();
    setBranch(branchName);
  } catch (err) {
    console.warn("[Mensura] Impossible de déterminer la branche active:", err);
    setBranch(null);
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSection(title, rows, emptyMessage = "") {
  const body = rows.length > 0
    ? `<table><tbody>${rows
      .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
      .join("")}</tbody></table>`
    : (emptyMessage ? `<p class="empty-pset">${escapeHtml(emptyMessage)}</p>` : "");

  return `<section class="pset-section">
    <div class="pset-title">${escapeHtml(title)}</div>
    ${body}
  </section>`;
}

function stringifyForDebug(value) {
  return JSON.stringify(value, (_, current) => (
    typeof current === "bigint" ? current.toString() : current
  ), 2);
}

function findPropertySet(propertySets, targetName) {
  const sets = Array.isArray(propertySets) ? propertySets : (propertySets ? [propertySets] : []);
  for (const pset of sets) {
    const name = pset.name ?? pset.setName ?? "";
    if (name === targetName) return pset;
  }
  return null;
}

function getPropertyEntries(pset) {
  if (!pset) return [];

  if (Array.isArray(pset.properties)) {
    return pset.properties.map((property) => [property?.name, property?.value]);
  }

  if (pset.properties && typeof pset.properties === "object") {
    return Object.entries(pset.properties);
  }

  return [];
}

function buildPropertiesView(propertySets) {
  const generalRows = [];

  const primaryEntries = getPropertyEntries(findPropertySet(propertySets, PSET_NAME));
  if (primaryEntries[0]) {
    generalRows.push(primaryEntries[0]);
  }

  const secondaryEntries = getPropertyEntries(findPropertySet(propertySets, SECONDARY_PSET_NAME));
  const secondaryMatch = secondaryEntries.find(([name]) => name === SECONDARY_PROPERTY_NAME);
  if (secondaryMatch) {
    generalRows.push(["NOM", secondaryMatch[1]]);
  }

  if (generalRows.length === 0) {
    return "";
  }

  return [
    buildSection(GENERAL_INFO_TITLE, generalRows),
    buildSection(MATERIALS_TITLE, [])
  ].join("");
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

    const propertiesView = buildPropertiesView(sets);

    if (propertiesView) {
      setStatus("Objet sélectionné.", "ok");
      contentEl.innerHTML = propertiesView;
    } else {
      const psetNames = sets.map(s => s.name ?? s.setName ?? "(sans nom)");
      setStatus(`PSET "${PSET_NAME}" ou "${SECONDARY_PSET_NAME}" introuvable.`, "error");
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
  await initBranch();
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
