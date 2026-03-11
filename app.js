import * as WorkspaceAPI from "https://unpkg.com/trimble-connect-workspace-api";

async function connectAPI() {

  const API = await WorkspaceAPI.connect(window.parent, (event, args) => {

    console.log("Event:", event, args);

    if (event === "viewer.selection.changed") {
      document.getElementById("properties").innerHTML =
        "Objet sélectionné dans la maquette";
    }

  });

}

connectAPI();
