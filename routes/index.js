var express = require('express');
const fs = require('fs'); //for image download
const fsPromise = require('fs/promises'); //for image download
const archiver = require('archiver'); //for image download
const path = require('path');
var router = express.Router();
var User = require("../models/user");
var passport = require("passport");
var logMiddleware = require('../logMiddleware'); //route logging middleware

// Constants
const MODEL_NAMES = ['Plant','Fungus','Animal','Protist','Bacterium'];
const { createObjectCsvStringifier } = require("csv-writer");

// Import Mongoose models
const Plant = require("../models/plant");
const Fungus = require("../models/fungus");
const Animal = require("../models/animal");
const Protist = require("../models/protist");
const Bacterium = require("../models/bacterium");

// Map model names to model references
const modelMap = {
  'Plant': Plant,
  'Fungus': Fungus,
  'Animal': Animal,
  'Protist': Protist,
  'Bacterium': Bacterium
};

// Helper function to fetch data from a specific model
const fetchData = async (model, searchQuery, binomialNomenclatureQuery, kingdomQuery) => {
  return await model.find({
    $or: [
      { name: { $regex: new RegExp(searchQuery, 'i') } },
      { binomialNomenclature: { $regex: new RegExp(binomialNomenclatureQuery, 'i') } },
      { kingdom: { $regex: new RegExp(kingdomQuery, 'i') } },
    ],
  }).sort({ binomialNomenclature: 1 });
};


//Creates a json file of all names and binomialNomenclature when a user goes to /dataViewer => Necessary for faster drop-down menu searching
//A decision was made regarding drop-down menu option generation; Option 1 was chosen
//1. Read from a .json file generated once and populate options (Fast)
//2. make an fetch request from client side each time the user types in a letter, the drop-drop menu is then updated: (Approx 3sec downdown menu change per letter entered)
const updateJsonList = async () => {
  const filePath = path.join(__dirname, 'speciesList.json');

  const fetchAndCombineData = async () => {
    const modelData = await Promise.all(MODEL_NAMES.map(modelName =>
      fetchData(modelMap[modelName])
    ));
    const combinedData = modelData.flat();
    const uniqueDataMap = new Map();

    /*// If user wants search bar with associated image
    combinedData.forEach(({ name, binomialNomenclature, kingdom, image }) => {
      if (!uniqueDataMap.has(binomialNomenclature)) {
        const imagePath = `public/images/${kingdom.toLowerCase()}_images/${image}`;
        uniqueDataMap.set(binomialNomenclature, { name, binomialNomenclature, image: imagePath });
      }
    });*/

    combinedData.forEach(({ name, binomialNomenclature, kingdom }) => {
      if (!uniqueDataMap.has(binomialNomenclature)) {
        uniqueDataMap.set(binomialNomenclature, { name, binomialNomenclature});
      }
    });

    return Array.from(uniqueDataMap.values());
  };

  try {
    await fsPromise.access(filePath);
    // File exists, read and update it
    const speciesList = await fetchAndCombineData();
    let existingData = [];

    try {
      const fileContent = await fsPromise.readFile(filePath, 'utf-8');
      existingData = JSON.parse(fileContent);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error; // Rethrow other errors
    }

    // Update only if there's a change
    if (JSON.stringify(existingData) !== JSON.stringify(speciesList)) {
      await fsPromise.writeFile(filePath, JSON.stringify(speciesList, null, 2), 'utf-8');
      console.log('Updated: speciesList.json');
    } else {
      console.log('No changes detected, speciesList.json not updated.');
    }

  } catch (error) {
    if (error.code === 'ENOENT') {
      // File does not exist, create and populate it
      const speciesList = await fetchAndCombineData();
      await fsPromise.writeFile(filePath, JSON.stringify(speciesList, null, 2), 'utf-8');
      console.log('Created and populated speciesList.json with initial data.');
    } else {
      console.error('Error accessing speciesList.json:', error);
    }
  }
};

