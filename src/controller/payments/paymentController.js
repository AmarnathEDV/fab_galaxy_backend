const { default: axios } = require("axios");
const Cart = require("../../database/cart/cartSchema.js");
const Order = require("../../database/orders/orderSchema.js");
const Product = require("../../database/product/productSchema.js");
const Promotion = require("../../database/promotion/promotionSchema.js");
const redisClient = require("../../redis/redisInstance.js");
const { orderReceivedEmailTemplate, editSuccessEmail } = require("../../Emails/email.js");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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

module.exports.createOrderIntent = async (req, res) => {
  try {
    // Get the amount and currency from the request body
    let {
      customerId,
      amount,
      currency,
      coupon,
      shipping,
      address,
      paymentMethod,
    } = req.body;
    const { id } = req.params;

    const pincode = address.postalCode;

    if (!pincode) {
      return res.status(500).json({ message: "Invalid pincode" });
    }

    const requestObjectPincode = {
      orgPincode: "394230",
      desPincode: pincode,
    };

    let pincodeServisable = null;

    await axios
      .post(
        "http://smarttrack.ctbsplus.dtdc.com/ratecalapi/PincodeApiCall",
        requestObjectPincode,
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

    const currentTime = Math.floor(Date.now() / 1000);

    // Calculate the expiration time as the current time plus 10 minutes (600 seconds).
    const expirationTime = currentTime + 20;

    const cartVals = await Cart.findOne({ customer: customerId });

    let products = cartVals.products;

    products = products.map((items) => ({
      ...items._doc,
      promo: "",
      productValue: 0,
    }));

    products = products.filter((items) => items.selected === true);

    if (products.length < 1) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Check if there is any pending order for the customer
    let existingOrder = await new Order({
      customer: customerId,
      address: address,
      coupon: coupon,
      status: "pending",
      paymentMethod: paymentMethod,
      products: products,
    });

    // If there is an existing pending order, update its values

    let totalPrice = 0;

    let dummy = 0;
    // Validate products and calculate total price
    for (const product of products) {
      const productDoc = await Product.findById(product.productId);

      if (!productDoc) {
        return res.status(404).json({ message: "Product not found" });
      }
      const selectedSize = product.size;
      if (!productDoc.sizeDetails || !productDoc.sizeDetails[selectedSize]) {
        return res.status(400).json({
          message: `Invalid size selected for product: ${productDoc.title}`,
        });
      }

      existingOrder.products[dummy].productValue =
        productDoc.fcp * product.quantity;

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
            vsku: product.vsku,
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

    const cart = await Cart.findOne({ customer: id });

    const copyCart = { ...cart._doc };

    // Create a PaymentIntent object using the Stripe API
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      description: "purchase of goods",
      shipping: {
        name: `${address.fname} ${address.lname}`,
        address: {
          line1: address.addressOne,
          line2: address.addressTwo,
          postal_code: address.postalCode,
          city: address.city,
          state: address.province,
          country: address.country,
        },
      },
    });

    await Cart.findOneAndUpdate(
      { customer: customerId },
      { $set: { products: [] } }
    );

    existingOrder.allLogs = [
      {
        date: new Date(),
        note: "Payment for the order inititated",
        orderType: "Payment Started",
        paymentDetails: paymentIntent.id,
        paymentMethod: "CARD",
      },
    ];

    await existingOrder.save();

    await redisClient.setEx(
      `pending_${paymentIntent.id}`,
      3600,
      JSON.stringify({ cart: copyCart, address, orderId: existingOrder._id })
    );
    // Send back the client secret of the PaymentIntent object to the client-side code
    res.json({
      clientSecret: paymentIntent.client_secret,
      address: address,
      order: existingOrder,
    });
  } catch (err) {
    console.log(err);
    // Handle any errors
    res.status(500).json({ error: err.message });
  }
};

// Optionally, create a route handler for the /webhook endpoint
module.exports.stripeWebhoook = async (req, res) => {
  try {
    // Get the webhook event from the request body
    const event = req.body;

    console.log(event.type);

    // Handle the event based on its type
    switch (event.type) {
      case "payment_intent.succeeded":
        // Handle successful payment
        await handleSuccessfulPayment(event.data.object);
        break;
      case "payment_intent.payment_failed":
        // Handle payment failure
        await handlePaymentFailure(event.data.object);
        break;
      case "payment_intent.amount_capturable_updated":
        // Handle when the amount capturable on a PaymentIntent is updated
        console.log("Amount capturable updated:", event.data.object.id);
        break;
      case "payment_intent.canceled":
        // Handle cancellation of a PaymentIntent
        console.log("PaymentIntent canceled:", event.data.object.id);
        break;
      case "payment_intent.payment_failed":
        // Handle payment failure
        console.log("Payment failed:", event.data.object.id);
        break;
      case "payment_intent.refunded":
        // Handle payment refund
        console.log("Payment refunded:", event.data.object.id);
        break;
      // Add more cases for other event types as needed
      default:
        // Unexpected event type
        console.warn("Unhandled event type:", event.type);
    }

    // Return a 200 response to acknowledge the event
    res.json({ received: true });
  } catch (err) {
    // Handle any errors
    console.error(err);
    res.status(400).send(`Webhook error: ${err.message}`);
  }
};

