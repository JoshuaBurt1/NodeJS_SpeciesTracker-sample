// Import express and create a router object
const express = require("express");
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
var logMiddleware = require('../logMiddleware'); //route logging middleware
const IsLoggedIn = require("../extensions/authentication");

//Mongoose models
const Plant = require("../models/plant"); // Import mongoose model to be used

//FILE STORAGE (multer)
// Update the storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.user._id; // Assuming user object is available after authentication
    const userImagesPath = `public/images/plantae_images`;
    fs.mkdirSync(path.join(__dirname, '..', userImagesPath), { recursive: true });
    cb(null, userImagesPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

// Use the middleware to check if the user is logged in
router.use(IsLoggedIn);

// Function to sanitize the search query
const sanitizeQuery = (query) => {
  return query.replace(/[()\\?]/g, ''); // Remove parentheses, backslashes, and question marks
};

// GET handler for index /plants/ <<landing/root page of my sections
const pageSize = 4;
router.get('/', IsLoggedIn, logMiddleware, async (req, res, next) => {
  try {
    // SearchBar query parameter
    let searchQuery = sanitizeQuery(req.query.searchBar || '');
    const userId = req.user._id;
    // Use a case-insensitive regular expression to match part of the name
    let query = {
      $or: [
        { name: { $regex: new RegExp(searchQuery, 'i') } },
        { binomialNomenclature: { $regex: new RegExp(searchQuery, 'i') } }
      ],
      user: userId // Include user ID in the search criteria
    };
    let page = parseInt(req.query.page) || 1;
    let skipSize = pageSize * (page - 1);
    const plants = await Plant.find(query)
      .sort({ binomialNomenclature: 1, updateDate: 1 })
      .limit(pageSize)
      .skip(skipSize);
    const totalRecords = await Plant.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / pageSize);
    res.render("plants", {
      title: "Plant Dataset",
      user: req.user,
      dataset: plants,
      searchQuery: searchQuery,
      totalPages: totalPages,
      currentPage: page,
    });
    console.log(plants);

  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
});
//ADD name field = name_timestamp.jpg
const userImagesPath = 'public/images/plantae_images';
// Ensure the directory exists
fs.mkdirSync(path.join(__dirname, '..', userImagesPath), { recursive: true });


const createUniqueImageName = (binomialNomenclature, userId, originalName) => {
  // Replace spaces with underscores in the binomial nomenclature
  const formattedName = binomialNomenclature.replace(/\s+/g, '_');
  const extension = path.extname(originalName);
  const timestamp = new Date().getTime();
  const uniqueName = `${formattedName}_${timestamp}_${userId}${extension}`;
  return uniqueName;
};

const Exifr = require('exifr'); //FOR DATA INTEGRITY VARIABLES
function convertToDecimal(latitude, longitude, latRef, lonRef) { // Function to convert GPS coordinates to decimal form
  const lat = convertCoordinate(latitude);
  const lon = convertCoordinate(longitude);
  const latWithSign = latRef === 'S' ? -lat : lat;
  const lonWithSign = lonRef === 'W' ? -lon : lon;
  return latWithSign.toFixed(6).toString() + ', ' + lonWithSign.toFixed(6).toString();
}
function convertCoordinate(coordinate) { // Function to convert coordinate to decimal form
  const [degrees, minutes, seconds] = coordinate;
  const decimal = degrees + minutes / 60 + seconds / 3600;
  return decimal;
}
function convertToDate(dateTimeOriginal) { // Function to convert date to the specified format
  const date = new Date(dateTimeOriginal);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); // Correct for local time zone offset (**this may need to be changed)
  return `${date.getUTCFullYear()}:${String(date.getUTCMonth() + 1).padStart(2, '0')}:${String(date.getUTCDate()).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')}`;
}

//GET handler for /plants/add (loads page)
router.get("/add", IsLoggedIn, logMiddleware, (req, res, next) => {
  res.render("plants/add", { user: req.user, title: "Add a new Plant" });
});

