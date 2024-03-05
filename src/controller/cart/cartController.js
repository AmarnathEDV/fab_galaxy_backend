const Cart = require("../../database/cart/cartSchema");
const Product = require("../../database/product/productSchema");
const Wishlist = require("../../database/wishlist/wishlistSchema");

const isQuantityValid = (sizeDetails, requestedQuantity) => {
  // Assuming 'STOCK' is the key for available stock in sizeDetails
  const stock = parseInt(sizeDetails.STOCK, 10) || 0;
  return requestedQuantity <= stock;
};

// Function to get sizeDetails based on productId and size
const getProductSizeDetails = async (productId, size) => {
  try {
    const product = await Product.findById(productId);
    return product ? product.sizeDetails[size] : null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const getMaxAvailableQuantity = (sizeDetails) => {
  // Assuming 'STOCK' is the key for available stock in sizeDetails
  const stock = (sizeDetails && parseInt(sizeDetails.STOCK, 10)) || 0;
  return stock;
};

const generateVSKU = async (productId) => {
  const product = await Product.findOne({ _id: productId })
    .populate("subCategory")
    .populate("category");
  return product.subCategory[0].vksu + "." + product.sku.split(".")[1];
};

module.exports.addToCart = async (req, res) => {
  try {
    const { products } = req.body; // Array of objects with productIds and sizes
    const { id } = req.params;



    const cart = await Cart.findOne({ customer: id });

    if (!cart) {
      const newCart = new Cart({
        customer: id,
        products: products.map(async ({ productId, size, vsku }) => ({
          productId,
          size,
          quantity: 1,
          vsku: vsku ? vsku : await generateVSKU(productId),
        })),
      });
      await newCart.save();
      return res.status(200).json({ message: "Added to cart" });
    } else {
      for (const { productId, size, vsku } of products) {
        const productIndex = cart.products.findIndex(
          (item) =>
            item.productId.toString() === productId && item.size === size
        );

        if (productIndex === -1) {
          const sizeDetails = await getProductSizeDetails(productId, size);

          // Check if the requested quantity is within the available stock
          const maxAvailableQuantity = getMaxAvailableQuantity(sizeDetails);
          if (!isQuantityValid(sizeDetails, 1)) {
            return res.status(400).json({
              message: "Quantity exceeds available stock",
              maxQuantity: maxAvailableQuantity,
            });
          }

          cart.products.push({
            productId,
            size,
            quantity: 1,
            vsku: vsku ? vsku : generateVSKU(productId),
            selected: true,
          });
        } else {
          const sizeDetails = await getProductSizeDetails(productId, size);

          // Check if the requested quantity is within the available stock
          const maxAvailableQuantity = getMaxAvailableQuantity(sizeDetails);
          if (
            !isQuantityValid(
              sizeDetails,
              cart.products[productIndex].quantity + 1
            )
          ) {
            return res.status(400).json({
              message: "Quantity exceeds available stock",
              maxQuantity: maxAvailableQuantity,
            });
          }

          cart.products[productIndex].quantity += 1;
        }
      }

      await cart.save();
      return res.status(200).json({ message: "Added to cart" });
    }
  } catch (err) {

    res.status(500).json({ error: err });
  }
};

// ...

module.exports.getCart = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentCart } = req.body;

    let cart = await Cart.findOne({ customer: id });

    if (!cart) {
      const newCart = new Cart({ customer: id, products: [] });
      await newCart.save();
      cart = newCart;
    }

    if (currentCart && currentCart.length > 0) {
      for (const item of currentCart) {
        const existingProduct = cart.products.find(
          (existingItem) =>
            existingItem.productId.toString() === item.productId &&
            existingItem.size === item.size
        );

        if (existingProduct) {
          const sizeDetails = await getProductSizeDetails(
            item.productId,
            item.size
          );
          const maxAvailableQuantity = getMaxAvailableQuantity(sizeDetails);
          const requestedQuantity = item.quantity || 1;
          existingProduct.quantity = Math.min(
            requestedQuantity,
            maxAvailableQuantity
          );
          existingProduct.vsku = item.vsku; // Add vsku here

          // Remove the product if the available quantity is zero
          if (existingProduct.quantity === 0) {
            cart.products = cart.products.filter(
              (prod) =>
                prod.productId.toString() !==
                  existingProduct.productId.toString() ||
                prod.size !== existingProduct.size
            );
          }
        } else {
          const sizeDetails = await getProductSizeDetails(
            item.productId,
            item.size
          );
          const maxAvailableQuantity = getMaxAvailableQuantity(sizeDetails);
          const requestedQuantity = item.quantity || 1;
          const quantityToAdd = Math.min(
            requestedQuantity,
            maxAvailableQuantity
          );
          if (quantityToAdd > 0) {
            cart.products.push({
              productId: item.productId,
              size: item.size,
              quantity: quantityToAdd,
              vsku: item.vsku ? item.vsku : await generateVSKU(item.productId), // Add vsku here
              selected: item.selected,
            });
          }
        }
      }

      await cart.save(); // Save cart after updating vsku
    }

    await cart.populate("products.productId");

    const cartProducts =
      cart && cart.products.length > 0
        ? cart.products.map((items) => {
            let sizeDetails = Object.keys(items.productId.sizeDetails);
            return {
              id: items.productId._id,
              title: items.productId.title,
              mrp: items.productId.mrp,
              td: items.productId.td,
              images: items.productId.images,
              fcp: items.productId.fcp,
              sizeList: sizeDetails,
              quantity: items.quantity,
              size: items.size,
              vsku: items.vsku,
              selected: items.selected,
            };
          })
        : [];



    return res.status(200).json({ load: cartProducts });
  } catch (err) {

    res.status(500).json({ error: err });
  }
};

