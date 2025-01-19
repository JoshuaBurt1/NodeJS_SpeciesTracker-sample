# SpeciesTracker
Concept biological catalogue; contains approximately 1 GB of images.<br>
Sample version changes: <br>
- If redeployed on Render hosting service, then all user upload images (sample instance are deleted). Only those images uploaded to GitHub will be in place. <br>
- Map script is created in each respective view. <br>
https://species-tracker.onrender.com <br>

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

# To Start: <br>
Click on the link. <br>
https://species-tracker.onrender.com <br>

# To Run Locally: <br>
* Download zip, open in code editor (i.e. VS code)
* Download Node.js, create a MongoDB account and cluster
* Download node_modules. In terminal: npm install
* Add .env file at root of folder containing the following: <br>
DB_STRING= your_mongodb_connection_string <br>
GITHUB_CLIENTID = your_id <br>
GITHUB_CLIENTSECRET = your_secret <br>
GITHUB_CALLBACKURL = callback_url <br>
PLANTNET_APIKEY = your_plantNet_API_key <br>
OPENAI_APIKEY = your_openAI_API_key <br>
* In terminal: npm start
* Open a browser and run in http://localhost:3000/ or http://localhost:3001/