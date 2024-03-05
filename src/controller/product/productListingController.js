const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Admin = require("../../Database/admin/adminSchema");
const MainCategory = require("../../database/categories/mainCategorySchema");
const SubCategory = require("../../database/categories/subCategorySchema");
const Product = require("../../database/product/productSchema");
const redisClient = require("../../redis/redisInstance");
const { default: mongoose } = require("mongoose");
const { object } = require("joi");
const Wishlist = require("../../database/wishlist/wishlistSchema");
const Collection = require("../../database/collections/collectionSchema");
const Promotion = require("../../database/promotion/promotionSchema");
const Draft = require("../../database/draft/draftSchema");
const ActivityLog = require("../../database/logs/logSchema");

module.exports.createProduct = async (req, res) => {
  try {
    const { productData } = req.body;
    const { id } = req.params;

    const category = await MainCategory.findOne({
      subcategories: productData.subCategory[0],
    });

    const load = await new Product({
      ...productData,
      category: category._id,
      productDetails: Object.entries(productData.productDetails).map(
        ([name, value]) => ({ name, value: value.value })
      ),
      otherDetails: Object.entries(productData.otherDetails).map(
        ([name, value]) => ({ name, value: value.value })
      ),
      colorDetails: Object.entries(productData.colorDetails)
        .filter(([name, value]) => {
          if (name !== "COLOR FAMILY") {
            return true;
          } else {
            return false;
          }
        })
        .map(([name, value]) => ({ name, value: value.value })),
      colorFamily: Object.entries(productData.colorDetails)
        .filter(([name, value]) => {
          if (name === "COLOR FAMILY") {
            return true;
          } else {
            return false;
          }
        })
        .map(([name, value]) => value)[0],
      status: false,
      draft: true,
      ref: id,
      subCategory: productData.subCategory,
      metaData: productData.metaData,
    }).save();

    const cacheKeys = await redisClient.keys("all_products_*");

    if (cacheKeys.length > 0) {
      await redisClient.del(cacheKeys);
    }

    const activityLog = new ActivityLog({
      activityType: "product_list",
      adminId: id,
      productId: load._id,
      metadata: {
        product: load,
      },
    });

    await activityLog.save();

    return res.status(200).json({ load });
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

module.exports.getAllProductsForSubAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `all_products_${id}_draft`;
    const data = await redisClient.get(cacheKey);

    if (data) {
      let load = JSON.parse(data);
      return res.status(200).json({ load, type: "listing_subadmin" });
    }

    let load = await Product.find({ status: false })
      .populate("productDetails.value")
      .populate("otherDetails.value")
      .populate("colorDetails.value")
      .populate("colorFamily.value")
      .populate("ref")
      .populate({
        path: "subCategory",
        populate: {
          path: "category",
          model: "MainCategory",
        },
      })
      .exec();

    load = load.map((item) => {
      return {
        ...item._doc,
        id: item._doc._id,
        _id: { ...item._doc, id: item._id.toString() },
      };
    });

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(load));

    return res.status(200).json({ load, type: "listing_subadmin" });
  } catch (err) {
    return res.status(500).json({ error: err });
  }
};

module.exports.getAllProductsPublished = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `all_products_${id}_publish`;
    const data = await redisClient.get(cacheKey);

    if (data) {
      let load = JSON.parse(data);
      return res.status(200).json({ load, type: "listing_subadmin" });
    }

    let load = await Product.find({ status: true })
      .populate("productDetails.value")
      .populate("otherDetails.value")
      .populate("colorDetails.value")
      .populate("colorFamily.value")
      .populate("ref")
      .populate({
        path: "subCategory",
        populate: {
          path: "category",
          model: "MainCategory",
        },
      })
      .exec();

    load = load.map((item) => {
      return {
        ...item._doc,
        id: item._doc._id,
        _id: { ...item._doc, id: item._id.toString() },
      };
    });

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(load));

    return res.status(200).json({ load, type: "listing_subadmin" });
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

