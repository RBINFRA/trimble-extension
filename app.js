import * as WorkspaceAPI from "https://unpkg.com/trimble-connect-workspace-api@0.3.34/dist/trimble-connect-workspace-api.esm.js";

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
