const mongoose = require("mongoose");

const AttributeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        values : [{ type: mongoose.Schema.Types.ObjectId, ref: "Value"}],
    },
    { timestamps: true }
);

const Attribute = mongoose.model("Attribute", AttributeSchema);

module.exports = Attribute;