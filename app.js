import * as WorkspaceAPI from "https://unpkg.com/trimble-connect-workspace-api";

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

        // Récupère les propriétés de l'objet
        const properties = await API.viewer.getObjectProperties(modelId, objectIds);

        afficherProprietes(properties);
      }
    }
  );

  console.log("API connectée :", API);
}

// Fonction pour afficher les propriétés dans le panneau
function afficherProprietes(props) {
  if (!props) return;

  // Exemple simple : nom + type + dimensions
  const name = props.name || "Nom inconnu";
  const type = props.properties?.["Identity Data"]?.Type || "Type inconnu";
  const height = props.properties?.Dimensions?.Height || "-";

  document.getElementById("properties").innerHTML = `
    <h3>${name}</h3>
    <p>Type : ${type}</p>
    <p>Hauteur : ${height}</p>
  `;
}

// Lancement de la connexion
connectAPI();
