import * as WorkspaceAPI from "https://unpkg.com/trimble-connect-workspace-api";

async function connectAPI() {
  console.log("Connexion à Trimble Connect...");

  // Connexion à l'API
  const API = await WorkspaceAPI.connect(
    window.parent,
    async (event, args) => {
      console.log("EVENT RECU:", event, args);

      // Vérifie l'événement de sélection (selon version API)
      if (event === "viewer.selection.changed" || event === "viewer.selectionchanged") {
        const selection = args.data;
        if (!selection || selection.length === 0) return;

        const item = selection[0];
        const modelId = item.modelId;
        const objectIds = item.objectRuntimeIds;

        try {
          // Récupère les propriétés de l'objet sélectionné
          const props = await API.viewer.getObjectProperties(modelId, objectIds);
          afficherProprietesMensura(props);
        } catch (err) {
          console.error("Erreur récupération propriétés:", err);
          document.getElementById("properties").innerHTML =
            "Impossible de récupérer les propriétés de l'objet sélectionné.";
        }
      }
    }
  );

  console.log("API connectée :", API);
}

if (event === "viewer.selection.changed" || event === "viewer.selectionchanged") {
  const selection = args.data;
  console.log("SELECTION COMPLETE:", selection);
}

  let html = `<h3>${props.name || "Nom inconnu"}</h3>`;
  html += "<ul>";

  // Parcourt chaque clé du PSET
  for (const [key, value] of Object.entries(mensura)) {
    html += `<li><strong>${key}:</strong> ${value}</li>`;
  }

  html += "</ul>";

  document.getElementById("properties").innerHTML = html;
}

// Lancement de la connexion
connectAPI();