//updateCsv and updateJsonList need a check for similarity to prevent a server restart loop
const updateCsv = async () => {
  try {
    const binomialNomenclatureQuery = ""; // Adjust as needed
    const kingdomQuery = ""; // Adjust as needed

    const modelData = await Promise.all(MODEL_NAMES.map(model => 
      fetchData(modelMap[model], binomialNomenclatureQuery, kingdomQuery)
    ));

    const combinedData = modelData.flat();
    const groupedData = combinedData.reduce((acc, item) => {
      const existingItem = acc.find(groupedItem => groupedItem.name === item.name);
      if (existingItem) {
        existingItem.locations.push(item.location);
        existingItem.updateDates.push(item.updateDate);
      } else {
        acc.push({
          binomialNomenclature: item.binomialNomenclature,
          name: item.name,
          kingdom: item.kingdom,
          locations: [item.location],
          updateDates: [item.updateDate],
        });
      }
      return acc;
    }, []);

    const csvData = groupedData.map(group => ({
      binomialNomenclature: group.binomialNomenclature,
      name: group.name,
      kingdom: group.kingdom,
      locations: group.locations.join(', '),
      updateDates: group.updateDates.join(', '),
    }));

    const csvPath = path.join(__dirname, 'speciesData.csv');
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: "binomialNomenclature", title: "Binomial Nomenclature" },
        { id: "name", title: "Name" },
        { id: "kingdom", title: "Kingdom" },
        { id: "locations", title: "Locations" },
        { id: "updateDates", title: "Update Dates" },
      ],
    });

    const newCsvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(csvData);
    
    // Check if the existing file exists and read its content
    if (fs.existsSync(csvPath)) {
      const existingCsvContent = fs.readFileSync(csvPath, 'utf8');
      
      // Compare the new content with the existing content
      if (newCsvContent !== existingCsvContent) {
        fs.writeFileSync(csvPath, newCsvContent);
        console.log('CSV file updated successfully.');
      } else {
        console.log('No changes detected, speciesData.csv not updated.');
      }
    } else {
      // If the file does not exist, write the new content
      fs.writeFileSync(csvPath, newCsvContent);
      console.log('CSV file created successfully.');
    }
  } catch (err) {
    console.error('Error updating CSV:', err);
  }
};

/* GET and POST handlers */
//CSV updating
// Method 1. updates on server start speciesData.CSV & speciesList.json on server start
//* do not put this inside router.get('/') because whenever someone adds a new species and goes on the home page, updateCsv(); & updateJsonList(); will call.
//This will restart the server causing all users to log out *
updateCsv(); 
updateJsonList();
/* Method 2. Route to update CSV (can be called when server starts or scheduled) 
***** USE WITH node-cron because a server may be on for several days without updating new information*****
router.get('/update-csv', async (req, res) => {
  await updateJsonList();
  await updateCsv();
  res.json({ message: 'speciesData.csv & speciesList.json file updated successfully.' });
});*/

// GET handler for /login
router.get("/login", logMiddleware, (req, res, next) => {
  let messages = req.session.messages || [];
  req.session.messages = [];
  res.render("login", {user: req.user, title: "Login to the App", messages: messages });
});

//POST /login (user click login button)
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureMessage: "Invalid Credentials",
  })
);

// GET handler for /register (user loads page)
router.get("/register", logMiddleware, (req, res, next) => {
  res.render("register", {user: req.user, title: "Create an Account" });
});

  //POST handler for /register
router.post("/register", (req, res, next) => {
  // Create a new user based on the information from the page
  User.register(
    new User({
      username: req.body.username,
      email: req.body.email,
    }),
    req.body.password,
    (err, newUser) => {
      if (err) {
        console.log(err);
        // take user back and reload register page
        return res.redirect("/register");
      } else {
        // log user in
        req.login(newUser, (err) => {
          res.redirect("/");
        });
      }
    }
  );
});

// GET handler for logout
router.get("/logout", logMiddleware, (req, res, next) => {
  req.logout(function (err) {
    res.redirect("/login");
  });
});

// GET handler /github passport authenticate and pass the name of the strategy 
router.get('/github', passport.authenticate('github', { scope: ['user.email'] }));

// GET handler for /github/callback 
// this is the url they come back to after entering their credentials
router.get('/github/callback',
  // callback to send user back to login if unsuccessful
  passport.authenticate('github', { failureRedirect: '/login' }),
  // callback when login is successful
  (req, res, next) => { res.redirect('/') }
);

//homepage
router.get('/', logMiddleware, function(req, res, next) {
  res.render('index', { user: req.user, title: 'Species Tracker'});
});

