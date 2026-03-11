async function connectAPI() {
  console.log("Connexion à Trimble...");

  const API = await TrimbleConnectWorkspace.connect(window.parent, async (event, args) => {
    console.log("EVENT:", event, args);

    // Vérifie l'événement de sélection
    if (event === "viewer.selection.changed" || event === "viewer.selectionchanged") {
      const selection = args.data;
      if (!selection || selection.length === 0) {
        document.getElementById("properties").innerHTML = "";
        return;
      }

      const item = selection[0];
      const modelId = item.modelId;
      const objectIds = item.objectRuntimeIds;

      try {
        // Récupère les propriétés de l'objet
        const properties = await API.viewer.getObjectProperties(modelId, objectIds);
        const mensura = properties?.properties?.["PSET - Attributs Mensura"];

        afficherProprietes(mensura, properties?.name);
      } catch (err) {
        console.error("Erreur récupération propriétés:", err);
        document.getElementById("properties").innerHTML = "Impossible de récupérer les propriétés.";
      }
    }
  });

  console.log("API connectée :", API);
}

// Fonction pour afficher uniquement les propriétés du PSET Attributs Mensura
function afficherProprietes(props, name) {
  if (!props) {
    document.getElementById("properties").innerHTML = "Aucune propriété Mensura disponible pour cet objet.";
    return;
  }

  const html = Object.entries(props)
    .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
    .join("");

  document.getElementById("properties").innerHTML = `
    <h3>${name || "Objet sélectionné"}</h3>
    ${html}
  `;
}

// Lancer la connexion
connectAPI();
