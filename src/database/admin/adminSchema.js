const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,
    mobile : Number,
    rules : [],
    userType : String,
    permission : String,
    isBlocked : Boolean,
    isDelete : Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", AdminSchema);
