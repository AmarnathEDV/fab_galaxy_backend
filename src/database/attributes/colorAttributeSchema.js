const mongoose = require("mongoose");

const colorAttributeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        values : [{ type: mongoose.Schema.Types.ObjectId, ref: "Color"}],
    },
    { timestamps: true }
);

const ColorAttribute = mongoose.model("ColorAttribute", colorAttributeSchema);

module.exports = ColorAttribute;