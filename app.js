//1. EXPRESS
require("dotenv").config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');
const fs = require('fs');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var app = express();
const os = require('os'); 
const fileUpload = require('express-fileupload');

// view engine setup - Serve static files from the 'public' directory
app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Log the server running message
const port = 3001;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

//2. DATABASE MongoDB CONNECTIONS
// Option 2) Add connection string to Config file
//const config = require("./config/globals");
//let connectionString = config.db;
const db_config = process.env.DB_STRING;
let connectionString = db_config;
var mongoose = require("mongoose");
//Configure mongoose (initial database connection)
mongoose
  .connect(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((message) => {
    console.log("Connected successfully!");
  }) //do something after connecting
  .catch((error) => {
    console.log(`Error while connecting! ${error}`);
  }); //catch any errors

//3. AUTHENTICATION
var passport = require("passport");
var session = require("express-session");
const githubStrategy = require("passport-github2").Strategy;
var User = require("./models/user"); 

//Configure session handling
app.use(
  session({
    secret: "speciesTracker",
    resave: false,
    saveUninitialized: false,
  })
);
//Configure passport module
app.use(passport.initialize());
app.use(passport.session());
//Configure local strategy method
passport.use(User.createStrategy()); 
// Configure passport-github2 with the API keys and user model
passport.use(
  new githubStrategy(
    {
      //clientID: config.github.clientId,
      //clientSecret: config.github.clientSecret,
      //callbackURL: config.github.callbackUrl,
      clientID: process.env.GITHUB_CLIENTID,
      clientSecret: process.env.GITHUB_CLIENTSECRET,
      callbackURL: process.env.GITHUB_CALLBACKURL,
    },
    async (accessToken, refreshToken, profile, done) => {
      const user = await User.findOne({ oauthId: profile.id });
      if (user) {
        return done(null, user);
      } else {
        const newUser = new User({
          username: profile.username,
          oauthId: profile.id,
          oauthProvider: "Github",
          created: Date.now(),
        });
        // add to DB
        const savedUser = await newUser.save();
        return done(null, savedUser);
      }
    }
  )
);
//Set passport to write/read user data to/from session object 
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// 4. ROUTER and API ('/', indexRouter)
var indexRouter = require('./routes/index');
var blogsRouter = require('./routes/blogs');
var dataviewerRouter = require('./routes/dataviewer');
var plantsRouter = require("./routes/plants");
var fungiRouter = require("./routes/fungi");
var animalsRouter = require("./routes/animals");
var bacteriaRouter = require("./routes/bacteria");
var protistsRouter = require("./routes/protists");

app.use('/', indexRouter);
app.use('/blogs', blogsRouter);
app.use('/dataviewer', dataviewerRouter);
app.use('/plants', plantsRouter);
app.use("/fungi", fungiRouter);
app.use('/animals', animalsRouter);
app.use("/bacteria", bacteriaRouter);
app.use("/protists", protistsRouter);

//IDENTIFICATION
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
// Configure express-fileupload to use a temporary directory
app.use(fileUpload({ useTempFiles: true, tempFileDir: os.tmpdir() }));


//SESSIONS FOR EACH USER
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Save the response object to send messages later
  const clientId = Date.now();
  clients[clientId] = res;
  // Remove client when connection is closed
  req.on('close', () => {
    delete clients[clientId];
  });
});
const clients = {};

//IDENTIFY Mushroom (http://localhost:5000/identify)
app.post('/identifyM', async (req, res) => {
  const apiUrl = `http://127.0.0.1:5000/identify`;
  const formData = new FormData();

  if (!req.files || !req.files.image) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const file = req.files.image;
  const fileStream = fs.createReadStream(file.tempFilePath);
  formData.append('image', fileStream, { filename: file.name });

  try {
    const response = await axios.post(apiUrl, formData);

    if (!response.data.identification) {
      console.error('Identification not found in response data:', response.data);
      return res.status(500).json({ message: 'Identification not found in response data.' });
    }

    const identificationResult = response.data.identification;

    // Function to remove parentheses
    const removeParentheses = (str) => (str || '').replace(/[()\\?]/g, '').trim();

    // Clean the identification result if it's a string
    const cleanedIdentification = typeof identificationResult === 'string' 
      ? removeParentheses(identificationResult) 
      : identificationResult;
    // Send back the cleaned identification to the client
    res.status(response.status).json({ identification: cleanedIdentification });
  } catch (error) {
    console.error('Error:', error);
    res.status(error.response?.status || 500).json({ message: error.message });
  }
});

