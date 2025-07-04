//NOTE: use the dataviewer folder to add the buttons to compare data and make inferences
var express = require('express');
var router = express.Router();
var logMiddleware = require('../logMiddleware'); // Route logging middleware

// Import configurations
//const configurations = require('../config/globals'); // Adjust the path as necessary
const OpenAI = require('openai');
const openai = new OpenAI({
    //apiKey: configurations.openAIAPIKey, // Use the key from your config
    apiKey: process.env.OPENAI_APIKEY,
});

// Constants
const MODEL_NAMES = ['Plant', 'Fungus', 'Animal', 'Protist', 'Bacterium'];
//const pageSize = 4;

// Import Mongoose models
const Plant = require("../models/plant");
const Fungus = require("../models/fungus");
const Animal = require("../models/animal");
const Protist = require("../models/protist");
const Bacterium = require("../models/bacterium");

// Helper function to fetch data from a specific model
const fetchData = async (model, searchQueries) => {
  // Create a regex pattern that matches any of the search terms
  const pattern = searchQueries.join('|');
  const regex = new RegExp(pattern, 'i');
  return await model.find({
    $or: [
      { name: { $regex: regex } },
      { binomialNomenclature: { $regex: regex } },
    ]
  }).sort({ binomialNomenclature: 1 });
};

router.get("/", logMiddleware, async (req, res, next) => {
  try {
    let searchQuery = req.query.searchBar || '';

    // Prevents long load time of returning all data
    if (!searchQuery.trim()) {
      return res.render("dataviewer/index", {
        title: "Data Viewer",
        user: req.user,
        dataset: [], // Empty dataset since there's no search query
        searchQuery: searchQuery,
        // totalPages: 0,
        // currentPage: 1,
      });
    }

    // Split the search query into terms using comma or semicolon
    const searchQueries = searchQuery.split(/[,;]+/).map(query => query.trim()).filter(query => query);

    // Fetch data from each model (plants, fungus, animal, protist, bacteria) to find a match to searchQueries
    const modelData = await Promise.all(MODEL_NAMES.map(model => fetchData(eval(model), searchQueries)));
    const combinedData = modelData.flat();

    // Group entries by name and collect locations, update dates, and images into arrays
    const groupedData = new Map();

    combinedData.forEach(item => {
      const key = item.binomialNomenclature;
      if (groupedData.has(key)) {
        const existingItem = groupedData.get(key);
        existingItem.locations.push(item.location);
        existingItem.updateDates.push(item.updateDate);
        existingItem.images.push(item.image);
      } else {
        groupedData.set(key, {
          name: item.name,
          binomialNomenclature: key,
          kingdom: item.kingdom,
          locations: [item.location],
          updateDates: [item.updateDate],
          images: [item.image]
        });
      }
    });

    // Convert Map back to an array and sort each entry by updateDate keeping association to location & image
    const resultArray = Array.from(groupedData.values());
    resultArray.forEach(group => {
      const zippedData = group.updateDates.map((updateDate, index) => ({
        updateDate,
        location: group.locations[index],
        image: group.images[index]
      }));
      zippedData.sort((a, b) => a.updateDate.localeCompare(b.updateDate));
      group.locations = zippedData.map(item => item.location);
      group.updateDates = zippedData.map(item => item.updateDate);
      group.images = zippedData.map(item => item.image);
    });

    // API source
    console.log(resultArray);

    /*
    // Paginate the grouped data
    const totalRecords = resultArray.length;
    const totalPages = Math.ceil(totalRecords / pageSize);
    const page = parseInt(req.query.page) || 1;
    const skipSize = pageSize * (page - 1);
    const paginatedData = resultArray.slice(skipSize, skipSize + pageSize);
    */

    // Ensure we have a valid user ID
    const userId = req.user ? req.user._id.toString() : null;

    // Check for matching user IDs and prepare the heart emoticon display
    resultArray.forEach(group => {
      group.showSightedLogo = group.images.some(image => {
        const userIdFromImage = image.split('_').pop().split('.')[0]; // Get the user ID from the image filename
        return userId === userIdFromImage; // Compare with logged-in user ID
      });
    });

    // Render the dataViewer page with the paginated data for full page load
    res.render("dataviewer/index", {
      title: "Data Viewer",
      user: req.user,
      dataset: resultArray,
      searchQuery: searchQuery,
      // totalPages: totalPages,
      // currentPage: page,
    });

  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
});

//GET handler for /plants/add (loads page)
router.get("/view", logMiddleware, async (req, res, next) => {
  try {
    const speciesName = req.query.name; // Get the name from the query parameter

    if (!speciesName) {
      return res.status(400).send("No species name provided.");
    }

    // Wrap speciesName in an array for fetchData
    const modelData = await Promise.all(MODEL_NAMES.map(model => fetchData(eval(model), [speciesName])));

    // Combine data from different models into a single array
    const combinedData = modelData.flat();

    // Group entries by name and collect locations, update dates, and images into arrays
    const groupedData = combinedData.reduce((acc, item) => {
      const existingItem = acc.find((groupedItem) => groupedItem.binomialNomenclature === item.binomialNomenclature);
      //grouped by binomialNomenclature because it doesn't change as often as name

      if (existingItem) {
        existingItem.locations.push(item.location);
        existingItem.updateDates.push(item.updateDate);
        existingItem.images.push(item.image);
      } else {
        acc.push({
          name: item.name,
          binomialNomenclature: item.binomialNomenclature,
          kingdom: item.kingdom,
          locations: [item.location],
          updateDates: [item.updateDate],
          images: [item.image]
        });
      }
      return acc;
    }, []);

    // Sort each named entry by updateDate keeping association to location & image
    groupedData.forEach((group) => {
      const zippedData = group.updateDates.map((updateDate, index) => ({
        updateDate,
        location: group.locations[index],
        image: group.images[index]
      }));
      zippedData.sort((a, b) => a.updateDate.localeCompare(b.updateDate));
      group.locations = zippedData.map((item) => item.location);
      group.updateDates = zippedData.map((item) => item.updateDate);
      group.images = zippedData.map((item) => item.image);
    });

    // Render the details page with the species data
    res.render("dataviewer/view", {
      user: req.user,
      title: "Species Details",
      speciesData: groupedData // Pass the fetched data to the view
    });
    
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
});  

// POST handler for analyzing data
router.post("/analyze", async (req, res) => {
  const { binomialNomenclatures, updateDates, locations } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: `Analyze the location data ${locations} for each respective ${binomialNomenclatures}. 
          Compare each species location distributions by associating higher density areas around known geological and soil data, then
          hypothesize mathematical and scientific insights like why a species is more prevelant at a certain location and time.`

        /*Analyze the location data ${locations} and the time period data ${updateDates} for each respective ${binomialNomenclatures}. 
        Return 5 listed coordinates and their associated landformations.
        Return 5 listed updateDates and their possible reason for occurence at this time.*/
        }
      ]
    });

    res.json(response.choices[0].message.content);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error analyzing data");
  }
});

module.exports = router;