const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },

    products: [
      {
        productId: {
          type: mongoose.Types.ObjectId,

          ref: "Product",
        },
        size: String,
        quantity: Number,
        vsku: String,
        shipped: {
          type: String,
          default: "pending",
        },
        status: { type: String, default: "pending" },
        cancelReason: {},
        promo: String,
        productValue: Number,
        shippingDetails: {},
        isLabelDownloaded: { type: Boolean, default: false },
        labelFiles: String,
        deliveryData: {},
        returnDeliveryData :{},
        logs: [
          {
            date: String,
            note: String,
            orderType: String,
            currentStatus: String,
            paymentMethod: String,
          },
        ],
        rating: {
          rating: Number,
          review: String,
        },
        returnReason: {
          answer: String,
          question: String,
          returnDate: {
            type: Date,
            default: Date.now,
          },
        },
        isReturnInitiated: { type: Boolean, default: false },
        isReturnAccepted: { type: Boolean, default: false },
        bankDetails: {},
        returnShippingDetails: {},
        returnStatus: {
          type: String,
          default: "nil",
        },
      },
    ],

    allLogs: [
      {
        date: String,
        note: String,
        orderType: String,
        paymentDetails: String,
        paymentMethod: String,
      },
    ],

    address: [
      {
        fname: String,
        lname: String,
        contact: String,
        addressOne: String,
        addressTwo: String,
        city: String,
        country: String,
        province: String,
        postalCode: String,
      },
    ],
    paymentDetails: {},
    coupon: String,
    Totalprice: Number,
    finalPrice: Number,
    discount: Number,
    orderType: String,
    status: String,
    date: {
      type: Date,
      default: Date.now,
    },
    shipping: {
      type: String,
      default: "pending",
    },
    paymentMethod: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
