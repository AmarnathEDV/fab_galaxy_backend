const mongoose = require("mongoose");

const RatingSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Types.ObjectId,
    ref: "Order",
  },
  subOrderId: String,
  productId: {
    type: mongoose.Types.ObjectId,
    ref: "Product",
  },
  rating : Number,
  review : String,
});

const Rating = mongoose.model("Rating", RatingSchema);

module.exports = Rating;
