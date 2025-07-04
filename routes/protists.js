// Import express and create a router object
const express = require("express");
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
var logMiddleware = require('../logMiddleware'); //route logging middleware
const IsLoggedIn = require("../extensions/authentication");

//Mongoose models
const Protist = require("../models/protist"); // Import mongoose model to be used

//FILE STORAGE
// Update the storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.user._id; // Assuming user object is available after authentication
    const userImagesPath = `public/images/protista_images`;

    // Ensure the user's folder exists, create if not
    fs.mkdirSync(path.join(__dirname, '..', userImagesPath), { recursive: true });

    // Set the destination path
    cb(null, userImagesPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
// Use the updated storage configuration
const upload = multer({ storage: storage });
// Use the middleware to check if the user is logged in
router.use(IsLoggedIn);

// Function to sanitize the search query
const sanitizeQuery = (query) => {
  return query.replace(/[()\\?]/g, ''); // Remove parentheses, backslashes, and question marks
};

// Configure GET/POST handlers
// GET handler for index /protists/ <<landing/root page of my sections
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
    
    const protists = await Protist.find(query)
      .sort({ binomialNomenclature: 1, updateDate: 1 })
      .limit(pageSize)
      .skip(skipSize);

    const totalRecords = await Protist.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / pageSize);

    res.render("protists", {
      title: "Protist Dataset",
      user: req.user,
      dataset: protists,
      searchQuery: searchQuery,
      totalPages: totalPages,
      currentPage: page,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
});

//ADD name field = name_timestamp.jpg
const userImagesPath = 'public/images/protista_images';
// Ensure the directory exists
fs.mkdirSync(path.join(__dirname, '..', userImagesPath), { recursive: true });
const createUniqueImageName = (name, originalName) => {
  // Replace spaces with underscores in the name
  const formattedName = name.replace(/\s+/g, '_');
  const extension = path.extname(originalName);
  const timestamp = new Date().getTime();
  const uniqueName = `${formattedName}_${timestamp}${extension}`;
  return uniqueName;
};

//ADD view POST
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



router.post("/add", IsLoggedIn, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      console.log("No image uploaded");
      return res.redirect("/error");
    }

    const ext = path.extname(req.file.originalname);
    const safeBinomial = req.body.binomialNomenclature.replace(/\s+/g, '_').toLowerCase();
    const timestamp = Date.now();
    const userId = req.user._id.toString();

    const uniqueImageName = `${safeBinomial}_${timestamp}_${userId}${ext}`;
    const newDestinationPath = path.join(__dirname, '..', userImagesPath, uniqueImageName);

    await fs.promises.rename(req.file.path, newDestinationPath);

    const metadata = await Exifr.parse(newDestinationPath);
    const imageGPS = metadata?.GPSLatitude && metadata?.GPSLongitude
      ? convertToDecimal(metadata.GPSLatitude, metadata.GPSLongitude, metadata.GPSLatitudeRef, metadata.GPSLongitudeRef)
      : null;
    const imageDate = metadata?.DateTimeOriginal ? convertToDate(metadata.DateTimeOriginal) : null;

    const dateDataIntegrityValue = (imageDate === req.body.updateDate) ? 0 : 1;
    const locationDataIntegrityValue = (imageGPS === req.body.location) ? 0 : 1;

    const createdModel = await Protist.create({
      name: req.body.name,
      binomialNomenclature: req.body.binomialNomenclature,
      updateDate: req.body.updateDate,
      location: req.body.location,
      image: uniqueImageName,
      user: req.user._id,
      dateChanged: dateDataIntegrityValue,
      locationChanged: locationDataIntegrityValue,
    });

    console.log("Protist created successfully:", createdModel);
    res.redirect("/protists");
  } catch (error) {
    console.error("Protist creation error:", error);
    res.redirect("/error");
  }
});



//TODO C > Create new protist
//GET handler for /protists/add (loads)
router.get("/add", IsLoggedIn, logMiddleware, (req, res, next) => {
  res.render("protists/add", { user: req.user, title: "Add a new Protist" });
});

//GET handler for /protists/edit (loads entry)
router.get("/edit/:_id", IsLoggedIn, logMiddleware, async  (req, res, next) => {
  try {
    const protistObj = await Protist.findById(req.params._id).exec();
    console.log(protistObj);
    res.render("protists/edit", {
      user: req.user,
      title: "Edit a Protist Entry",
      protist: protistObj
      //user: req.user,
    });
  } catch (err) {
    console.error(err);
    // Handle the error appropriately
  }
});

