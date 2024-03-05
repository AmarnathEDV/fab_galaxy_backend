const cron = require("node-cron");
const redisClient = require("../redis/redisInstance");
const Cart = require("../database/cart/cartSchema");
const Product = require("../database/product/productSchema");
const Order = require("../database/orders/orderSchema");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

cron.schedule("*/3 * * * * *", async function () {
  try {
    // Get all keys with prefix 'pending_'
    const pendingKeys = await redisClient.keys("pending_*");

    // Iterate over each pending key
    for (const key of pendingKeys) {
      // Get order data from Redis
      const orderData = await redisClient.get(key);
      const order = JSON.parse(orderData);

      // Get order details from MongoDB
      const orderFromDB = await Order.findById(order.orderId);
      

      // Calculate time difference
      const currentTime = new Date();
      const createdAtTime = new Date(orderFromDB.createdAt);
      const timeDifference = (currentTime - createdAtTime) / (1000 * 60); // in minutes
      
      // Check if payment has expired
      if (timeDifference > 10) {
        // Update order status to failed
        const newOrder = await Order.findByIdAndUpdate(order.orderId, {
          $set: {
            status: "failed",
          },
          $push: {
            allLogs: {
              date: new Date(),
              note: "Order payment Failed, order cancelled",
              orderType: "Payment falied",
              paymentDetails: key.split("pending_")[1],
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
          await Product.findByIdAndUpdate(
            productItem.productId,
            updateOperation
          );

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
              })),
            },
          }
        );
        await cart.save();

        // Delete order from Redis
        await redisClient.del(key);

        console.log(
          `Order ${order.orderId} payment expired. Status updated to failed.`
        );
      }
    }
  } catch (error) {
    console.error("Error occurred while checking pending payments:", error);
  }
});


