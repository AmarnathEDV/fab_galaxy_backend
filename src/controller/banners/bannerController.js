const Collection = require("../../database/collections/collectionSchema.js");

const Banner = require("../../database/banner/bannerSchema.js");
const OtherBanner = require("../../database/banner/otherBannerSchema.js");
const SubCategory = require("../../database/categories/subCategorySchema.js");
const Product = require("../../database/product/productSchema.js");
const Promotion = require("../../database/promotion/promotionSchema.js");
const FAQ = require("../../database/faq/faqSchema.js");
const Rating = require("../../database/rating/ratingSchema.js");
const Occasion = require("../../database/occasion/occasionSchema.js");
const MainCategory = require("../../database/categories/mainCategorySchema.js");

module.exports.createMainBanner = async (req, res) => {
  try {
    const { imageSM, imageLG, name, url } = req.body;
    const { id } = req.params;

    const newBanner = new Banner({
      imageSM,
      imageLG,
      name,
      ref: id,
      url,
    });

    await newBanner.save();
    if (newBanner) {
      return res.status(200).json({
        success: true,
        message: "Banner created successfully",
        load: newBanner,
      });
    }

    return res.status(500).json({ message: "Something went wrong" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      error: "Internal Server Error",
    });
  }
};

module.exports.getAllBanner = async (req, res) => {
  try {
    let banners = await Banner.find();

    banners = banners.map((item) => {
      return {
        ...item._doc,
        id: item._doc._id,
        _id: { ...item._doc, id: item._id.toString() },
      };
    });

    const categoryBanners = await SubCategory.find({ isHomeListed: true }).sort(
      { updatedAt: 1 }
    );

    const mainCatBanner = await MainCategory.find({ isHomeListed: true }).sort({
      updatedAt: 1,
    });

    categoryBanners.push(...mainCatBanner);

    categoryBanners.sort((a, b) => {
      return b.updatedAt - a.updatedAt; // Descending order
    });

    let collectionBanners = await Collection.findOne({ name: "New Arrivals" })
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

    collectionBanners &&
      collectionBanners.products.sort((a, b) => a.position - b.position); // Sort products array within each collection

    const limit =
      collectionBanners && collectionBanners?.products?.length <= 16
        ? 16 - collectionBanners.products.length
        : 16;

    let allProduct = await Product.find({
      status: true,
    })
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
      .limit(limit);

    if (collectionBanners) {
      collectionBanners = collectionBanners.products.map(
        (items) => items.productId
      );
    }

    allProduct = allProduct.filter((items) => {
      const index = collectionBanners
        ? collectionBanners.findIndex(
            (item) => item._id.toString() === items._id.toString()
          )
        : -1;

      if (index === -1) {
        return true;
      } else {
        return false;
      }
    });

    let newArrivals = collectionBanners
      ? [...collectionBanners, ...allProduct]
      : [...allProduct];

    newArrivals = await newArrivals.map((items) => ({
      images: items.images,
      title: items.title,
      mrp: items.mrp,
      fcp: items.fcp,
      td: items.td,
      date: items.createdAt,
      id: items._id,
      sizeList: Object.keys(items.sizeDetails),
      sizeDetails: items.sizeDetails,
    }));

    const now = new Date();
    let promoBanners = await Promotion.findOne({
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

    promoBanners &&
      promoBanners.products.sort((a, b) => a.position - b.position); // Sort products array within each collection

    const limit2 =
      promoBanners && promoBanners?.products?.length <= 16
        ? 16 - promoBanners.products?.length
        : 0;

    let allProduct1 = await Product.find({
      status: true,
      td: { $gt: 60 },
    })
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
      .limit(limit2);

    promoBanners =
      promoBanners &&
      (await promoBanners.products.map((items) => ({
        ...items.productId._doc,
        promo: items.discount,
      })));

    if (promoBanners && promoBanners.products) {
      allProduct1 = await allProduct1.filter((items) => {
        const index =
          promoBanners &&
          promoBanners.findIndex((item) => item.title === items.title);

        if (index === -1) {
          return true;
        } else {
          return false;
        }
      });
    }

    let promoProducts = promoBanners
      ? [...promoBanners, ...allProduct1]
      : [...allProduct1];

    promoProducts = await promoProducts.map((items) => {
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
          sizeDetails: items.sizeDetails,
          promo: items.promo,
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
          sizeDetails: items.sizeDetails,
        };
      }
    });

    const otherBanner = await OtherBanner.find();

    const FAQs = await FAQ.find().sort({ position: 1 }).limit(10);

    const categories = await SubCategory.find({});

    let collectionBannersTrending = await Collection.findOne({
      name: "Trending",
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

    collectionBannersTrending &&
      collectionBannersTrending.products.sort(
        (a, b) => a.position - b.position
      ); // Sort products array within each collection

    if (collectionBannersTrending) {
      collectionBannersTrending = collectionBannersTrending.products.map(
        (items, index) => {
          if (index < 4) {
            return items.productId;
          }
        }
      );
    }

    if (collectionBannersTrending.length > 4) {
      collectionBannersTrending = collectionBannersTrending.slice(0, 4); // Keep only the first 4 items
    }

    let trendingCollection = collectionBannersTrending
      ? [...collectionBannersTrending]
      : [];

    trendingCollection = await trendingCollection.map((items) => ({
      images: items.images,
      title: items.title,
      mrp: items.mrp,
      fcp: items.fcp,
      td: items.td,
      date: items.createdAt,
      id: items._id,
      sizeList: Object.keys(items.sizeDetails),
      sizeDetails: items.sizeDetails,
    }));

    const videos = await Product.find(
      { status: true },
      { title: 1, _id: 1, images: 1 }
    );

    const ratings = await Rating.find({}).populate("productId");

    const occasionData = await Occasion.findOne({}).populate("data.name");

    return res.status(200).json({
      success: true,
      load: banners,
      otherBanner,
      categoryBanners,
      newArrivals,
      faqs: FAQs,
      sales: promoProducts,
      categories: categories,
      trendingCollection: trendingCollection ? trendingCollection : [],
      videos,
      ratings,
      occasionData: occasionData.data,
      type: "banner",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      error: "Internal Server Error",
    });
  }
};

module.exports.updateBanner = async (req, res) => {
  try {
    const { id, name, imageLG, imageSM, url } = req.query;
    if (!id) {
      return res.status(404).json({ message: "No id found" });
    }

    if (name) {
      const category = await Banner.findByIdAndUpdate(id, {
        name,
      });
      return res.status(200).json({ category });
    }

    if (imageSM) {
      const category = await Banner.findByIdAndUpdate(id, { imageSM });
      return res.status(200).json({ category });
    }

    if (imageLG) {
      const category = await Banner.findByIdAndUpdate(id, {
        imageLG,
      });
      return res.status(200).json({ category });
    }

    if (url) {
      const category = await Banner.findByIdAndUpdate(id, {
        url,
      });
      return res.status(200).json({ category });
    }

    return res.status(404).json({ message: "Invalid request" });
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

module.exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(404).json({ message: "No id found" });
    }

    let banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ message: "This banner does not exist." });
    }
    await Banner.findByIdAndDelete(id);
    return res.status(200).json({ message: "Deleted the banner" });
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

