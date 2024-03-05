const mongoose = require("mongoose");

const collectionSchema = new mongoose.Schema({
    name: {type : String, unique : true},
    products: [
      {
        productId: {
          type: mongoose.Types.ObjectId,
          ref: "Product",
        },
        position : Number,
      },
    ],
  },{timestamps : true});
  

const Collection = mongoose.model("Collection", collectionSchema);

module.exports = Collection;