// POST handler for /plants/add (saves new entry to database)
router.post("/add", IsLoggedIn, upload.array('images'), async (req, res, next) => {
  try {
    const plantEntries = [];
    const userId = req.user._id; // Get user ID

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const binomialNomenclature = req.body.binomialNomenclature[i] || "Unnamed"; // Use default if not provided
      const name = req.body.name[i] || "Unnamed"; // Get the name from the form

      // Generate the unique image name
      const uniqueImageName = createUniqueImageName(binomialNomenclature, userId, file.originalname);
      const newDestinationPath = path.join(__dirname, '..', userImagesPath, uniqueImageName);
      await fs.promises.rename(file.path, newDestinationPath);
      
      // Extract metadata from the image
      const metadata = await Exifr.parse(newDestinationPath);
      
      // Convert GPS coordinates to decimal form
      const imageGPS = metadata?.GPSLatitude && metadata?.GPSLongitude
          ? convertToDecimal(metadata.GPSLatitude, metadata.GPSLongitude, metadata.GPSLatitudeRef, metadata.GPSLongitudeRef)
          : null;

      // Convert date to the specified format
      const imageDate = metadata?.DateTimeOriginal ? convertToDate(metadata.DateTimeOriginal) : null;

      // Use user-provided data if available; otherwise, fallback to metadata
      const location = req.body.location[i] || imageGPS; // Use user input or fallback to GPS
      const updateDate = req.body.updateDate[i] || imageDate; // Use user input or fallback to date

      const dateDataIntegrityValue = updateDate === imageDate ? 0 : 1; // Check against metadata
      const locationDataIntegrityValue = location === imageGPS ? 0 : 1; // Check against metadata

      // Create a new plant entry
      const createdModel = await Plant.create({
        name: name,
        binomialNomenclature: binomialNomenclature,
        updateDate: updateDate, // Use user-provided or metadata
        location: location, // Use user-provided or metadata
        image: uniqueImageName,
        user: req.user._id,
        dateChanged: dateDataIntegrityValue,
        locationChanged: locationDataIntegrityValue,
      });

      plantEntries.push(createdModel);
      console.log("Created model:", createdModel);
    }

    console.log("Models created successfully:", plantEntries);
    res.redirect("/plants");
  } catch (error) {
    console.error("An error occurred:", error);
    console.error("Error stack:", error.stack);
    res.redirect("/error");
  }
});

// GET handler for /plants/edit (loads page)
router.get("/edit/:_id", IsLoggedIn, logMiddleware, async  (req, res, next) => {
  try {
    const plantObj = await Plant.findById(req.params._id).exec();
    console.log(plantObj);
    console.log(plantObj.name);
    res.render("plants/edit", {
      user: req.user,
      title: "Edit a Plant Entry",
      plant: plantObj
      //user: req.user,
    });
  } catch (err) {
    console.error(err);
    // Handle the error appropriately
  }
});

// POST handler for /plants/edit (edits entry)
router.post("/edit/:_id", IsLoggedIn, upload.single('image'), async (req, res, next) => {
  try {
    // Step 1: Retrieve the existing plant entry
    const plantToUpdate = await Plant.findById(req.params._id).exec();
    if (!plantToUpdate) {
      console.log("Plant not found");
      return res.redirect("/error");
    }
    const imagePath = req.file ? req.file.path : plantToUpdate.image;
    console.log("Current image path: "+ imagePath);
    // Step 2: Handle the new image upload
    const newDestinationPath = path.join(__dirname, '..', userImagesPath, imagePath);
    // Extract metadata from the new image
    const metadata = await Exifr.parse(newDestinationPath);
    const imageGPS = metadata?.GPSLatitude && metadata?.GPSLongitude ? convertToDecimal(metadata.GPSLatitude, metadata.GPSLongitude, metadata.GPSLatitudeRef, metadata.GPSLongitudeRef) : null;
    const imageDate = metadata?.DateTimeOriginal ? convertToDate(metadata.DateTimeOriginal) : null;
    const dateDataIntegrityValue = (imageDate === req.body.updateDate) ? 0 : 1;
    const locationDataIntegrityValue = (imageGPS === req.body.location) ? 0 : 1;

    // Step 3: Update the entry
    await Plant.findOneAndUpdate(
      { _id: req.params._id },
      {
        name: req.body.name,
        binomialNomenclature: req.body.binomialNomenclature,
        updateDate: req.body.updateDate,
        location: req.body.location,
        image: imagePath, // Use the new image path or retain the old one
        user: req.user._id, // Use req.user._id to get the currently logged-in user's ID
        dateChanged: dateDataIntegrityValue,
        locationChanged: locationDataIntegrityValue,
      }
    );
    res.redirect("/plants");
  } catch (err) {
    console.error("Update error:", err); // Log the error for debugging
    res.redirect("/error");
  }
});

// GET /plants/delete/652f1cb7740320402d9ba04d
router.get("/delete/:_id", IsLoggedIn, async (req, res, next) => {
  try {
    const plantId = req.params._id;

    // Find the plant to be deleted
    const plantToDelete = await Plant.findById(plantId).exec();

    if (!plantToDelete) {
      console.log("Plant not found");
      return res.redirect("/error");
    }

    // Delete the image file associated with the plant if it exists
    if (plantToDelete.image) {
      const imagePath = path.join(__dirname, '..', 'public/images/plantae_images', plantToDelete.image);

      // Use async unlink and handle potential errors
      try {
        await fs.promises.unlink(imagePath);
      } catch (err) {
        console.error("Error deleting image file:", err);
        // You might want to continue even if the file wasn't deleted
      }
    }

    // Delete the plant from the database
    await Plant.deleteOne({ _id: plantId });
    res.redirect("/plants");
  } catch (err) {
    console.error("An error occurred during deletion:", err);
    res.redirect("/error");
  }
});
// Export this router module
module.exports = router;  