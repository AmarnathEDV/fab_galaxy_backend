const mongoose = require("mongoose");

const OccasionSchema = new mongoose.Schema({
  data: [
    {
      id: Number,
      name: {
        type: mongoose.Types.ObjectId,
        ref: "Value",
      },
      image: String,
    },
  ],
});

const Occasion = mongoose.model("Occasion", OccasionSchema);
module.exports = Occasion;
