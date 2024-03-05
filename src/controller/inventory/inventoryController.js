const { default: mongoose } = require("mongoose");
const SubCategory = require("../../database/categories/subCategorySchema");
const Product = require("../../database/product/productSchema");
const ActivityLog = require("../../database/logs/logSchema");

module.exports.getInventoryCount = async (req, res) => {
  try {
    const { id } = req.params;
    let products = await Product.find({ status: true });

    let activeWithoutPausedSize = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let paused = 0;

    for (const product of products) {
      let hasActiveSize = false;
      let hasLowStock = false;
      let hasOutOfStock = false;
      let hasPaused = false;

      for (const sizeDetail of Object.values(product.sizeDetails)) {
        if (!sizeDetail.paused) {
          hasActiveSize = true;
        }
        if (parseInt(sizeDetail.STOCK) <= 10 && !sizeDetail.paused) {
          hasLowStock = true;
        }
        if (parseInt(sizeDetail.STOCK) === 0 && !sizeDetail.paused) {
          hasOutOfStock = true;
        }
        if (sizeDetail.paused) {
          hasPaused = true;
        }
      }

      if (hasActiveSize) {
        activeWithoutPausedSize++;
      }

      if (hasLowStock) {
        lowStock++;
      }

      if (hasOutOfStock) {
        outOfStock++;
      }

      if (hasPaused) {
        paused++;
      }
    }

    res.status(200).json({
      all: products.length,
      active: activeWithoutPausedSize,
      outOfStock,
      lowStock,
      paused,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getNonPausedProducts = async (req, res) => {
  try {
    const { sortValue, categoryFilter } = req.body;

    const categoryFilterIds = categoryFilter;

    // Build the query
    let query = { status: true };
    if (categoryFilterIds.length > 0) {
      query.subCategory = { $in: categoryFilterIds };
    }

    // Apply sorting
    const sortOptions = { createdAt: sortValue === "new" ? -1 : 1 };

    // Fetch non-paused products with applied filters and sorting
    const nonPausedProducts = await Product.find(query)
      .sort(sortOptions)
      .lean();

    let result = [];
    const filterPausedVariants = (sizeDetails) => {
      const filteredVariants = {};
      for (const size in sizeDetails) {
        if (!sizeDetails[size].paused) {
          filteredVariants[size] = sizeDetails[size];
        }
      }
      return filteredVariants;
    };

    for (const product of nonPausedProducts) {
      let hasPaused = [];

      for (const sizeDetail of Object.values(product.sizeDetails)) {
        if (sizeDetail.paused) {
          hasPaused.push(true);
        } else {
          hasPaused.push(false);
        }
      }
      product.sizeDetails = filterPausedVariants(product.sizeDetails);

      if (hasPaused.findIndex((item) => item === false) !== -1) {
        result.push(product);
      }
    }

    res.status(200).json({
      load: result.map((items) => ({ ...items, id: items._id })),
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.updateStock = async (req, res) => {
  try {
    const { size, productId, stock } = req.body;

    const product = await Product.findOneAndUpdate(
      { _id: productId },
      { $set: { [`sizeDetails.${size}.STOCK`]: stock.toString() } }
    );

    if (!product) {
      return res.status(404).json({ message: "Failed" });
    }

    if (stock != product.sizeDetails[size].STOCK) {
      const logs = new ActivityLog({
        activityType: "inventory",
        productId: productId,
        adminId: req.params.id,
        metadata: {
          size,
          oldval: product.sizeDetails[size].STOCK,
          newVal: stock,
        },
      });

      await logs.save();
    }

    return res.send("Stock updated");
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.pauseVarient = async (req, res) => {
  try {
    let { productId, size, paused } = req.body;
    const product = await Product.findOneAndUpdate(
      { _id: productId },
      { $set: { [`sizeDetails.${size}.paused`]: paused ? false : true } }
    );
    if (!product) {
      return res.status(404).json({ message: "Failed" });
    }

    const logs = new ActivityLog({
      activityType: "inventory_pause",
      productId: productId,
      adminId: req.params.id,
      metadata: {
        isPaued : paused ? false : true,
        size
      },
    });

    await logs.save();

    return res.send("updated");
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getLowStockProducts = async (req, res) => {
  try {
    const { sortValue, categoryFilter } = req.body;

    const categoryFilterIds = categoryFilter;

    // Build the query
    let query = { status: true };
    if (categoryFilterIds.length > 0) {
      query.subCategory = { $in: categoryFilterIds };
    }

    // Apply sorting
    const sortOptions = { createdAt: sortValue === "new" ? -1 : 1 };

    // Fetch non-paused products with applied filters and sorting
    const nonPausedProducts = await Product.find(query)
      .sort(sortOptions)
      .lean();

    let result = [];
    const filterPausedVariants = (sizeDetails) => {
      const filteredVariants = {};
      for (const size in sizeDetails) {
        if (!sizeDetails[size].paused) {
          filteredVariants[size] = sizeDetails[size];
        }
      }
      return filteredVariants;
    };

    const filterLowVariants = (sizeDetails) => {
      const filteredVariants = {};
      for (const size in sizeDetails) {
        if (sizeDetails[size].STOCK <= 10) {
          filteredVariants[size] = sizeDetails[size];
        }
      }
      return filteredVariants;
    };

    for (const product of nonPausedProducts) {
      let hasPaused = [];
      let hasLowStock = [];

      for (const sizeDetail of Object.values(product.sizeDetails)) {
        if (sizeDetail.paused) {
          hasPaused.push(true);
        } else {
          hasPaused.push(false);
        }
        if (sizeDetail.STOCK <= 10) {
          hasLowStock.push(true);
        } else {
          hasLowStock.push(false);
        }
      }

      product.sizeDetails = filterPausedVariants(product.sizeDetails);
      product.sizeDetails = filterLowVariants(product.sizeDetails);

      // Check if product has size variants
      if (Object.keys(product.sizeDetails).length > 0) {
        if (
          hasPaused.findIndex((item) => item === false) !== -1 &&
          hasLowStock.findIndex((item) => item === true) !== -1
        ) {
          result.push(product);
        }
      }
    }

    res.status(200).json({
      load: result.map((items) => ({ ...items, id: items._id })),
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getOutOfStockProducts = async (req, res) => {
  try {
    const { sortValue, categoryFilter } = req.body;

    const categoryFilterIds = categoryFilter;

    // Build the query
    let query = { status: true };
    if (categoryFilterIds.length > 0) {
      query.subCategory = { $in: categoryFilterIds };
    }

    // Apply sorting
    const sortOptions = { createdAt: sortValue === "new" ? -1 : 1 };

    // Fetch non-paused products with applied filters and sorting
    const nonPausedProducts = await Product.find(query)
      .sort(sortOptions)
      .lean();

    let result = [];
    const filterPausedVariants = (sizeDetails) => {
      const filteredVariants = {};
      for (const size in sizeDetails) {
        if (!sizeDetails[size].paused) {
          filteredVariants[size] = sizeDetails[size];
        }
      }
      return filteredVariants;
    };

    const filterLowVariants = (sizeDetails) => {
      const filteredVariants = {};
      for (const size in sizeDetails) {
        if (sizeDetails[size].STOCK == 0) {
          filteredVariants[size] = sizeDetails[size];
        }
      }
      return filteredVariants;
    };

    for (const product of nonPausedProducts) {
      let hasPaused = [];
      let hasLowStock = [];

      for (const sizeDetail of Object.values(product.sizeDetails)) {
        if (sizeDetail.paused) {
          hasPaused.push(true);
        } else {
          hasPaused.push(false);
        }
        if (sizeDetail.STOCK == 0) {
          hasLowStock.push(true);
        } else {
          hasLowStock.push(false);
        }
      }

      product.sizeDetails = filterPausedVariants(product.sizeDetails);
      product.sizeDetails = filterLowVariants(product.sizeDetails);

      // Check if product has size variants
      if (Object.keys(product.sizeDetails).length > 0) {
        if (
          hasPaused.findIndex((item) => item === false) !== -1 &&
          hasLowStock.findIndex((item) => item === true) !== -1
        ) {
          result.push(product);
        }
      }
    }

    res.status(200).json({
      load: result.map((items) => ({ ...items, id: items._id })),
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getPausedStocks = async (req, res) => {
  try {
    const { sortValue, categoryFilter } = req.body;

    const categoryFilterIds = categoryFilter;

    // Build the query
    let query = { status: true };
    if (categoryFilterIds.length > 0) {
      query.subCategory = { $in: categoryFilterIds };
    }

    // Apply sorting
    const sortOptions = { createdAt: sortValue === "new" ? -1 : 1 };

    // Fetch non-paused products with applied filters and sorting
    const nonPausedProducts = await Product.find(query)
      .sort(sortOptions)
      .lean();

    let result = [];
    const filterPausedVariants = (sizeDetails) => {
      const filteredVariants = {};
      for (const size in sizeDetails) {
        if (sizeDetails[size].paused) {
          filteredVariants[size] = sizeDetails[size];
        }
      }
      return filteredVariants;
    };

    for (const product of nonPausedProducts) {
      let hasPaused = [];

      for (const sizeDetail of Object.values(product.sizeDetails)) {
        if (sizeDetail.paused) {
          hasPaused.push(true);
        } else {
          hasPaused.push(false);
        }
      }

      product.sizeDetails = filterPausedVariants(product.sizeDetails);

      if (hasPaused.findIndex((item) => item === true) !== -1) {
        result.push(product);
      }
    }

    res.status(200).json({
      load: result.map((items) => ({ ...items, id: items._id })),
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getAllSubcategory = async (req, res) => {
  try {
    const { search } = req.query;

    const result = await SubCategory.find({
      name: {
        $regex: search,
        $options: "i",
      },
    });

    res.status(200).json({
      load: result,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};
