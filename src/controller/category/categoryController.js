const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Admin = require("../../Database/admin/adminSchema.js");
const MainCategory = require("../../database/categories/mainCategorySchema.js");
const SubCategory = require("../../database/categories/subCategorySchema.js");
const Promotion = require("../../database/promotion/promotionSchema.js");
const Attribute = require("../../database/attributes/attributeSchema.js");

module.exports.fetchAllCategory = async (req, res) => {
  try {
    const { queryType, categoryId } = req.query;

    if (queryType === "sub") {
      const subCategory = await SubCategory.find({ category: categoryId })
        .populate({
          path: "productDetails",
          populate: {
            path: "values",
            model: "Value",
          },
        })
        .populate({
          path: "otherDetails",
          populate: {
            path: "values",
            model: "Value",
          },
        })
        .populate({
          path: "colorDetails.value",
          populate: {
            path: "values",
            model: "Color",
          },
        })

        .exec();
      return res.status(200).json({ subCategory });
    }
    const mainCategory = await MainCategory.find().populate("subcategories");
    res.status(200).json({ mainCategory });
  } catch (err) {

    res.status(500).json({ error: err });
  }
};

module.exports.getHeaderCategory = async (req, res) => {
  try {
    const mainCategory = await MainCategory.find().populate("subcategories");

    const now = new Date();
    let promotion = await Promotion.findOne({
      fromDate: { $lte: now },
      toDate: { $gte: now },
    });



    res.status(200).json({ load: mainCategory, promotion });
  } catch (err) {

    res.status(500).json({ error: err });
  }
};

module.exports.getAllSubCategory = async (req, res) => {
  try {
    const { category } = req.query;
    if (category) {
      let load = await SubCategory.find({ category });
      load = load.map((item) => {
        return {
          ...item._doc,
          id: item._doc._id,
          _id: { ...item._doc, id: item._id.toString() },
        };
      });

      return res.send({ load, type: "home" });
    }
    let load = await SubCategory.find({});
    if (load) {
      load = load.map((item) => {
        return {
          ...item._doc,
          id: item._doc._id,
          _id: { ...item._doc, id: item._id.toString() },
        };
      });

      return res.send({ load, type: "home" });
    } else {
      return res.status(404).json({ message: "No subCategories found" });
    }
  } catch (err) {
    
    res.status(500).json({ error: err });
  }
};

module.exports.updateCategory = async (req, res) => {
  try {
    const { id, image, status, sub, des, main, description, home } = req.query;
    if (!id) {
      return res.status(404).json({ message: "No id found" });
    }

    if (main && description) {
      const category = await MainCategory.findByIdAndUpdate(id, {
        description,
      });
      return res.status(200).json({ category });
    }

    if (image) {
      if (home) {
        const category = await SubCategory.findByIdAndUpdate(id, {
          homeBanner: image,
        });
        return res.status(200).json({ category });
      }
      const category = await SubCategory.findByIdAndUpdate(id, { image });
      return res.status(200).json({ category });
    }

    if (status) {
      if (sub) {
        const category = await SubCategory.findByIdAndUpdate(id, {
          isSubListed: status,
        });
        return res.status(200).json({ category });
      } else if (des) {
        const category = await SubCategory.findByIdAndUpdate(id, {
          description: status,
        });
        return res.status(200).json({ category });
      } else if (home) {
        const category = await SubCategory.findByIdAndUpdate(id, {
          isHomeListed: status,
        });
        return res.status(200).json({ category });
      } else {
        const category = await SubCategory.findByIdAndUpdate(id, {
          isListed: status,
        });
        return res.status(200).json({ category });
      }
    }

    return res.status(404).json({ message: "Invalid request" });
  } catch (err) {
    
    res.status(500).json({ error: err });
  }
};

module.exports.updateCategoryBanner = async (req, res) => {
  try {
    const { id, sub, banner } = req.query;
    if (!id) {
      return res.status(404).json({ message: "No id found" });
    }

    if (sub) {
      const category = await SubCategory.findByIdAndUpdate(id, {
        banner,
      });
      return res.status(200).json({ category });
    }

    const category = await MainCategory.findByIdAndUpdate(id, {
      banner,
    });
    return res.status(200).json({ category });
  } catch (err) {
    
    res.status(500).json({ error: err });
  }
};

module.exports.getCategoryDetails = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(404).json({ message: "No id found" });
    }

    const sub = await SubCategory.findOne({ _id: id });

    if (sub) {
      return res.status(200).json({ load: sub });
    }

    const category = await MainCategory.findOne({ _id: id });
    return res.status(200).json({ load: category });
  } catch (err) {
    
    res.status(500).json({ error: err });
  }
};

module.exports.getAllAttributes = async (req, res) => {
  try {
    const attributes = await Attribute.findOne({ name: "OCCASION" }).populate("values");

    return res.status(200).json({ attributes : attributes.values });

  } catch (err) {
    
    res.status(500).json({ error: err });
  }
};