//IDENTIFY PLANT (PlantNet)
app.post('/identifyP', async (req, res) => {
  const project = 'all?include-related-images=false&no-reject=false&lang=en&type=kt';
  //const apiKey = config.plantNetAPI;
  const apiKey = process.env.PLANTNET_APIKEY;
  const apiUrl = `https://my-api.plantnet.org/v2/identify/${project}&api-key=${apiKey}`;
  // Check if req.files.images[] exists and is not empty
  if (!req.files || !req.files['images[]']) {
      return res.status(400).json({ message: 'No files uploaded.' });
  }

  const uploadedFiles = Array.isArray(req.files['images[]']) ? req.files['images[]'] : [req.files['images[]']];
  const top4MatchesArray = [];

  try {
    // Process each uploaded file
    var count = 0;
    for (const file of uploadedFiles) {

      // Send count to all connected clients (real-time server-client responses without using res)
      for (const client of Object.values(clients)) {
        client.write(`data: ${count}\n\n`);
      }

      const formData = new FormData();
      const fileStream = fs.createReadStream(file.tempFilePath);
      formData.append('images', fileStream, { filename: file.name });

      const response = await axios.post(apiUrl, formData, {
          headers: {
              ...formData.getHeaders(),
          },
      });
      count++; 
      //console.log("Classification: " + count + " complete");
     
      // Extract information about the top "4" matches
      const top4Matches = response.data.results.slice(0, 10);
      top4MatchesArray.push(top4Matches.map(match => ({
          name: removeParentheses(match.species.commonNames[0]),
          scientificName: removeParentheses(match.species.scientificName),
          score: match.score,
      })));
    }

    // Send back detailed information to the client
    res.status(200).json({
        status: 200,
        top4Matches: top4MatchesArray,
    });
  } catch (error) {
      console.error('Error:', error);
      res.status(error.response?.status || 500).json({ message: error.message });
  }
});

// Function to remove parentheses, backslashes, and question marks
const removeParentheses = (str) => (str || '').replace(/[()\\?]/g, '').trim();

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;

/*
//Single image upload (plant)
app.post('/identifyP', async (req, res) => {
  const project = 'all?include-related-images=false&no-reject=false&lang=en&type=kt';
  const apiKey = config.plantNetAPI;
  //  const apiKey = process.env.PLANTNET_APIKEY;
  const apiUrl = `https://my-api.plantnet.org/v2/identify/${project}&api-key=${apiKey}`;
  const formData = new FormData();

  // Check if req.files.image exists and is not null
  if (!req.files || !req.files.image) {
      return res.status(400).json({ message: 'No file uploaded.' });
  }

  // Access the uploaded file  
  const file = req.files.image;
  const fileStream = fs.createReadStream(file.tempFilePath);
  formData.append('images', fileStream, { filename: file.name });

  try {
      const response = await axios.post(apiUrl, formData, {
          headers: {
              ...formData.getHeaders(),
          },
      });

      // Extract information about the top 3 matches
      const top4Matches = response.data.results.slice(0, 4);

      // Function to remove parentheses, backslashes, and question marks
      const removeParentheses = (str) => (str || '').replace(/[()\\?]/g, '').trim();

      // Send back detailed information to the client
      res.status(response.status).json({
          status: response.status,
          top4Matches: top4Matches.map(match => ({
              name: removeParentheses(match.species.commonNames[0]), // Ensure this exists
              scientificName: removeParentheses(match.species.scientificName), // Ensure this exists
              score: match.score
          }))
      });
  } catch (error) {
      console.error('Error:', error);
      res.status(error.response?.status || 500).json({ message: error.message });
  }
});
 */