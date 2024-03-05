const mongoose = require("mongoose");

const DraftSchema = new mongoose.Schema(
  {
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    sku: String,
    weight: String,
    hsn: String,
    gst: String,
    fcp: String,
    td: String,
    mrp: String,
    subCategory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubCategory",
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MainCategory",
    },
    video: {
      type: String,
    },
    productDetails: [
      {
        name: String,
        value: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Value",
        },
      },
    ],
    sizeDetails: {},
    images: [],
    otherDetails: [
      {
        name: String,
        value: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Value",
        },
      },
    ],
    otherDetails: [
      {
        name: String,
        value: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Value",
        },
      },
    ],
    companyDetails: {},
    colorDetails: [
      {
        name: String,
        value: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Color",
        },
      },
    ],
    colorFamily: [
      {
        label: String,
        value: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Color",
        },
      },
    ],
    seoData: {
      title: String,
      description: String,
      metaTags: [{ name: String, content: String }],
    },
    ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    status: Boolean,
    draft: Boolean,
    metaData: {},
    uniqueId: Number,
  },
  { timestamps: true }
);

const Draft = mongoose.model("Draft", DraftSchema);

module.exports = Draft;
