const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
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
    rating: [
      {
        rating: Number,
        review: String,
      },
    ],
    views: [{ sessionId: String }],
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
