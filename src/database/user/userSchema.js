const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    fname: {
      type: String,
      required: true,
    },
    lname: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    mobile: {
      type: String,
    },
    status: {
      type: Boolean,
      required: true,
    },
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
        isDefault: Boolean,
      },
    ],
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);

module.exports = User;
