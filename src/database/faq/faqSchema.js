const mongoose = require("mongoose");

const FAQSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    position: Number,
  },
  { timestamps: true }
);

const FAQ = mongoose.model("FAQ", FAQSchema);

module.exports = FAQ;
