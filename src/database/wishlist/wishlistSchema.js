const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Types.ObjectId,
    ref: "User",
  },
  products: [
    {
      type: mongoose.Types.ObjectId,
      ref: "Product",
    },
  ],
});

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
module.exports = Wishlist;
