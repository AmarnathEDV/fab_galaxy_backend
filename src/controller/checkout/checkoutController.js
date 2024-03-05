const { default: axios } = require("axios");
const Cart = require("../../database/cart/cartSchema");
const Order = require("../../database/orders/orderSchema");
const Product = require("../../database/product/productSchema");
const Promotion = require("../../database/promotion/promotionSchema");
const { orderReceivedEmailTemplate } = require("../../Emails/email");

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "s588.sgp8.mysecurecloudhost.com", // Use the hostname or webmail URL
  port: 465, // Use the appropriate port (e.g., 465 for secure)
  secure: true, // Set to true for secure connections
  auth: {
    user: "dev.amarnath@ekkdigitalvyapar.com", // Your email address
    pass: "Amarnath@123", // Your email password
  },
});

module.exports.checkout = async (req, res) => {
  try {
    let { customerId, address, coupon, paymentMethod } = req.body;

    const pincode = address.postalCode;

    if (!pincode) {
      return res.status(500).json({ message: "Invalid pincode" });
    }

    const requestObject = {
      orgPincode: "394230",
      desPincode: pincode,
    };

    let pincodeServisable = null;

    await axios
      .post(
        "http://smarttrack.ctbsplus.dtdc.com/ratecalapi/PincodeApiCall",
        requestObject,
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": "4073ba7e4966d74fc5a6afb1991862",
          },
        }
      )
      .then((response) => {
        pincodeServisable = response.data;
        // res.send(response.data);
      })
      .catch((err) => {
        res.send(err);
      });

    if (
      pincodeServisable.ZIPCODE_RESP[0].MESSAGE === "DESTPIN is not valid" ||
      pincodeServisable.ZIPCODE_RESP[0].MESSAGE === "ORGPIN is not valid" ||
      pincodeServisable.ZIPCODE_RESP[0].MESSAGE !== "SUCCESS"
    ) {
      return res.status(500).json({
        message:
          "Invalid pincode or pincode not servisable, Please change the address",
      });
    }

    customerId = req.params.id;

    let cartVals = await Cart.findOne({ customer: customerId });

    let products = cartVals.products;

    products = products.map((items) => ({ ...items._doc, promo: "" }));

    products = products.filter((items) => items.selected === true);

    if (products.length < 1) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Check if there is any pending order for the customer
    let existingOrder = null;

    // If there is an existing pending order, update its values
    if (existingOrder) {
      existingOrder.products = [];
      existingOrder.address = address;
      existingOrder.coupon = coupon;
      existingOrder.totalPrice = 0;
      existingOrder.finalPrice = 0;
      existingOrder.discount = 0;
      existingOrder.paymentMethod = paymentMethod;
      existingOrder.status = "success";
    } else {
      existingOrder = new Order({
        customer: customerId,
        address: address,
        coupon: coupon,
        status: "success",
        paymentMethod: paymentMethod,
        products: products,
        allLogs: [
          {
            date: new Date(),
            note: "New order created",
            orderType: "info",
            paymentDetails: "Order created with initial information",
            paymentMethod: "COD",
          },
        ],
      });
    }

    let totalPrice = 0;
    let dummy = 0;
    // Validate products and calculate total price
    for (const product of products) {
      const productDoc = await Product.findById(product.productId);
      if (!productDoc) {
        return res.status(404).json({ message: "Product not found" });
      }
      existingOrder.products[dummy].productValue =
        productDoc.fcp * product.quantity;

      const selectedSize = product.size;
      if (!productDoc.sizeDetails || !productDoc.sizeDetails[selectedSize]) {
        return res.status(400).json({
          message: `Invalid size selected for product: ${productDoc.title}`,
        });
      }
      const currentStock = parseInt(productDoc.sizeDetails[selectedSize].STOCK);
      const requestedQuantity = parseInt(product.quantity);

      if (currentStock < requestedQuantity) {
        // Insufficient stock or invalid quantity, handle it

        if (currentStock === 0) {
          // Remove product from cart if stock is zero
          existingOrder.products = existingOrder.products.filter(
            (p) => !p.productId.equals(product.productId)
          );

          await existingOrder.save();
          await Cart.findOneAndUpdate(
            { customer: customerId },
            { $pull: { products: { productId: product.productId } } }
          );
          const updatedCart = await Cart.findOne({
            customer: customerId,
          }).populate("products.productId");

          const cartProducts =
            updatedCart && updatedCart.products.length > 0
              ? updatedCart.products.map((items) => {
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
          cartProducts = cartProducts.filter((items) => items === false);
          return res.status(400).json({
            message: `Insufficient stock for product: ${productDoc.title}, size: ${selectedSize}. Cart updated.`,
            order: existingOrder,
            cart: cartProducts,
          });
        } else {
          // Update cart with available stock
          const updatedQuantity = Math.min(currentStock, requestedQuantity);
          const updatedProduct = {
            productId: product.productId,
            quantity: updatedQuantity,
            size: product.size,
          };
          // Update or add the product to the cart
          const existingCartItemIndex = existingOrder.products.findIndex((p) =>
            p.productId.equals(product.productId)
          );
          if (existingCartItemIndex !== -1) {
            existingOrder.products[existingCartItemIndex].quantity =
              updatedQuantity;
          } else {
            existingOrder.products.push(updatedProduct);
          }
          await existingOrder.save();
        }
        // Fetch updated cart after modification
        const updatedCart = await Cart.findOne({
          customer: customerId,
        }).populate("products.productId");

        const cartProducts =
          updatedCart && updatedCart.products.length > 0
            ? updatedCart.products.map((items) => {
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
        cartProducts = cartProducts.filter((items) => items === false);
        return res.status(400).json({
          message: `Insufficient stock for product: ${productDoc.title}, size: ${selectedSize}. Cart updated.`,
          order: existingOrder,
          cart: cartProducts,
        });
      }
      totalPrice += productDoc.mrp * product.quantity;
      dummy++;
    }

    const now = new Date();
    const validPromotion = await Promotion.findOne({
      fromDate: { $lte: now },
      toDate: { $gte: now },
      "products.productId": { $in: products.map((p) => p.productId) },
    });

    let finalPrice = totalPrice;
    let discount = 0;

    // Apply promotion discount if available
    if (validPromotion) {
      let indexVal = 0;
      for (const product of products) {
        const promotionProduct = validPromotion.products.find((p) =>
          p.productId.equals(product.productId)
        );

        indexVal++;

        if (promotionProduct) {
          const productDoc = await Product.findById(product.productId);

          if (!productDoc) {
            continue;
          }
          const discountAmount =
            (productDoc.mrp *
              (parseFloat(promotionProduct.discount) +
                parseFloat(productDoc.td))) /
            100;
          finalPrice -= discountAmount * product.quantity;
          discount += discountAmount * product.quantity;

          existingOrder.products[indexVal - 1].productValue =
            productDoc.mrp * product.quantity -
            discountAmount * product.quantity;

          existingOrder.products[indexVal - 1].promo =
            promotionProduct.discount;
        } else {
          const productDoc = await Product.findById(product.productId);

          if (!productDoc) {
            continue;
          }
          const discountAmount =
            (productDoc.mrp * parseFloat(productDoc.td)) / 100;
          finalPrice -= discountAmount * product.quantity;
          discount += discountAmount * product.quantity;

          existingOrder.products[indexVal - 1].productValue =
            productDoc.mrp * product.quantity -
            discountAmount * product.quantity;
        }
      }
    }

    // Update existing order with final values
    existingOrder.totalPrice = totalPrice;
    existingOrder.finalPrice = finalPrice;
    existingOrder.discount = discount;

    // Save or update the order in the database
    await existingOrder.save();

    // Deduct product quantities from stock
    for (const product of products) {
      const existingProduct = await Product.findById(product.productId);

      let newStock =
        parseInt(existingProduct.sizeDetails[product.size].STOCK) -
        parseInt(product.quantity);

      await Product.findByIdAndUpdate(existingProduct._id, {
        $set: { [`sizeDetails.${product.size}.STOCK`]: newStock.toString() },
      });
    }

    // Update the cart with new product quantities
    const updatedCart = await Cart.findOneAndUpdate(
      {
        customer: customerId,
      },
      { $set: { products: [] } }
    );

    (await existingOrder.populate("products.productId")).populate("customer");

    const mailOptions = {
      from: "dev.amarnath@ekkdigitalvyapar.com",
      to: existingOrder.customer.email,
      subject: "Order has been Placed.",
      html: orderReceivedEmailTemplate(existingOrder),
    };
    await transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log("Email sent:", info.response);
      }
    });

    res.status(201).json({
      message: "Order placed successfully",
      order: existingOrder,
      updatedCart: [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getCheckoutPageLoad = async (req, res) => {
  try {
    const { id } = req.params;
    let cartVal = await Cart.findOne({ customer: id }).populate(
      "products.productId"
    );

    let existingCart = { ...cartVal._doc, products: cartVal._doc.products };

    if (!existingCart) {
      return res.status(404).json({ message: "No products in the cart found" });
    }

    // Get all product IDs in the cart
    const productIds = existingCart.products.map(
      (cartProduct) => cartProduct.productId._id
    );

    existingCart.products = existingCart.products.filter(
      (product) => product.selected === true
    );

    // Find the active promotion based on current date and time
    const now = new Date();
    const activePromotion = await Promotion.findOne({
      fromDate: { $lte: now },
      toDate: { $gte: now },
    })
      .populate({
        path: "products.productId",
        populate: { path: "productDetails.value", model: "Value" },
      })
      .populate({
        path: "products.productId",
        populate: { path: "otherDetails.value", model: "Value" },
      })
      .populate({
        path: "products.productId",
        populate: { path: "colorDetails.value", model: "Color" },
      })
      .populate({
        path: "products.productId",
        populate: { path: "colorFamily.value", model: "Color" },
      })
      .populate({
        path: "products.productId",
        populate: {
          path: "subCategory",
          model: "SubCategory",
          populate: { path: "category", model: "MainCategory" },
        },
      });

    // If there is an active promotion, update cart products with promotion details
    if (activePromotion) {
      let newData = existingCart.products.map((cartProduct) => {
        const matchingProduct = activePromotion.products.findIndex(
          (item) => item.productId.title === cartProduct.productId.title
        );

        if (matchingProduct !== -1) {
          cartProduct = {
            ...cartProduct._doc,
            promo: activePromotion.products[matchingProduct].discount,
            vsku: cartProduct.vsku, // Add vsku here
          };
        }
        return cartProduct;
      });
      existingCart.products = newData;
    }

    return res.status(200).json({ load: existingCart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
