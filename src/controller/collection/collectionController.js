const Collection = require("../../database/collections/collectionSchema");
const Product = require("../../database/product/productSchema");
const redisClient = require("../../redis/redisInstance");

module.exports.createCollection = async (req, res) => {
  try {
    const collection = new Collection({
      name: req.body.name,
      products: [],
    });
    await collection.save();
    res.send(collection._id);
  } catch (err) {
    if (err.code === 11000) {
      res
        .status(400)
        .send(`Collection with name '${req.body.name}' already exists`);
    } else {

      res.status(500).send("Error creating collection");
    }
  }
};

module.exports.addProductToCollection = async (req, res) => {
  try {
    const collection = await Collection.findById(req.query.id);
    if (!collection) {
      return res.status(404).send("Collection not found");
    }

    const cacheKeys = await redisClient.keys("all_products_*");

    if (cacheKeys.length > 0) {
      await redisClient.del(cacheKeys);
    }

    const { products } = req.body;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      // Check if the product already exists in the collection
      const existingProduct = collection.products.find(
        (p) => p.productId.toString() === product._id
      );
      if (existingProduct) {
        continue; // Skip adding existing product
      }

      // Find the last product's position
      let lastPosition = 0;
      if (collection.products.length > 0) {
        lastPosition =
          collection.products[collection.products.length - 1].position;
      }

      // Add the new product with its position
      collection.products.push({
        productId: product._id,
        position: lastPosition + 1,
      });
    }

   

    await collection.save();
    res.send(collection);
  } catch (err) {

    res.status(500).send("Error adding products to collection");
  }
};

module.exports.updatePostionCollection = async (req, res) => {
  try {
    const collection = await Collection.findOne({
      _id: req.query.collectionId,
      "products.productId": req.query.productId,
    });
    
    const cacheKeys = await redisClient.keys("all_products_*");

    if (cacheKeys.length > 0) {
      await redisClient.del(cacheKeys);
    }
    if (!collection) {
      return res.status(404).send("Collection or product not found");
    }
    const product = collection.products.find(
      (p) => p.productId.toString() === req.query.productId
    );
    const oldPosition = product.position;
    const newPosition = parseInt(req.query.position); // Parse position as integer
    product.position = newPosition;
    
    // Update positions of other products
    for (const p of collection.products) {
      if (p.productId.toString() !== req.query.productId) {
        if (oldPosition < newPosition && p.position <= newPosition && p.position > oldPosition) {
          p.position--; // Shift down
        } else if (oldPosition > newPosition && p.position >= newPosition && p.position < oldPosition) {
          p.position++; // Shift up
        }
      }
    }
    
    await collection.save();
    res.send(collection);
  } catch (err) {
  
    res.status(500).send("Error updating product position");
  }
};


module.exports.getAllCollections = async (req, res) => {
  try {
    const collections = await Collection.find()
    .populate({
      path :"products.productId",
      populate : {path : "productDetails.value", model: "Value"}
    }).populate({
      path :"products.productId",
      populate : {path : "otherDetails.value", model: "Value"}
    })
    .populate({
      path :"products.productId",
      populate : {path : "colorDetails.value", model: "Color"}
    })
    .populate({
      path :"products.productId",
      populate : {path : "colorFamily.value", model: "Color"}
    })
    .populate({
      path :"products.productId",
      populate : {path : "subCategory", model: "SubCategory" , populate : {path : "category" , model : "MainCategory"}}
    })
      .sort({ "products.position": 1 });
    collections.forEach((collection) => {
      collection.products.sort((a, b) => a.position - b.position); // Sort products array within each collection
    });
    res.send(collections);
  } catch (err) {
  
    res.status(500).send("Error fetching collections");
  }
};

module.exports.getCollectionDetails = getAllCollections = async (req, res) => {
  try {
    const collections = await Collection.findOne({ _id: req.query.id })
      .populate("products.productId")
      .sort({ "products.position": 1 });

    collections.products.sort((a, b) => a.position - b.position); // Sort products array within each collection

    res.send({ load: collections });
  } catch (err) {
  
    res.status(500).send("Error fetching collections");
  }
};

module.exports.deleteProductFromCollection = async (req, res) => {
  try {
    const collectionId = req.query.collectionId;
    const productId = req.query.productId;

    // Find the collection
    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).send("Collection not found");
    }

    // Find the index of the product to delete
    const productIndex = collection.products.findIndex(
      (p) => p.productId.toString() === productId
    );
    if (productIndex === -1) {
      return res.status(404).send("Product not found in the collection");
    }

    // Check if the product object exists
    const product = collection.products[productIndex];
    if (!product) {
      return res.status(404).send("Product object not found in the collection");
    }

    // Delete the product from the collection
    collection.products.splice(productIndex, 1);

    // Update positions of other products
    const deletedProductPosition = product.position;
    collection.products.forEach((product) => {
      if (product.position > deletedProductPosition) {
        product.position--; // Shift positions down
      }
    });

    // Save the updated collection
    await collection.save();

    res.send(collection);
  } catch (err) {
  
    res.status(500).send("Error deleting product from collection");
  }
};


