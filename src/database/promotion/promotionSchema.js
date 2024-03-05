const mongoose = require("mongoose");

const PromotionSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  fromDate: {
    type: Date,
    required: true,
  },
  toDate: {
    type: Date,
    required: true,
  },
  products: [
    {
      productId: {
        type: mongoose.Types.ObjectId,
        ref: "Product",
      },
      discount: Number,
      position: Number,
    },
  ],
});

const Promotion = mongoose.model("Promotion", PromotionSchema);

module.exports = Promotion;