// Group and sort data API endpoint
router.get("/api", async (req, res) => {
  try {
    let searchQuery = req.query.searchBar || "";
    let kingdomQuery = req.query.searchBar || "";

    // Create a function to fetch data from a specific model
    const fetchData = async (model) => {
      return await model.find({
        $or: [
          { name: { $regex: new RegExp(searchQuery, 'i') } },
          { kingdom: { $regex: new RegExp(kingdomQuery, 'i') } },
        ],
      }).sort({ binomialNomenclature: 1 });
    };

    // Fetch data from each model without pagination
    const [plantData, fungusData, animalData, protistData, bacteriumData] = await Promise.all([
      fetchData(Plant),
      fetchData(Fungus),
      fetchData(Animal),
      fetchData(Protist),
      fetchData(Bacterium)
      // Add queries for other models (Plant, Bacterium) if needed
    ]);

    // Combine data from different models into a single array
    const combinedData = [...plantData, ...fungusData, ...animalData, ...protistData, ...bacteriumData];

    // Group entries by name and collect locations, update dates into arrays
    const groupedData = combinedData.reduce((acc, item) => {
      const existingItem = acc.find((groupedItem) => groupedItem.name === item.name);

      if (existingItem) {
        existingItem.locations.push(item.location);
        existingItem.updateDates.push(item.updateDate);
        // Exclude pushing item.image into the images array
      } else {
        acc.push({
          binomialNomenclature: item.binomialNomenclature,
          name: item.name,
          kingdom: item.kingdom,
          locations: [item.location],
          updateDates: [item.updateDate],
          // Exclude creating images array and pushing item.image
        });
      }

      return acc;
    }, []);

    // Sort each named entry by updateDate keeping association to location
    groupedData.forEach((group) => {
      const zippedData = group.updateDates.map((updateDate, index) => ({
        updateDate,
        location: group.locations[index],
        // Exclude including image in zippedData
      }));
      zippedData.sort((a, b) => a.updateDate.localeCompare(b.updateDate));
      group.locations = zippedData.map((item) => item.location);
      group.updateDates = zippedData.map((item) => item.updateDate);
      // Exclude creating and mapping the images array
    });

    // Respond with the groupedData in JSON format
    res.json(groupedData);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Download data as CSV endpoint
// Route for downloading the CSV file
router.get('/download-csv', (req, res) => {
  const csvPath = path.join(__dirname, 'speciesData.csv');
  
  if (fs.existsSync(csvPath)) {
    res.download(csvPath, 'speciesData.csv', (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Error downloading file');
      }
    });
  } else {
    res.status(404).send('CSV file not found');
  }
});

// Calculates CSV file size from server and returns to client side
router.get('/csv-info', (req, res) => {
  const csvFilePath = path.join(__dirname, '../routes/speciesData.csv'); // Adjust the path as necessary

  try {
    const stats = fs.statSync(csvFilePath);
    
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Not a valid CSV file' });
    }

    const sizeBytes = stats.size;
    const sizeKB = Math.round(sizeBytes / 1024); // Convert to KB
    const sizeGB = (sizeBytes / (1024 * 1024 * 1024)).toFixed(2); // Convert to GB

    // Send the response with the file size in KB and GB
    res.json({ sizeKB, sizeGB });
  } catch (error) {
    console.error('Error accessing CSV file:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.get('/download-images', (req, res) => {
  const directoryPath = path.join(__dirname, '../public/images');
  // Create a new zip archive
  const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level
  });
  // Pipe the archive to the response object
  archive.pipe(res);
  // Function to recursively add files from all directories
  function addFilesToArchive(dir) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
          const filePath = path.join(dir, file);
          if (fs.statSync(filePath).isDirectory()) {
              addFilesToArchive(filePath);
          } else {
              archive.file(filePath, { name: path.relative(directoryPath, filePath) });
          }
      });
  }
  // Add files from all directories
  addFilesToArchive(directoryPath);
  // Finalize the archive
  archive.finalize();
  // Handle archive errors
  archive.on('error', err => {
      console.error('Error creating archive:', err);
      res.status(500).send('Error creating archive');
  });
  // Set the response headers
  res.attachment('images.zip');
});

//Calculates image data size from server and returns to client side
router.get('/images-info', (req, res) => {
  const imagesDirectory = path.join(__dirname, '../public/images');
  // Function to recursively calculate directory size
  function getDirectorySize(directory) {
    //console.log('Calculating size for directory:', directory);
    let totalSize = 0;
    const files = fs.readdirSync(directory);
    //console.log('Files in directory:', files);
    files.forEach(file => {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            //console.log('Entering subdirectory:', filePath);
            totalSize += getDirectorySize(filePath);
        } else {
            //console.log('File:', filePath, 'Size:', stats.size);
            totalSize += stats.size;
        }
    });
    //console.log('Total size for directory:', directory, 'is', totalSize);
    return totalSize;
}
  // Calculate the size of the images directory
  const directorySize = getDirectorySize(imagesDirectory);
  // Convert bytes to kilobytes for easier readability
  const sizeGB = Math.round(directorySize);
  // Send the response with the directory size in KB
  res.json({ size: sizeGB });
});

module.exports = router;