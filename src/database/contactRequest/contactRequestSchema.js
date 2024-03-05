const mongoose = require("mongoose");

const contactRequestSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    mobile: String,
    subject: String,
    message: String,
    isActive: Boolean,
    isDelete: Number,
    isPending: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const ContactRequest = mongoose.model("ContactRequest", contactRequestSchema);

module.exports = ContactRequest;