// POST handler for /protists/edit (edits entry)
router.post("/edit/:_id", IsLoggedIn, upload.single('image'), async (req, res, next) => {
  try {
    const protistToUpdate = await Protist.findById(req.params._id).exec();
    if (!protistToUpdate) {
      console.log("Protist not found");
      return res.redirect("/error");
    }

    const oldImagePath = protistToUpdate.image;
    const oldImageAbsolutePath = path.join(__dirname, '..', userImagesPath, oldImagePath);
    const ext = path.extname(oldImagePath);
    const oldFilename = path.basename(oldImagePath, ext);
    const parts = oldFilename.split('_');
    const userIdFromOld = parts.length > 0 ? parts[parts.length - 1] : req.user._id.toString();

    const safeBinomial = req.body.binomialNomenclature.replace(/\s+/g, '_').toLowerCase();
    const timestamp = Date.now();
    const newImageFilename = `${safeBinomial}_${timestamp}_${userIdFromOld}${ext}`;
    const newImageRelativePath = newImageFilename;
    const newImageAbsolutePath = path.join(__dirname, '..', userImagesPath, newImageRelativePath);

    let finalImagePath;

    if (req.file) {
      await fs.promises.rename(req.file.path, newImageAbsolutePath);
      if (oldImagePath && oldImagePath !== newImageRelativePath) {
        try {
          await fs.promises.unlink(oldImageAbsolutePath);
          console.log(`Deleted old image: ${oldImageAbsolutePath}`);
        } catch (err) {
          console.warn(`Could not delete old image: ${oldImageAbsolutePath}`, err);
        }
      }
      finalImagePath = newImageRelativePath;
    } else {
      if (oldImagePath !== newImageRelativePath) {
        await fs.promises.rename(oldImageAbsolutePath, newImageAbsolutePath);
        finalImagePath = newImageRelativePath;
      } else {
        finalImagePath = oldImagePath;
      }
    }

    const metadata = await Exifr.parse(newImageAbsolutePath);
    const imageGPS = metadata?.GPSLatitude && metadata?.GPSLongitude
      ? convertToDecimal(metadata.GPSLatitude, metadata.GPSLongitude, metadata.GPSLatitudeRef, metadata.GPSLongitudeRef)
      : null;
    const imageDate = metadata?.DateTimeOriginal ? convertToDate(metadata.DateTimeOriginal) : null;

    const dateDataIntegrityValue = (imageDate === req.body.updateDate) ? 0 : 1;
    const locationDataIntegrityValue = (imageGPS === req.body.location) ? 0 : 1;

    await Protist.findOneAndUpdate(
      { _id: req.params._id },
      {
        name: req.body.name,
        binomialNomenclature: req.body.binomialNomenclature,
        updateDate: req.body.updateDate,
        location: req.body.location,
        image: finalImagePath,
        user: req.user._id,
        dateChanged: dateDataIntegrityValue,
        locationChanged: locationDataIntegrityValue,
      }
    );

    res.redirect("/protists");

  } catch (err) {
    console.error("Protist update error:", err);
    res.redirect("/error");
  }
});


// GET /protists/delete/652f1cb7740320402d9ba04d
router.get("/delete/:_id", IsLoggedIn, async (req, res, next) => {
  try {
    const protistId = req.params._id;

    // Find the protist to be deleted
    const protistToDelete = await Protist.findById(protistId).exec();

    if (!protistToDelete) {
      console.log("Protist not found");
      return res.redirect("/error");
    }

    // Delete the image file associated with the protist if it exists
    if (protistToDelete.image) {
      const imagePath = path.join(__dirname, '..', 'public/images/protista_images', protistToDelete.image);

      // Use async unlink and handle potential errors
      try {
        await fs.promises.unlink(imagePath);
      } catch (err) {
        console.error("Error deleting image file:", err);
        // You might want to continue even if the file wasn't deleted
      }
    }

    // Delete the protist from the database
    await Protist.deleteOne({ _id: protistId });

    res.redirect("/protists");
  } catch (err) {
    console.error("An error occurred during deletion:", err);
    res.redirect("/error");
  }
});

// Export this router module
module.exports = router;  