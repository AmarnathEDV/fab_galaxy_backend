const mongoose = require("mongoose");

const valueSchema = new mongoose.Schema({
  value: String,
});

const Value = mongoose.model("Value", valueSchema);

module.exports = Value;