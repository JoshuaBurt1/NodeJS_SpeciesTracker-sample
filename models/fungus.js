// Import mongoose
const mongoose = require("mongoose");

// Create schema definition object using mapping notation; //note: naming convention > models are singular, routers are plural
const fungiSchemaObj = {
  // add each element and its properties
  // note: changing updateDate type to String = 2010-10-10 format)
  kingdom: { type: String, required: true, default: "fungi" },
  name: { type: String, required: true },
  binomialNomenclature: { type: String, required: true },
  updateDate: { type: String, required: true },
  location: { type: String, required: true},
  image: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, //this is used for user profile "stickers/rewards" & removeFlag if userVeracity # < than threshold
  dateChanged: { type: Number, required: false }, //array to keep track of edits (data integrity metric, user veracity metric), if null: higher data integrity & user veracity 
  locationChanged: { type: Number, required: false }, //array to keep track of edits (data integrity metric, user veracity metric), if null: higher data integrity & user veracity
  //note: exif metadata (date and location) of the image is not changed, it is only the shown data in mongoDB, the table, and csv.
  nameChanged: [{ //array of dictionary entries to keep track of edits (species metric), if not 0 => ++ due to poor picture, new species, image identifier updated)
    name: { type: String, required: false }, // The new name 
    changeCount: { type: Number, required: false, default: 0 } // Count starting at 0;
  }],
  //Use case - User edits name (this should be from a given larger list compared to top 4 in add) => (user veracity/expertise metric)
  removalFlag: { type: Number, required: false, default: 0}, //If 0 : valid object; if 1 : invalid object (not shown in dataviewer) as A. user (userId) with veracity value < threshold OR B. image found to be a duplicate of another user submission OR C. AI generated image OR D. Augmented image with added effects E. Inappropriate/illegal content (scanner to recognize this)
  userImageRating: { type: Number, required: false, default: 1}, //a range of 1 to 10 based on user likes (this MUST have no effect on contributionPoints, as it can be an incentive to be manipulated)
  imageQuality: { type: Number, required: false, default: 1}, //a range of 1 to 10 based on a computer based image scanning tool (sharpness, contrast)
  rarity: {type: Number, required: false, default: 1}, //based on total number of classifications (total all/total this); new species added = round(10000/1) (higher score); common species = round(10000/100) (lower score)
  difficulty: {type: Number, required: false, default: 2}, //difficulty to obtain image (virus:6>bacteria:5>protist:4>animal:3>mushroom:2>plant:1)
  //magnification: {type: Number, required: true, default: 1}, //there needs to be a trained computer based image scanner that can determine magnification; 1 = meter
};

// Create new mongoose schema using the definition object
var fungiSchema = new mongoose.Schema(fungiSchemaObj);

// Create new mongoose model using the schema object and
// Import new model > provide name and schema
module.exports = mongoose.model("Fungus", fungiSchema);

// alternative > module.exports = mongoose.model('Plant', plantsSchema);

//note: naming convention > models are singular, routers are plural