// ...

module.exports.removeFromCart = async (req, res) => {
  try {
    const { id } = req.params;
    const { products } = req.body; // Array of objects with productIds and sizes

    const cart = await Cart.findOne({ customer: id });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    for (const { productId, size } of products) {
      const productIndex = cart.products.findIndex(
        (item) => item.productId.toString() === productId && item.size === size
      );

      if (productIndex !== -1) {
        const sizeDetails = await getProductSizeDetails(productId, size);

        // Check if the requested quantity is within the available stock
        const maxAvailableQuantity = await getMaxAvailableQuantity(sizeDetails);
        if (!isQuantityValid(sizeDetails, quantity)) {
          return res.status(400).json({
            message: "Quantity exceeds available stock",
            maxQuantity: maxAvailableQuantity,
          });
        }

        cart.products[productIndex].quantity -= 1;
        if (cart.products[productIndex].quantity <= 0) {
          cart.products.splice(productIndex, 1);
        }
      }
    }

    await cart.save();

    return res.status(200).json({ message: "Product(s) removed from cart" });
  } catch (err) {

    res.status(500).json({ error: err });
  }
};

// ...

module.exports.updateQuantityInCart = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, size, quantity, vsku } = req.body;

    const cart = await Cart.findOne({ customer: id });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const productIndex = cart.products.findIndex(
      (item) => item.productId.toString() === productId && item.size === size
    );

    if (productIndex !== -1) {
      const sizeDetails = await getProductSizeDetails(productId, size);

      // Check if the requested quantity is a positive integer
      const requestedQuantity = parseInt(quantity, 10);
      if (isNaN(requestedQuantity) || requestedQuantity < 0) {
        return res.status(400).json({ message: "Invalid quantity" });
      }

      // Check if the requested quantity is within the available stock
      const maxAvailableQuantity = getMaxAvailableQuantity(sizeDetails);
      if (!isQuantityValid(sizeDetails, requestedQuantity)) {
  
        return res.status(400).json({
          message: "Quantity exceeds available stock",
          maxQuantity: maxAvailableQuantity,
        });
      }

      cart.products[productIndex].quantity = requestedQuantity;

      if (cart.products[productIndex].quantity <= 0) {
        cart.products.splice(productIndex, 1);
      }

      await cart.save();

      await cart.populate("products.productId");

      const cartProducts =
        cart.products.length > 0
          ? cart.products.map((items) => {
              let sizeDetails = Object.keys(items.productId.sizeDetails);
              return {
                id: items.productId._id,
                title: items.productId.title,
                mrp: items.productId.mrp,
                td: items.productId.td,
                images: items.productId.images,
                fcp: items.productId.fcp,
                sizeList: sizeDetails,
                quantity: items.quantity,
                size: items.size,
                vsku: items.vsku,
                selected: items.selected,
              };
            })
          : [];

      return res
        .status(200)
        .json({ message: "Quantity updated in cart", load: cartProducts });
    } else {
      return res.status(404).json({ message: "Product not found in cart" });
    }
  } catch (err) {

    res.status(500).json({ error: err });
  }
};

