  // Import mongoose
  const mongoose = require("mongoose");

  const replySchema = new mongoose.Schema(
    {
      content: { type: String, required: true },
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    },
    {
      timestamps: true,
    }
  );

  const blogSchemaObj = new mongoose.Schema(
    {
      topic: { type: String, required: true },  
      title: { type: String, required: true },
      content: { type: String },
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      views: { type: Number, default: 0 },
      uniqueUserViews: { type: Number, default: 0 }, // Add uniqueUserViews field with a default value of 0
      replies: [replySchema],
    },
    {
      timestamps: true,
    }
  );

  // Create new mongoose schema using the definition object
  const blogSchema = new mongoose.Schema(blogSchemaObj);


  // Create new mongoose model using the schema object
  module.exports = mongoose.model("Blog", blogSchema);