module.exports.createOtherBanner = async (req, res) => {
  try {
    const { imageSM, imageLG, name, url } = req.body;
    const { id } = req.params;

    const newBanner = new OtherBanner({
      imageSM,
      imageLG,
      name,
      ref: id,
      url,
    });

    await newBanner.save();
    if (newBanner) {
      return res.status(200).json({
        success: true,
        message: "Banner created successfully",
        load: newBanner,
      });
    }

    return res.status(500).json({ message: "Something went wrong" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      error: "Internal Server Error",
    });
  }
};

module.exports.getAllOtherBanner = async (req, res) => {
  try {
    let banners = await OtherBanner.find();

    banners = banners.map((item) => {
      return {
        ...item._doc,
        id: item._doc._id,
        _id: { ...item._doc, id: item._id.toString() },
      };
    });

    if (banners) {
      return res.status(200).json({
        success: true,
        load: banners,
        type: "banner",
      });
    }

    return res.status(500).json({ message: "Something went wrong" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      error: "Internal Server Error",
    });
  }
};

module.exports.updateOtherBanner = async (req, res) => {
  try {
    const { imageLG, imageSM, url, status } = req.body;
    const { id } = req.query;

    console.log(req.body);

    if (!id) {
      return res.status(404).json({ message: "No id found" });
    }

    if (!imageSM) {
      const category = await OtherBanner.findByIdAndUpdate(id, {
        isActive: status,
      });
      return res.status(200).json({ category });
    }

    if (imageLG && imageSM && url) {
      const category = await OtherBanner.findByIdAndUpdate(id, {
        imageLG,
        imageSM,
        url,
      });
      return res.status(200).json({ category });
    }

    return res.status(404).json({ message: "Invalid request" });
  } catch (err) {
    res.status(500).json({ error: err });
  }
};
