# SpeciesTracker
Concept biological catalogue; contains approximately 1 GB of images.<br>

https://species-tracker.onrender.com

# To Start: <br>
* Download zip, open in code editor (i.e. VS code)
* Download Node.js, create a MongoDB account and cluster
* Download node_modules. In terminal: npm install
* Add folder & file config/globals.js <br>
const configurations = {  <br>
  plantNetAPI: "your_plantNet_API_key", <br>
  openAIAPIKey: "your_openAI_API_key", <br>
  db: "your_mongodb_link",  <br>
  github: { <br>
    clientId: "your_id", <br>
    clientSecret: "your_secret", <br>
    callbackUrl: "callback_url", <br>
  }, <br>
}; <br>
module.exports = configurations;<br>
* In terminal: npm start
* Open a browser and run in http://localhost:3000/ or http://localhost:3001/

# Capabilities <br>
~Database with create, read, update, delete <br>
~Search bar <br>
~Image upload <br>
~Date, time, gps autofill <br>
~Coordinates to map & map to coordinates <br>
~Single and multi plant image identification (plantNet API) <br>
~OpenAI API in dataviewer to compare and analyze multiple species location and time data <br>
~Website databaseAPI, csv download, total image download <br>
~User authentication & github auth <br>
~Message board <br>