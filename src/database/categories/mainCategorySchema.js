const mongoose = require("mongoose");

const mainCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    image: {
      type: String,
    },
    banner: {
      type: String,
    },
    video: {
      type: String,
    },
    isListed :Boolean,
    subcategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubCategory",
      },
    ],
    companyDetails: {},
    views: [{ sessionId: String }],
  },
  { timestamps: true }
);

const MainCategory = mongoose.model("MainCategory", mainCategorySchema);

module.exports = MainCategory;
