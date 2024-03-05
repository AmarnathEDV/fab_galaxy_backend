const Product = require("../../database/product/productSchema");
const Promotion = require("../../database/promotion/promotionSchema");
const redisClient = require("../../redis/redisInstance");

module.exports.createPromotion = async (req, res) => {
  try {
    const promotion = new Promotion({
      name: req.body.name,
      products: [],
      fromDate: req.body.fromDate,
      toDate: req.body.toDate,
    });
    await promotion.save();
    res.send(promotion._id);
  } catch (err) {
    if (err.code === 11000) {
      res
        .status(400)
        .send(`Promotion with name '${req.body.name}' already exists`);
    } else {
      
      res.status(500).send("Error creating Promotion");
    }
  }
};

module.exports.addProductToPromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.query.id);
    if (!promotion) {
      return res.status(404).send("Promotion not found");
    }

    const cacheKeys = await redisClient.keys("all_products_*");

    if (cacheKeys.length > 0) {
      await redisClient.del(cacheKeys);
    }

    const { products } = req.body;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      // Check if the product already exists in the Promotion
      const existingProduct = promotion.products.find(
        (p) => p.productId.toString() === product._id
      );
      if (existingProduct) {
        continue; // Skip adding existing product
      }

      let lastPosition = 0;
      if (promotion.products.length > 0) {
        lastPosition =
          promotion.products[promotion.products.length - 1].position;
      }

      promotion.products.push({
        productId: product._id,
        discount: product.discount,
        position: lastPosition + 1,
      });
    }



    await promotion.save();
    res.send(promotion);
  } catch (err) {
    
    res.status(500).send("Error adding products to Promotion");
  }
};

module.exports.updatePostionPromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findOne({
      _id: req.query.promotionId,
      "products.productId": req.query.productId,
    });

    const cacheKeys = await redisClient.keys("all_products_*");

    if (cacheKeys.length > 0) {
      await redisClient.del(cacheKeys);
    }
    if (!promotion) {
      return res.status(404).send("Promotion or product not found");
    }
    const product = promotion.products.find(
      (p) => p.productId.toString() === req.query.productId
    );
    const oldPosition = product.position;
    const newPosition = parseInt(req.query.position); // Parse position as integer
    product.position = newPosition;

    // Update positions of other products
    for (const p of promotion.products) {
      if (p.productId.toString() !== req.query.productId) {
        if (
          oldPosition < newPosition &&
          p.position <= newPosition &&
          p.position > oldPosition
        ) {
          p.position--; // Shift down
        } else if (
          oldPosition > newPosition &&
          p.position >= newPosition &&
          p.position < oldPosition
        ) {
          p.position++; // Shift up
        }
      }
    }

    await promotion.save();
    res.send(Promotion);
  } catch (err) {
    
    res.status(500).send("Error updating product position");
  }
};

// module.exports.getAllPromotions = async (req, res) => {
//   try {
//     const promotions = await Promotion.find()
//       .populate({
//         path: "products.productId",
//         populate: { path: "productDetails.value", model: "Value" },
//       })
//       .populate({
//         path: "products.productId",
//         populate: { path: "otherDetails.value", model: "Value" },
//       })
//       .populate({
//         path: "products.productId",
//         populate: { path: "colorDetails.value", model: "Color" },
//       })
//       .populate({
//         path: "products.productId",
//         populate: { path: "colorFamily.value", model: "Color" },
//       })
//       .populate({
//         path: "products.productId",
//         populate: {
//           path: "subCategory",
//           model: "SubCategory",
//           populate: { path: "category", model: "MainCategory" },
//         },
//       })
//       .sort({ "products.position": 1 });
//     promotions.forEach((promotion) => {
//       promotion.products.sort((a, b) => a.position - b.position); // Sort products array within each Promotion
//     });
//     res.send(promotions);
//   } catch (err) {
//     
//     res.status(500).send("Error fetching Promotions");
//   }
// };

module.exports.getAllPromotions = async (req, res) => {
  try {
    let promotions = await Promotion.find();

    promotions = await promotions.map((items) => ({
      name: items.name,
      fromDate: items.fromDate,
      toDate: items.toDate,
      products : items.products,
      id: items._id,
      _id : items
    }));

    res.send({load : promotions, type : "promotions"});
  } catch (err) {
    
    res.status(500).send("Error fetching Promotions");
  }
};

module.exports.getPromotionDetails = getAllPromotions = async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ _id: req.query.id })
      .populate("products.productId")
      .sort({ "products.position": 1 });

    promotion.products.sort((a, b) => a.position - b.position); // Sort products array within each Promotion

    res.send({ load: promotion });
  } catch (err) {
    
    res.status(500).send("Error fetching Promotions");
  }
};


module.exports.deletePromotion = async (req, res) => {
  try {
    const  promotion = await Promotion.findByIdAndDelete(req.query.id)
    if(promotion ){
      res.send(promotion)
    }
  } catch (error) {
    
    res.status(500).json({error : error.message});
  }
}

module.exports.removeProductFromPromotion = async (req, res) => {
  try {
    const { promotionId, productId } = req.query;

    // Find the promotion
    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      return res.status(404).send("Promotion not found");
    }

    // Find the index of the product in the promotion
    const index = promotion.products.findIndex(p => p.productId.toString() === productId);
    if (index === -1) {
      return res.status(404).send("Product not found in the promotion");
    }

    // Remove the product from the promotion
    promotion.products.splice(index, 1);

    // Update positions of other products
    promotion.products.forEach((product, i) => {
      product.position = i + 1;
    });

    // Save the updated promotion
    await promotion.save();

    res.send(promotion);
  } catch (err) {
    
    res.status(500).send("Error removing product from promotion");
  }
};

module.exports.updateProductDiscount = async (req, res) => {
  try {
    const { promotionId, productId, discount } = req.query;

    // Find the promotion
    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      return res.status(404).send("Promotion not found");
    }

    // Find the product in the promotion
    const product = promotion.products.find(p => p.productId.toString() === productId);
    if (!product) {
      return res.status(404).send("Product not found in the promotion");
    }

    // Update the discount of the product
    product.discount = discount;
    
    // Save the updated promotion
    await promotion.save();

    res.send(promotion);
  } catch (err) {
    
    res.status(500).send("Error updating product discount in promotion");
  }
};