const mongoose = require("mongoose");

const PolicySchema = new mongoose.Schema({
  
  privacy: [
    {
      date: Date,
      content: {},
    },
  ],
  shipping: [
    {
      date: Date,
      content: {},
    },
  ],
  terms: [
    {
      date: Date,
      content: {},
    },
  ],
  cancellation: [
    {
      date: Date,
      content: {},
    },
  ],
});

const Policy = mongoose.model("Policy", PolicySchema);
module.exports = Policy;
