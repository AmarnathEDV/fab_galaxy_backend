const mongoose = require("mongoose");

const colorSchema = new mongoose.Schema({
  value: String,
  colorCode : String
});

const Color = mongoose.model("Color", colorSchema);

module.exports = Color;