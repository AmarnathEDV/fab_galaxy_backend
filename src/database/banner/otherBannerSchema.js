const mongoose = require("mongoose");

const otherBannerSchema = new mongoose.Schema({
  ref: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "Admin",
  },
  imageSM: String,
  imageLG: String,
  url: String,
  name: String,
  isActive: Boolean,
});

const OtherBanner = mongoose.model("OtherBanner", otherBannerSchema);

module.exports = OtherBanner;
