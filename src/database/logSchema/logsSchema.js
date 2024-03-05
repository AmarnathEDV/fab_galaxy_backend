const mongoose = require("mongoose");

const activitylogsSchema = new mongoose.Schema(
  {
    activityType: {
      type: String,
      required: true,
    },
    productId: {
      type: mongoose.Types.ObjectId,
      ref: "Product",
    },
    orderId: {
      type: mongoose.Types.ObjectId,
      ref: "Order",
    },
    adminId: {
      type: mongoose.Types.ObjectId,
      ref: "Admin",
    },
    link: String,
    metadata: {},
    remarks: String,
  },
  { timestamps: true }
);

const ActivityLog = mongoose.model("ActivityLog", activitylogsSchema);

module.exports = ActivityLog;
