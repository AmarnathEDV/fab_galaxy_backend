const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Admin = require("../../Database/admin/adminSchema");
const redisClient = require("../../redis/redisInstance");

const Wishlist = require("../../database/wishlist/wishlistSchema");

module.exports.addToWishlist = async (req, res) => {
  try {
    const { productID } = req.query;
    const { id } = req.params;



    let wishlist = await Wishlist.findOne({ customer: id });
    if (!wishlist) {
      const newWishlist = new Wishlist({
        customer: id,
        products: [productID],
      });
      await newWishlist.save();
      return res.status(200).json({ message: "Added to wishlist" });
    } else {
      const index = wishlist.products.indexOf(productID);
      if (index === -1) {
        wishlist.products.push(productID);
        await wishlist.save();
        await wishlist.populate("products");

        wishlist = wishlist.products.map((items) => {
          let sizeDetails = Object.keys(items.sizeDetails);
          return {
            id: items._id,
            title: items.title,
            mrp: items.mrp,
            td: items.td,
            images: items.images,
            fcp: items.fcp,
            sizeList: sizeDetails,
          };
        });
        return res.status(200).json({ message: "Added to wishlist" ,load : wishlist});
      } else {
        return res.status(404).json({ message: "Already in wishlist" });
      }
    }
  } catch (err) {

    res.status(500).json({ error: err });
  }
};

module.exports.getWishList = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentList } = req.query;
    let wishlist = await Wishlist.findOne({ customer: id });

    if (!wishlist) {
      const newWishlist = new Wishlist({
        customer: id,
        products: currentList,
      });
      (await newWishlist.save()).populate("products");
      wishlist = wishlist && wishlist.products.map((items) => {
        let sizeDetails = Object.keys(items.sizeDetails);
        return {
          id: items._id,
          title: items.title,
          mrp: items.mrp,
          td: items.td,
          images: items.images,
          fcp: items.fcp,
          sizeList: sizeDetails,
        };
      });

      return res.status(200).json({ load: newWishlist });
    } else {
      // Check if products in curentList are not in the wishlist and add them
      const productsToAdd = currentList?.filter(
        (productID) => !wishlist.products.includes(productID)
      );

      if (productsToAdd?.length > 0) {
        wishlist.products = wishlist.products.concat(productsToAdd);
        await wishlist.save().populate("products");

        wishlist = wishlist.products.map((items) => {
          let sizeDetails = Object.keys(items.sizeDetails);
          return {
            id: items._id,
            title: items.title,
            mrp: items.mrp,
            td: items.td,
            images: items.images,
            fcp: items.fcp,
            sizeList: sizeDetails,
          };
        });

        return res.status(200).json({
          message: "Products added to wishlist",
          load: wishlist,
        });
      } else {
        await wishlist.populate("products");

        wishlist = wishlist.products.map((items) => {
          let sizeDetails = Object.keys(items.sizeDetails);
          return {
            id: items._id,
            title: items.title,
            mrp: items.mrp,
            td: items.td,
            images: items.images,
            fcp: items.fcp,
            sizeList: sizeDetails,
          };
        });

        return res.status(200).json({
          message: "Wishlist is up to date",
          load: wishlist,
        });
      }
    }
  } catch (err) {

    res.status(500).json({ error: err });
  }
};

module.exports.removeFromWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const { productIds } = req.body; // Assuming productIds is an array of product IDs

    // Find the wishlist for the given customer ID
    const wishlist = await Wishlist.findOne({ customer: id });

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    await Wishlist.updateOne(
      { customer: id },
      { $pullAll: { products: productIds } }
    );

    return res
      .status(200)
      .json({ message: "Product(s) removed from wishlist" });
  } catch (err) {

    res.status(500).json({ error: err });
  }
};
