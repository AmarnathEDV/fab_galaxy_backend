const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "User",
  },
  products: [
    {
      productId: {
        type: mongoose.Types.ObjectId,

        ref: "Product",
      },
      quantity: {
        type: Number,

        default: 1,
      },
      size: String,
      vsku: String,
      selected: { type: Boolean, default: true },
      date: { type: Date, default: Date.now() },
    },
  ],
});

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;