async function handleSuccessfulPayment(paymentIntent) {
  // Get the cart associated with the payment
  const cart = await redisClient.get(`pending_${paymentIntent.id}`);

  console.log("herehrehrerer");

  if (cart) {
    const parsedCart = JSON.parse(cart);
    const orderId = parsedCart.orderId;
    const order = await Order.findOne({
      _id: orderId,
    });

    if (order) {
      // Update order status to "success"
      await Order.findByIdAndUpdate(orderId, {
        $set: {
          status: "success",
          paymentDetails: paymentIntent,
        },
        $push: {
          allLogs: {
            date: new Date(),
            note: "Order payment Success",
            orderType: "success",
            paymentDetails: paymentIntent.id,
            paymentMethod: "CARD",
          },
        },
      });

      const existingOrder = await Order.findById(orderId)
        .populate("products.productId")
        .populate("customer");

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

      console.log("payment succces ebertm");

      // Clear the cart associated with the order
      await Cart.findOneAndUpdate(
        { customer: order.customer },
        { $set: { products: [] } }
      );

      // Delete the pending cart from Redis
      await redisClient.del(`pending_${paymentIntent.id}`);
    }
  }
}

async function handlePaymentFailure(paymentIntent) {
  // Get the cart associated with the payment
  const key = `pending_${paymentIntent.id}`;

  const orderData = await redisClient.get(key);
  const order = JSON.parse(orderData);

  // Get order details from MongoDB
  const orderFromDB = await Order.findById(order.orderId);

  const newOrder = await Order.findByIdAndUpdate(order.orderId, {
    status: "failed",
    paymentDetails: paymentIntent,
    $push: {
      allLogs: {
        date: new Date(),
        note: "Order payment failed",
        orderType: "error",
        paymentDetails: paymentIntent.id,
        paymentMethod: "CARD",
      },
    },
  });

  const paymentIntentId = key.split("pending_")[1];

  // Update product stock
  await stripe.paymentIntents
    .cancel(paymentIntentId)
    .then((canceledPaymentIntent) => {
      console.log("PaymentIntent canceled:", canceledPaymentIntent.id);
    })
    .catch((error) => {
      console.error("Error canceling PaymentIntent:", error.message);
    });
  // Update product stock
  for (const productItem of orderFromDB.products) {
    const product = await Product.findById(productItem.productId);

    // Find the index of the size object within sizeDetails corresponding to the product's size

    const stock =
      parseInt(product.sizeDetails[productItem.size].STOCK, 10) +
      productItem.quantity;

    // Construct update operation
    const updateOperation = {
      $set: {
        [`sizeDetails.${productItem.size}.STOCK`]: stock.toString(), // Convert back to string
      },
    };

    // Perform update operation using findByIdAndUpdate
    await Product.findByIdAndUpdate(productItem.productId, updateOperation);

    console.log(
      `Stock for size ${productItem.size} updated for product ${product._id}`
    );
  }

  // Add products back to cart
  const cart = await Cart.findOneAndUpdate(
    { customer: newOrder.customer },
    {
      $set: {
        products: orderFromDB.products.map((productItem) => ({
          productId: productItem.productId,
          quantity: productItem.quantity,
          size: productItem.size,
          vsku: productItem.vsku,
        })),
      },
    }
  );
  await cart.save();

  const existingOrder = await Order.findById(order.orderId)
    .populate("products.productId")
    .populate("customer");

  const mailOptions = {
    from: "dev.amarnath@ekkdigitalvyapar.com",
    to: existingOrder.customer.email,
    subject: "Payment failed",
    html: editSuccessEmail(
      "Your order payment failed.",
      `Your payment for order id ${order.orderId} has been failed, if you did not place this order, please reach out to the administrator at support@fabgalaxy.com for assistance.`
    ),
  };

  await transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });

  // Delete order from Redis
  await redisClient.del(key);

  console.log(
    `Order ${order.orderId} payment expired. Status updated to failed.`
  );
}
