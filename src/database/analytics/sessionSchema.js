const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    lastActivity: {
      type: Date,
      required: true,
    },
    isMobile: Boolean,
  },
  { timestamps: true }
);
const Session = mongoose.model("Session", sessionSchema);

module.exports = Session;
