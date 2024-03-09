const cron = require("node-cron");
const redisClient = require("../redis/redisInstance");
const Cart = require("../database/cart/cartSchema");
const Product = require("../database/product/productSchema");
const Order = require("../database/orders/orderSchema");
const { shippingService } = require("../utils/services/shippingService");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const nodemailer = require("nodemailer");
const {
  orderReceivedEmailTemplate,
  orderTemplate,
} = require("../Emails/email");
const Test = require("../database/testingSchema");

const transporter = nodemailer.createTransport({
  host: "s588.sgp8.mysecurecloudhost.com", // Use the hostname or webmail URL
  port: 465, // Use the appropriate port (e.g., 465 for secure)
  secure: true, // Set to true for secure connections
  auth: {
    user: "dev.amarnath@ekkdigitalvyapar.com", // Your email address
    pass: "Amarnath@123", // Your email password
  },
});

cron.schedule("*/300 * * * * *", async function () {
  try {
    const orders = await Order.find({
      "products.shipped": { $nin: ["pending", "cancelled", "Delivered"] },
      "products.shippingDetails": { $exists: true, $ne: {} },
    });

    for (const order of orders) {
      for (const product of order.products) {
        if (product.shipped !== "pending" && product.shipped !== "cancelled" && product.shipped !== "RTO") {
          const referenceNumber = product.shippingDetails.reference_number;
          const packageStatus = await shippingService.trackShipment(
            referenceNumber
          );

          console.log(packageStatus.trackHeader.strStatus);

          if (!packageStatus) {
            continue;
          }

          if (
            packageStatus &&
            packageStatus.trackHeader.strStatus === product.shipped
          ) {
            continue;
          }

          if (packageStatus) {
            product.shipped = packageStatus.trackHeader.strStatus;
            const newTest = new Test({
              value: packageStatus,
            });

            await newTest.save();
          }

          if (
            packageStatus &&
            packageStatus.trackHeader.strStatus === "Delivered"
          ) {
            product.status = packageStatus.trackHeader.strStatus;
            product.deliveryData = {
              ...packageStatus,
              deliveredDate: Date.now(),
            };

            const existingOrder = await Order.findById(order._id)
              .populate("products.productId")
              .populate("customer");

            const emailData = { ...existingOrder._doc };

            emailData.products = [product];

            emailData.products[0].productId = await Product.findById(
              product.productId
            );

            const mailOptions = {
              from: "dev.amarnath@ekkdigitalvyapar.com",
              to: existingOrder.customer.email,
              subject: "Order has been Delivered.",
              html: orderTemplate(emailData, "Order has been delivered."),
            };

            await transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error("Error sending email:", error);
              } else {
                console.log("Email sent:", info.response);
              }
            });
          }

          if (
            packageStatus &&
            packageStatus.trackHeader.strStatus === "Not Delivered"
          ) {
            product.status = "RTO";
            product.shipped = "RTO";

            const existingOrder = await Order.findById(order._id)
              .populate("products.productId")
              .populate("customer");

            const emailData = { ...existingOrder._doc };

            emailData.products = [product];

            emailData.products[0].productId = await Product.findById(
              product.productId
            );

            const mailOptions = {
              from: "dev.amarnath@ekkdigitalvyapar.com",
              to: existingOrder.customer.email,
              subject: "Order Was not Delivered.",
              html: orderTemplate(emailData, "Order was not delivered."),
            };

            await transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error("Error sending email:", error);
              } else {
                console.log("Email sent:", info.response);
              }
            });
          }

          //note : After getting the possible values of status,  update the order accordingly
          //////// with the logs included.

          await order.save();
        }
      }
    }
  } catch (error) {
    console.error("Error occurred while updating shipping status:", error);
  }
});

cron.schedule("*/300 * * * * *", async function () {
  try {
    const orders = await Order.find({
      "products.isReturnAccepted": { $exists: true },
    });

    for (const order of orders) {
      for (const product of order.products) {
        if (
          product.returnStatus !== "pending" &&
          product.returnStatus !== "cancelled" &&
          product.isReturnAccepted
        ) {
          const referenceNumber =
            product.returnShippingDetails.reference_number;
          const packageStatus = await shippingService.trackShipment(
            referenceNumber
          );

          console.log(packageStatus);

          if (!packageStatus) {
            continue;
          }

          if (
            packageStatus &&
            packageStatus.trackHeader.strStatus === product.shipped
          ) {
            continue;
          }

          if (packageStatus) {
            product.returnStatus = packageStatus.trackHeader.strStatus;
            const newTest = new Test({
              value: packageStatus.trackHeader.strStatus,
            });
            await newTest.save();
          }

          if (
            packageStatus &&
            packageStatus.trackHeader.strStatus === "Delivered"
          ) {
            product.returnStatus = packageStatus.trackHeader.strStatus;
            product.returnDeliveryData = {
              ...packageStatus,
              deliveredDate: Date.now(),
            };

            const existingOrder = await Order.findById(order._id)
              .populate("products.productId")
              .populate("customer");

            const emailData = { ...existingOrder._doc };

            emailData.products = [product];

            emailData.products[0].productId = await Product.findById(
              product.productId
            );

            const mailOptions = {
              from: "dev.amarnath@ekkdigitalvyapar.com",
              to: existingOrder.customer.email,
              subject: "Order has been Returned.",
              html: orderTemplate(
                emailData,
                "Order has been Returned. Your refund will be processed Soon."
              ),
            };

            await transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error("Error sending email:", error);
              } else {
                console.log("Email sent:", info.response);
              }
            });
          }

          //note : After getting the possible values of status,  update the order accordingly
          ///////  with the logs included.

          await order.save();
        }
      }
    }
  } catch (error) {
    console.error("Error occurred while updating shipping status:", error);
  }
});
