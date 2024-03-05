const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const subcategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MainCategory",
    },
    homeBanner: String,

    image: {
      type: String,
    },
    banner: {
      type: String,
    },
    video: {
      type: String,
    },
    isListed: Boolean,
    isSubListed: Boolean,
    isHomeListed: Boolean,
    productDetails: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Attribute",
      },
    ],
    sizeDetails: [],
    otherDetails: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Attribute",
      },
    ],
    colorDetails: [
      {
        name: String,
        value: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ColorAttribute",
        },
      },
    ],
    shortName: String,
    vksu: String,
    views: [{ sessionId: String }],
  },
  { timestamps: true }
);

const SubCategory = mongoose.model("SubCategory", subcategorySchema);

module.exports = SubCategory;
