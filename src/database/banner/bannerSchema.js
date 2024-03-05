const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema({
  ref: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "Admin",
  },
  imageSM: String,
  imageLG: String,
  url: String,
  name: String,
});

const Banner = mongoose.model("Banner", bannerSchema);

module.exports = Banner;