module.exports.verifyQC = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId } = req.query;

    const load = await Product.findByIdAndUpdate(productId, { status: true });

    if (load) {
      const cacheKeys = await redisClient.keys("all_products_*");

      if (cacheKeys.length > 0) {
        await redisClient.del(cacheKeys);
      }
      const activityLog = new ActivityLog({
        activityType: "product_qc_true",
        adminId: id,
        productId: load._id,
        metadata: {
          product: load,
        },
      });

      await activityLog.save();
      return res.status(200).json({ load, type: "listing_subadmin" });
    }

    return res.status(500).json({ error: "internal server error" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err });
  }
};

module.exports.unmarkQC = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId } = req.query;

    const load = await Product.findByIdAndUpdate(productId, { status: false });

    if (load) {
      const cacheKeys = await redisClient.keys("all_products_*");

      if (cacheKeys.length > 0) {
        await redisClient.del(cacheKeys);
      }
      const activityLog = new ActivityLog({
        activityType: "product_qc_false",
        adminId: id,
        productId: load._id,
        metadata: {
          product: load,
        },
      });

      await activityLog.save();
      return res.status(200).json({ load, type: "listing_subadmin" });
    }

    return res.status(500).json({ error: "internal server error" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err });
  }
};

module.exports.productListing = async (req, res) => {
  try {
    let {
      page = 2,
      sizeDetails = "",
      filter = "",
      sort = "",
      subCategory = "",
      minMRP = null,
      maxMRP = null,
      collection = null,
      sales = null,
      search = "",
      occasion = null,
    } = req.query;

    console.log(req.query);

    const cacheKeys = await redisClient.keys("all_products_*");

    if (cacheKeys.length > 0) {
      await redisClient.del(cacheKeys);
    }

    filter = filter.length > 2 ? filter.split(" ") : [];

    if (occasion) {
      filter.push(occasion);
    }

    console.log(occasion);

    subCategory = subCategory.length > 2 ? subCategory.split(" ") : [];

    const cacheKey = `all_products_${page}_${filter}_${sizeDetails}_${sort}_${subCategory}_${minMRP}_${maxMRP}_${collection}_${sales}_${search}`;

    const data = await redisClient.get(cacheKey);

    if (data !== null) {
      let load = JSON.parse(data);
      return res.status(200).json(load);
    } else {
      let query = Product.find({
        status: true,
      });

      if (subCategory && subCategory.length > 0 && filter.length > 0) {
        query = query.where({
          $and: [
            {
              $or: [
                { subCategory: { $in: subCategory } },
                { category: subCategory },
              ],
            },
            {
              $or: [
                { "productDetails.value": { $in: filter } },
                { "otherDetails.value": { $in: filter } },
                { "colorDetails.value": { $in: filter } },
              ],
            }, // Use equality check for single category
          ],
        });
      }
      if (minMRP && maxMRP) {
        query = query.where({
          fcp: { $gte: minMRP, $lte: maxMRP },
        });
      }

      if (search) {
        query = query.where({
          $or: [
            { title: { $regex: search, $options: "i" } }, // Match title case-insensitive
            { sku: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } }, // Match SKU case-insensitive
          ],
        });
      }

      if (filter.length <= 0 && subCategory.length > 0) {
        query = query.where({
          $or: [
            { subCategory: { $in: subCategory } },
            { category: subCategory },
          ],
        });
      }

      if (filter.length > 0 && subCategory.length <= 0) {
        query = query.where({
          $or: [
            { "productDetails.value": { $in: filter } },
            { "otherDetails.value": { $in: filter } },
            { "colorDetails.value": { $in: filter } },
          ],
        });
      }

      if (sales) {
        query = query.where({
          td: { $gt: "70" },
        });
      }

      // if (sizeDetails[0] && filter.sizeDetails.length > 0) {
      //   const sizeDetailsFilter = filter.sizeDetails.map((filter) => ({
      //     "sizeDetails.name": filter.name,
      //     "sizeDetails.value": filter.value,
      //   }));
      //   query = query.where({ $and: sizeDetailsFilter });
      // }

      // Apply sorting
      if (sort === "title_az") {
        query = query.sort({ title: 1 });
      } else if (sort === "title_za") {
        query = query.sort({ title: -1 });
      } else if (sort === "date_on") {
        query = query.sort({ createdAt: 1 });
      } else if (sort === "date_no") {
        query = query.sort({ createdAt: -1 });
      }

      // Apply pagination

      const totalCount = await query.clone().countDocuments();

      const limit = 9; // Adjust as needed
      const skip = (page - 2) * limit;
      query = query.limit(limit).skip(skip);

      let load = await query
        .populate("productDetails.value")
        .populate("otherDetails.value")
        .populate("colorDetails.value")
        .populate("colorFamily.value")
        .populate("ref")
        .populate({
          path: "subCategory",
          populate: {
            path: "category",
            model: "MainCategory",
          },
        });

      if (collection && search.length < 1 && !filter.length > 0 && page <= 2) {
        const titleRegex = new RegExp(`^${collection}$`, "i");
        let collectionProducts = await Collection.findOne({ name: titleRegex })
          .populate({
            path: "products.productId",
            populate: { path: "productDetails.value", model: "Value" },
          })
          .populate({
            path: "products.productId",
            populate: { path: "otherDetails.value", model: "Value" },
          })
          .populate({
            path: "products.productId",
            populate: { path: "colorDetails.value", model: "Color" },
          })
          .populate({
            path: "products.productId",
            populate: { path: "colorFamily.value", model: "Color" },
          })
          .populate({
            path: "products.productId",
            populate: {
              path: "subCategory",
              model: "SubCategory",
              populate: { path: "category", model: "MainCategory" },
            },
          });

        collectionProducts.products.sort((a, b) => a.position - b.position);

        collectionProducts = await collectionProducts.products.map(
          (items) => items.productId
        );

        load = await load.filter((items) => {
          const index = collectionProducts.findIndex(
            (item) => item.title === items.title
          );

          if (index === -1) {
            return true;
          } else {
            return false;
          }
        });

        load = [...collectionProducts, ...load];
      }

      if (sales && search.length < 1 && !filter.length > 0 && page <= 2) {
        const now = new Date();
        let collectionProducts = await Promotion.findOne({
          fromDate: { $lte: now },
          toDate: { $gte: now },
        })
          .populate({
            path: "products.productId",
            populate: { path: "productDetails.value", model: "Value" },
          })
          .populate({
            path: "products.productId",
            populate: { path: "otherDetails.value", model: "Value" },
          })
          .populate({
            path: "products.productId",
            populate: { path: "colorDetails.value", model: "Color" },
          })
          .populate({
            path: "products.productId",
            populate: { path: "colorFamily.value", model: "Color" },
          })
          .populate({
            path: "products.productId",
            populate: {
              path: "subCategory",
              model: "SubCategory",
              populate: { path: "category", model: "MainCategory" },
            },
          });

        if (collectionProducts) {
          await collectionProducts.products.sort(
            (a, b) => a.position - b.position
          );

          collectionProducts = await collectionProducts.products.map(
            (items) => ({ ...items.productId._doc, promo: items.discount })
          );

          load = await load.filter((items) => {
            const index = collectionProducts.findIndex(
              (item) => item.title === items.title
            );

            if (index === -1) {
              return true;
            } else {
              return false;
            }
          });

          load = [...collectionProducts, ...load];
        }
      }

      load = await load.map((items) => {
        if (items.promo) {
          return {
            images: items.images,
            title: items.title,
            mrp: items.mrp,
            fcp: items.fcp,
            td: items.td,
            date: items.createdAt,
            id: items._id,
            sizeList: Object.keys(items.sizeDetails),
            seoData: items.seoData,
            promo: items.promo,
            sizeDetails: items.sizeDetails,
          };
        } else {
          return {
            images: items.images,
            title: items.title,
            mrp: items.mrp,
            fcp: items.fcp,
            td: items.td,
            date: items.createdAt,
            id: items._id,
            sizeList: Object.keys(items.sizeDetails),
            seoData: items.seoData,
            sizeDetails: items.sizeDetails,
          };
        }
      });

      if (sort === "mrp_lh") {
        load.sort((a, b) => parseFloat(a.fcp) - parseFloat(b.fcp));
      } else if (sort === "mrp_hl") {
        load.sort((a, b) => parseFloat(b.fcp) - parseFloat(a.fcp));
      }

      await redisClient.setEx(
        cacheKey,
        3600,
        JSON.stringify({ load: load, totalCount })
      );

      return res.status(200).json({ load: load, totalCount });
    }
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

module.exports.getProduct = async (req, res) => {
  try {
    const load = await Product.findOne({ _id: req.query.productId })
      .populate("productDetails.value")
      .populate("otherDetails.value")
      .populate("colorDetails.value")
      .populate("colorFamily.value")
      .populate("ref")
      .populate({
        path: "subCategory",
        populate: {
          path: "category",
          model: "MainCategory",
        },
      });

    if (load) {
      const subCategory = await SubCategory.findOne({
        _id: load.subCategory[0]._id,
      })
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
        .populate({
          path: "category",
          populate: { path: "subcategories", model: "SubCategory" },
        })

        .exec();

      res.status(200).json({ load, subCategory });
    } else return res.status(404).json({ error: "Product Not found" });
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

module.exports.editProduct = async (req, res) => {
  try {
    const { productData } = req.body;
    const { id, productId } = req.params;
    const load = await Product.findByIdAndUpdate(productId, {
      ...productData,
      productDetails: Object.entries(productData.productDetails).map(
        ([name, value]) => ({ name, value: value.value })
      ),
      otherDetails: Object.entries(productData.otherDetails).map(
        ([name, value]) => ({ name, value: value.value })
      ),
      colorDetails: Object.entries(productData.colorDetails)
        .filter(([name, value]) => {
          if (name !== "COLOR FAMILY") {
            return true;
          } else {
            return false;
          }
        })
        .map(([name, value]) => ({ name, value: value.value })),
      colorFamily: Object.entries(productData.colorDetails)
        .filter(([name, value]) => {
          if (name === "COLOR FAMILY") {
            return true;
          } else {
            return false;
          }
        })
        .map(([name, value]) => value)[0],
      ref: id,
      metaData: productData.metaData,
      subCategory: productData.subCategory,
    });
    const cacheKeys = await redisClient.keys("all_products_*");
    if (cacheKeys.length > 0) {
      await redisClient.del(cacheKeys);
    }

    const product = await Product.findOne({ _id: productId });

    const activityLog = new ActivityLog({
      activityType: "product_edit",
      adminId: req.params.id,
      productId: product._id,
      metadata: {
        product: product,
      },
    });

    await activityLog.save();

    return res.status(200).json({ load: product });
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

module.exports.getAllAttributes = async (req, res) => {
  try {
    const cacheKey = `all_products_attributes_${req.query.category}`;
    const cachedData = await redisClient.get(cacheKey);

    // const cacheKeys = await redisClient.keys("all_products_*");
    // if (cacheKeys.length > 0) {
    //   await redisClient.del(cacheKeys);
    // }

    let minMRP = Infinity;
    let maxMRP = -Infinity;

    if (cachedData) {
      const cachedAttributes = JSON.parse(cachedData);
      return res.status(200).json(cachedAttributes);
    }

    const categoryId = req.query.category;

    let filter = { status: true };

    let dummy = null;

    if (categoryId != "null") {
      dummy = await SubCategory.findById(categoryId);
    }

    if (dummy) {
      filter = {
        category: dummy.category,
        status: true,
      };
    } else {
      if (categoryId != "null") {
        filter = {
          category: categoryId,
          status: true,
        };
      }
    }

    const products = await Product.find(filter).populate(
      "productDetails.value otherDetails.value colorDetails.value colorFamily.value subCategory"
    );

    const result = {};

    if (products.length > 0) {
      products.forEach((product) => {
        [
          "productDetails",
          "otherDetails",
          "colorDetails",
          "colorFamily",
          "subCategory",
        ].forEach((field) => {
          if (product.mrp < minMRP) {
            minMRP = product.mrp;
          }

          if (product.mrp > maxMRP) {
            maxMRP = product.mrp;
          }
          product[field].forEach((detail) => {
            const name =
              field === "subCategory"
                ? "subCategory"
                : field === "colorFamily" || field === "colorDetails"
                ? "Color"
                : detail.name;
            const valueId =
              field === "subCategory"
                ? detail.name.toString()
                : detail.value.value.toString();

            if (!result[name]) {
              result[name] = [];
            }

            const existingAttribute = result[name].find(
              (attr) => attr[valueId]
            );

            if (existingAttribute) {
              // If count exceeds the total number of products, set it to the total number of products
              existingAttribute[valueId].count =
                existingAttribute[valueId].count + 1;
            } else {
              const attribute = {};
              attribute[valueId] = {
                value: field === "subCategory" ? detail._id : detail.value._id,
                state: false,
                count: 1,
              };
              result[name].push(attribute);
            }
          });
        });
      });
    } else {
      await redisClient.setEx(
        cacheKey,
        3600,
        JSON.stringify({ attributes: { subCategory: {} }, minMRP, maxMRP })
      );

      return res.json({ attributes: { subCategory: {} }, minMRP, maxMRP });
    }

    await redisClient.setEx(
      cacheKey,
      3600,
      JSON.stringify({ attributes: result, minMRP, maxMRP })
    );

    res.json({ attributes: result, minMRP, maxMRP });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports.getBanners = async (req, res) => {
  try {
    const { category } = req.query;

    if (category) {
      const subCategory = await SubCategory.findOne({ _id: category });
      if (subCategory) {
        const allCategories = await SubCategory.find({
          category: subCategory.category,
          isSubListed: true,
        });

        return res.send({ load: allCategories });
      } else {
        const allCategories = await SubCategory.find({
          category: category,
          isSubListed: true,
        });
        return res.send({ load: allCategories });
      }
    } else {
      const allCategories = await SubCategory.find({ isListed: true });
      return res.send({ load: allCategories });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports.getProductID = async (req, res) => {
  try {
    const { title } = req.query;

    const titleRegex = new RegExp(`^${title}$`, "i");

    const load = await Product.findOne({ title: titleRegex });

    if (load) {
      return res.status(200).json({ load: load._id });
    }

    return res.status(404).json({ error: "Product Not found" });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports.getCargoryID = async (req, res) => {
  try {
    const { title } = req.query;

    const titleRegex = new RegExp(`^${title}$`, "i");

    const main = await MainCategory.findOne({ name: titleRegex });

    if (main) {
      return res.status(200).json({ load: main });
    }

    const sub = await SubCategory.findOne({ name: titleRegex });

    if (sub) {
      return res.status(200).json({ load: sub });
    }

    return res.status(404).json({ error: "Category Not found" });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports.searchProduct = async (req, res) => {
  try {
    const searchKey = req.query.search;
    let products = await Product.find({
      $or: [
        { title: { $regex: searchKey, $options: "i" } },
        { sku: { $regex: searchKey, $options: "i" } },
      ],
    });

    products = products.slice(0, 10);
    res.send({ load: products });
  } catch (err) {
    res.status(500).send("Error searching products");
  }
};

module.exports.saveAsDraft = async (req, res) => {
  try {
    const { productData, uniqueId } = req.body;

    const { id } = req.params;

    const category = await MainCategory.findOne({
      subcategories: productData.subCategory[0],
    });

    const exist = await Draft.findOne({ uniqueId: uniqueId });
    if (exist) {
      await Draft.findOneAndUpdate(
        { uniqueId },
        {
          $set: {
            ...productData,
            category: category._id,
            productDetails: Object.entries(productData.productDetails).map(
              ([name, value]) => ({ name, value: value.value })
            ),
            otherDetails: Object.entries(productData.otherDetails).map(
              ([name, value]) => ({ name, value: value.value })
            ),
            colorDetails: Object.entries(productData.colorDetails)
              .filter(([name, value]) => {
                if (name !== "COLOR FAMILY") {
                  return true;
                } else {
                  return false;
                }
              })
              .map(([name, value]) => ({ name, value: value.value })),
            colorFamily: Object.entries(productData.colorDetails)
              .filter(([name, value]) => {
                if (name === "COLOR FAMILY") {
                  return true;
                } else {
                  return false;
                }
              })
              .map(([name, value]) => value)[0],
            status: false,
            draft: true,
            ref: id,
            subCategory: productData.subCategory,
            uniqueId: uniqueId,
            metaData: productData.metaData,
          },
        }
      );

      return res.send({ load: "success" });
    }

    const load = await new Draft({
      ...productData,
      category: category._id,
      productDetails: Object.entries(productData.productDetails).map(
        ([name, value]) => ({ name, value: value.value })
      ),
      otherDetails: Object.entries(productData.otherDetails).map(
        ([name, value]) => ({ name, value: value.value })
      ),
      colorDetails: Object.entries(productData.colorDetails)
        .filter(([name, value]) => {
          if (name !== "COLOR FAMILY") {
            return true;
          } else {
            return false;
          }
        })
        .map(([name, value]) => ({ name, value: value.value })),
      colorFamily: Object.entries(productData.colorDetails)
        .filter(([name, value]) => {
          if (name === "COLOR FAMILY") {
            return true;
          } else {
            return false;
          }
        })
        .map(([name, value]) => value)[0],
      status: false,
      draft: true,
      ref: id,
      subCategory: productData.subCategory,
      uniqueId: uniqueId,
      metaData: productData.metaData,
    }).save();
    res.send({ load: "success" });
  } catch (err) {
    res.status(500).send("Error searching products");
  }
};

module.exports.getDrafts = async (req, res) => {
  try {
    let draft = await Draft.find()
      .populate("productDetails.value")
      .populate("otherDetails.value")
      .populate("colorDetails.value")
      .populate("colorFamily.value")
      .populate("ref")
      .populate({
        path: "subCategory",
        populate: {
          path: "category",
          model: "MainCategory",
        },
      })
      .exec();
    draft = draft.map((items) => {
      return {
        ...items._doc,

        id: items._id,
        _id: items._doc,
      };
    });
    res.send({ load: draft, type: "draft" });
  } catch (err) {
    res.status(500).send("Error searching products");
  }
};

///////////////////////////////////////////////////////////////

module.exports.saveProductForQC = async (req, res) => {
  try {
    const { productId, uniqueId } = req.query;
    let product = await Product.findOneAndUpdate(
      { _id: productId },
      { $set: { draft: false } }
    );

    if (product) {
      await Draft.findOneAndDelete({ uniqueId });
    }

    res.send({ load: product, type: "draft" });
  } catch (err) {
    res.status(500).send("Error searching products");
  }
};

module.exports.discardListing = async (req, res) => {
  try {
    const { productId, uniqueId } = req.query;
    let product = await Product.findOneAndDelete({ _id: productId });

    res.send({ load: product, type: "draft" });
  } catch (err) {
    res.status(500).send("Error searching products");
  }
};

module.exports.discardEditListing = async (req, res) => {
  try {
    const { productId, uniqueId } = req.query;

    let product = await Product.findOne({ _id: productId });

    return res.send({ load: product, type: "draft" });
  } catch (err) {
    res.status(500).send("Error searching products");
  }
};

module.exports.getDraftDetails = async (req, res) => {
  try {
    const { draftId } = req.query;

    const load = await Draft.findOne({ _id: draftId })
      .populate("productDetails.value")
      .populate("otherDetails.value")
      .populate("colorDetails.value")
      .populate("colorFamily.value")
      .populate("ref")
      .populate({
        path: "subCategory",
        populate: {
          path: "category",
          model: "MainCategory",
        },
      });

    if (load) {
      const subCategory = await SubCategory.findOne({
        _id: load.subCategory[0]._id,
      })
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
        .populate({
          path: "category",
          populate: { path: "subcategories", model: "SubCategory" },
        })

        .exec();

      res.status(200).json({ load, subCategory });
    }
  } catch (err) {
    res.status(500).send("Error searching products");
  }
};
