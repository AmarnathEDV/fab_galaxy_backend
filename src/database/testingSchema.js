const mongoose = require("mongoose");

const TestSchema = new mongoose.Schema(
  {
    value: {},
  },
  { timestamps: true }
);

const Test = mongoose.model("Test", TestSchema);

module.exports = Test;
