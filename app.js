/**
 * app.js — Extension Trimble Connect 3D
 * Utilise modelId + id numérique pour getObjectProperties
 */

const PSET_NAME = "PSET - Attributs Mensura";
const SECONDARY_PSET_NAME = "PSET-MENSURA";
const GENERAL_INFO_TITLE = "Informations générales";
const MATERIALS_TITLE = "Matériaux";
const SOURCES_TITLE = "Sources";
const GEOMETRY_TITLE = "Géométrie";
const MISSING_DATA_LABEL = "Pas de données";
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

function buildSection(title, rows) {
  return `<section class="pset-section">
    <table>
      <thead>
        <tr><th colspan="2" class="section-heading">${escapeHtml(title)}</th></tr>
      </thead>
      <tbody>${rows
        .map(({ label, value, missing }) => `<tr><td>${escapeHtml(label)}</td><td class="${missing ? "value-missing" : "value-present"}">${escapeHtml(value)}</td></tr>`)
        .join("")}</tbody>
    </table>
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
    return pset.properties
      .filter((property) => property && property.name != null)
      .map((property) => [property.name, property.value]);
  }

  if (pset.properties && typeof pset.properties === "object") {
    return Object.entries(pset.properties);
  }

  return [];
}

function normalizePropertyName(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function getPropertyValue(pset, candidates) {
  const entries = getPropertyEntries(pset);
  if (!entries.length) return undefined;

  const normalizedCandidates = candidates.map(normalizePropertyName);
  for (const [name, value] of entries) {
    if (normalizedCandidates.includes(normalizePropertyName(name))) {
      return value;
    }
  }

  return undefined;
}

function formatDisplayValue(value) {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return typeof value === "object" ? stringifyForDebug(value) : String(value);
}

function formatSurfaceValue(value) {
  if (value == null) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} m²`;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (trimmedValue === "") return null;

    const normalizedValue = trimmedValue
      .replace(/\s*m(?:²|2)\s*$/i, "")
      .replace(/\s+/g, "")
      .replace(",", ".");
    const numericValue = Number(normalizedValue);

    if (Number.isFinite(numericValue)) {
      return `${numericValue.toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} m²`;
    }
  }

  return formatDisplayValue(value);
}

function buildRow(label, value) {
  const displayValue = formatDisplayValue(value);
  return {
    label,
    value: displayValue ?? MISSING_DATA_LABEL,
    missing: displayValue == null
  };
}

function getPrimaryObject(result) {
  if (Array.isArray(result)) {
    return result[0] ?? null;
  }

  return result ?? null;
}

function buildPropertiesView(propertySets, product) {
  const primaryPset = findPropertySet(propertySets, PSET_NAME);
  const secondaryPset = findPropertySet(propertySets, SECONDARY_PSET_NAME);

  return [
    buildSection(GENERAL_INFO_TITLE, [
      buildRow("ZONE", getPropertyValue(primaryPset, ["ZONE"])),
      buildRow("NOM", getPropertyValue(secondaryPset, ["Nom couche"]) ?? product?.name)
    ]),
    buildSection(MATERIALS_TITLE, [
      buildRow("COUCHE 1", getPropertyValue(primaryPset, ["COUCHE 1", "COUCHE1"])),
      buildRow("COUCHE 2", getPropertyValue(primaryPset, ["COUCHE 2", "COUCHE2"])),
      buildRow("COUCHE 3", getPropertyValue(primaryPset, ["COUCHE 3", "COUCHE3"])),
      buildRow("COUCHE 4", getPropertyValue(primaryPset, ["COUCHE 4", "COUCHE4"])),
      buildRow("COUCHE 5", getPropertyValue(primaryPset, ["COUCHE 5", "COUCHE5"]))
    ]),
    buildSection(SOURCES_TITLE, [
      buildRow("SOURCE", getPropertyValue(primaryPset, ["SOURCE"])),
      buildRow("ENTRPRISE D'EXECUTION", getPropertyValue(primaryPset, ["ENTRPRISE D'EXECUTION", "ENTREPRISE D'EXECUTION"])),
      buildRow("DATE", getPropertyValue(primaryPset, ["DATE"]))
    ]),
    buildSection(GEOMETRY_TITLE, [
      buildRow("SURFACE", formatSurfaceValue(getPropertyValue(secondaryPset, ["Surface Horizontale"])))
    ])
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

    const objectResult = getPrimaryObject(result);
    const sets = getPropertySets(result);
    const propertiesView = buildPropertiesView(sets, objectResult?.product);

    setStatus("Objet sélectionné.", "ok");
    contentEl.innerHTML = propertiesView;

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
