// Import du module ESM de Trimble Connect Workspace API
import * as WorkspaceAPI from "https://unpkg.com/trimble-connect-workspace-api@0.3.34/dist/trimble-connect-workspace-api.esm.js";

async function connectAPI() {
  console.log("Connexion à Trimble...");

  // Connexion à l'API
  const API = await WorkspaceAPI.connect(
    window.parent,
    async (event, args) => {
      console.log("EVENT:", event, args);

      // Vérifie l'événement de sélection
      if (event === "viewer.selection.changed" || event === "viewer.selectionchanged") {
        const selection = args.data;
        if (!selection || selection.length === 0) return;

        const item = selection[0];
        const modelId = item.modelId;
        const objectIds = item.objectRuntimeIds;

        try {
          // Récupère les propriétés de l'objet
          const properties = await API.viewer.getObjectProperties(modelId, objectIds);

          // Filtrer uniquement PSET - Attributs Mensura
          const psetMensura = properties.properties?.["PSET - Attributs Mensura"];
          if (!psetMensura) return;

          afficherProprietes(psetMensura);
        } catch (err) {
          console.error("Erreur récupération propriétés :", err);
        }
      }
    }
  );

  console.log("API connectée :", API);
}

// Fonction pour afficher les propriétés dans le panneau
function afficherProprietes(props) {
  if (!props) return;

  let html = "";
  for (const [key, value] of Object.entries(props)) {
    html += `<p><strong>${key} :</strong> ${value || "-"}</p>`;
  }

  document.getElementById("properties").innerHTML = html;
}

// Lancement de la connexion
connectAPI();import * as WorkspaceAPI from "https://unpkg.com/trimble-connect-workspace-api@0.3.34/dist/trimble-connect-workspace-api.esm.js";

async function connectAPI() {
  console.log("Connexion à Trimble...");

  const API = await WorkspaceAPI.connect(window.parent, async (event, args) => {
    console.log("EVENT:", event, args);

    if (event === "viewer.selection.changed") {
      const selection = args.data;
      if (!selection || selection.length === 0) return;

      const item = selection[0];
      const modelId = item.modelId;
      const objectIds = item.objectRuntimeIds;

      const properties = await API.viewer.getObjectProperties(modelId, objectIds);
      afficherProprietesMensura(properties);
    }
  });

  console.log("API connectée :", API);
}

function afficherProprietesMensura(props) {
  if (!props || !props.properties) return;

  const pset = props.properties["PSET - Attributs Mensura"];
  if (!pset) return;

  let html = "<h3>Propriétés Mensura</h3><ul>";
  for (const key in pset) {
    html += `<li><strong>${key}</strong> : ${pset[key]}</li>`;
  }
  html += "</ul>";

  document.getElementById("properties").innerHTML = html;
}

connectAPI();
