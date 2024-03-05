const mongoose = require('mongoose');

const pageVisitSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  pathname: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const PageVisit = mongoose.model('PageVisit', pageVisitSchema);

module.exports = PageVisit;