// ...

module.exports.moveToCart = async (req, res) => {
  try {
    const { products } = req.body;
    const { id } = req.params;



    const userId = id;
    let cart = await Cart.findOne({ customer: userId });

    if (!cart) {
      cart = new Cart({ customer: userId, products: [] });
      await cart.save();
    }

    for (const product of products) {
      const { productId, size, vsku } = product;
      const sizeDetails = await getProductSizeDetails(productId, size);

      // Check if the requested quantity is within the available stock
      if (!isQuantityValid(sizeDetails, 1)) {
        return res
          .status(400)
          .json({ message: "Quantity exceeds available stock" });
      }

      const existingProductIndex = cart.products.findIndex(
        (existingItem) =>
          existingItem.productId.toString() === productId &&
          existingItem.size === size
      );

      if (existingProductIndex === -1) {
        cart.products.push({
          productId,
          size,
          quantity: 1,
          vsku: vsku ? vsku : await generateVSKU(productId),
        });

        await Wishlist.findOneAndUpdate(
          { customer: userId },
          { $pull: { products: productId } }
        );
      }
    }

    await cart.save();

    await cart.populate("products.productId");

    const cartProducts =
      cart.products.length > 0
        ? cart.products.map((items) => {
            let sizeDetails = Object.keys(items.productId.sizeDetails);
            return {
              id: items.productId._id,
              title: items.productId.title,
              mrp: items.productId.mrp,
              td: items.productId.td,
              images: items.productId.images,
              fcp: items.productId.fcp,
              sizeList: sizeDetails,
              quantity: items.quantity,
              size: items.size,
              vsku: items.vsku,
              selected: items.selected,
            };
          })
        : [];

    return res.status(200).json({
      message: "Products moved from wishlist to cart successfully",
      load: cartProducts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports.updatedSelectedCart = async (req, res) => {
  try {
    const { productId, size, value } = req.body;
    const { id } = req.params;

    const userId = id;
    let cart = await Cart.findOne({ customer: userId });

    if (!cart) {
      cart = new Cart({ customer: userId, products: [] });
      await cart.save();
    }

    if (productId === "all") {
      cart.products.forEach((item) => {
        item.selected = value;
      });
      await cart.save();

      const newCart = await Cart.findOne({ customer: userId }).populate("products.productId");

      const cartProducts =
        newCart.products.length > 0
          ? newCart.products.map((items) => {
              let sizeDetails = Object.keys(items.productId.sizeDetails);
              return {
                id: items.productId._id,
                title: items.productId.title,
                mrp: items.productId.mrp,
                td: items.productId.td,
                images: items.productId.images,
                fcp: items.productId.fcp,
                sizeList: sizeDetails,
                quantity: items.quantity,
                size: items.size,
                vsku: items.vsku,
                selected: items.selected,
              };
            })
          : [];

      return res.status(200).json({
        message: "All products have been selected",
        load: cartProducts,
      });
    }

    const existingProductIndex = cart.products.findIndex(
      (existingItem) =>
        existingItem.productId.toString() === productId &&
        existingItem.size === size
    );

    cart.products[existingProductIndex].selected = value;

    await cart.save();

    await cart.populate("products.productId");

    const newCart = await Cart.findOne({ customer: userId }).populate("products.productId");

    const cartProducts =
      newCart.products.length > 0
        ? newCart.products.map((items) => {
            let sizeDetails = Object.keys(items.productId.sizeDetails);
            return {
              id: items.productId._id,
              title: items.productId.title,
              mrp: items.productId.mrp,
              td: items.productId.td,
              images: items.productId.images,
              fcp: items.productId.fcp,
              sizeList: sizeDetails,
              quantity: items.quantity,
              size: items.size,
              vsku: items.vsku,
              selected: items.selected,
            };
          })
        : [];

    return res.status(200).json({
      message: "Products moved from wishlist to cart successfully",
      load: cartProducts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
