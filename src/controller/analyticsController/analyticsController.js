const PageVisit = require("../../database/analytics/pageVisitSchema.js");
const Session = require("../../database/analytics/sessionSchema.js");
const MainCategory = require("../../database/categories/mainCategorySchema.js");
const SubCategory = require("../../database/categories/subCategorySchema.js");
const ActivityLog = require("../../database/logSchema/logsSchema.js");
const Order = require("../../database/orders/orderSchema.js");
const Product = require("../../database/product/productSchema.js");
const Rating = require("../../database/rating/ratingSchema.js");
const User = require("../../database/user/userSchema.js");

const getOrderAnalyticsData = async () => {
  try {
    // Get all orders
    const orders = await Order.find();

    // Initialize variables for analytics
    let totalOrders = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let returnedOrders = 0;
    let pendingOrders = 0;
    let shippedOrders = 0;
    let deliveredOrders = 0;

    // Iterate through orders to calculate analytics
    orders.forEach((order) => {
      totalOrders++;

      // Iterate through each sub-order (product) within the order
      order.products.forEach((subOrder) => {
        switch (subOrder.status) {
          case "completed":
            completedOrders++;
            break;
          case "cancelled":
            cancelledOrders++;
            break;
          case "returned":
            returnedOrders++;
            break;
          case "pending":
            pendingOrders++;
            break;
          case "shipped":
            shippedOrders++;
            break;
          case "Delivered":
            // Consider the sub-order as delivered only if it's not returned
            if (
              !subOrder.isReturnAccepted ||
              subOrder.returnStatus !== "Delivered"
            ) {
              deliveredOrders++;
            }
            break;
          default:
            break;
        }
      });
    });

    // Calculate percentage values
    const calculatePercentage = (count) =>
      ((count / totalOrders) * 100).toFixed(2);

    // Prepare analytics data with percentage values
    const analyticsData = {
      totalOrders,
      completedOrders,
      cancelledOrders,
      returnedOrders,
      pendingOrders,
      shippedOrders,
      deliveredOrders,
      percentageCompleted: calculatePercentage(completedOrders),
      percentageCancelled: calculatePercentage(cancelledOrders),
      percentageReturned: calculatePercentage(returnedOrders),
      percentagePending: calculatePercentage(pendingOrders),
      percentageShipped: calculatePercentage(shippedOrders),
      percentageDelivered: calculatePercentage(deliveredOrders),
    };

    return analyticsData;
  } catch (error) {
    console.error("Error fetching order analytics data:", error);
    throw error;
  }
};

const getTopSubcategoriesWithSales = async () => {
  try {
    const currentDate = new Date();

    // Adjust the current date to point to the previous week
    currentDate.setDate(currentDate.getDate() - 7);

    // Calculate the start of the previous week
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Set to the start of the previous week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0); // Set time to midnight

    // Calculate the end of the previous week
    const endOfWeek = new Date(currentDate);
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay())); // Set to the end of the previous week (Saturday)
    endOfWeek.setHours(23, 59, 59, 999); // Set time to end of day

    // 2. Aggregate orders to calculate sales for each product
    const productSales = await Order.aggregate([
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productId",
          totalSales: { $sum: "$products.quantity" },
        },
      },
    ]);

    // 3. Group products by subcategory to calculate total sales and sales amount for each subcategory within the current week
    const subcategorySales = await Product.aggregate([
      { $unwind: "$subCategory" },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "products.productId",
          as: "orders",
        },
      },
      { $unwind: "$orders" },
      { $unwind: "$orders.products" },
      {
        $match: {
          "orders.products.productId": {
            $in: productSales.map((product) => product._id),
          },
          "orders.date": { $gte: startOfWeek, $lte: endOfWeek }, // Filter orders for the current week
        },
      },
      {
        $group: {
          _id: "$subCategory",
          totalSales: { $sum: "$orders.products.quantity" },
          totalAmount: {
            $sum: {
              $multiply: [
                "$orders.products.quantity",
                "$orders.products.productValue",
              ],
            },
          },
        },
      },
    ]);

    // 4. Sort subcategories based on total sales and limit to the top 3
    const topSubcategories = subcategorySales
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 3);

    // 5. For each top subcategory, find the top-selling products and their sales count
    const topSubcategoriesWithProducts = await Promise.all(
      topSubcategories.map(async (subcategory) => {
        const subCategoryDetails = await SubCategory.findById(
          subcategory._id
        ).lean();
        const products = await Product.find({ subCategory: subcategory._id })
          .limit(3)
          .select("title images")
          .lean();
        return {
          subCatId: subcategory._id,
          subCatName: subCategoryDetails.name,
          totalSales: subcategory.totalSales,
          totalAmount: subcategory.totalAmount,
          products: products.map((product) => {
            const productSale = productSales.find((sale) =>
              sale._id.equals(product._id)
            );
            return {
              title: product.title,
              images: product.images,
              salesCount: productSale ? productSale.totalSales : 0,
            };
          }),
        };
      })
    );

    // 6. Assemble the final result structure
    return topSubcategoriesWithProducts;
  } catch (error) {
    console.error("Error fetching top subcategories with sales:", error);
    throw error;
  }
};

const getTotalProfitsAndTransactions = async () => {
  try {
    const currentDate = new Date();
    const last28Days = new Date(
      currentDate.getTime() - 28 * 24 * 60 * 60 * 1000
    );
    const lastMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      currentDate.getDate()
    );
    const lastYear = new Date(
      currentDate.getFullYear() - 1,
      currentDate.getMonth(),
      currentDate.getDate()
    );

    // 1. Calculate profits and transactions for the last 28 days
    const last28DaysProfits = await Order.aggregate([
      {
        $match: { "products.status": "Delivered", date: { $gte: last28Days } },
      },
      {
        $group: {
          _id: null,
          totalProfits: { $sum: { $sum: "$products.productValue" } },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    // 2. Calculate profits and transactions for the last month
    const lastMonthProfits = await Order.aggregate([
      { $match: { "products.status": "Delivered", date: { $gte: lastMonth } } },
      {
        $group: {
          _id: null,
          totalProfits: { $sum: { $sum: "$products.productValue" } },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    // 3. Calculate profits and transactions for the last year
    const lastYearProfits = await Order.aggregate([
      { $match: { "products.status": "Delivered", date: { $gte: lastYear } } },
      {
        $group: {
          _id: null,
          totalProfits: { $sum: { $sum: "$products.productValue" } },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    // 4. Assemble the final result structure
    return {
      last28Days: {
        totalProfits:
          last28DaysProfits.length > 0 ? last28DaysProfits[0].totalProfits : 0,
        totalTransactions:
          last28DaysProfits.length > 0
            ? last28DaysProfits[0].totalTransactions
            : 0,
      },
      lastMonth: {
        totalProfits:
          lastMonthProfits.length > 0 ? lastMonthProfits[0].totalProfits : 0,
        totalTransactions:
          lastMonthProfits.length > 0
            ? lastMonthProfits[0].totalTransactions
            : 0,
      },
      lastYear: {
        totalProfits:
          lastYearProfits.length > 0 ? lastYearProfits[0].totalProfits : 0,
        totalTransactions:
          lastYearProfits.length > 0 ? lastYearProfits[0].totalTransactions : 0,
      },
    };
  } catch (error) {
    console.error("Error fetching total profits and transactions:", error);
    throw error;
  }
};

const getTotalSalesThisMonth = async () => {
  try {
    const currentDate = new Date();
    const currentMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const nextMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      1
    );

    // Calculate total sales for the current month
    const totalSalesThisMonth = await Order.aggregate([
      { $unwind: "$products" },
      { $match: { "products.status": "Delivered", date: { $gte: currentMonth, $lt: nextMonth } } },
      { $group: { _id: null, totalSales: { $sum: "$products.productValue" } } },
    ]);

    // Extract the total sales from the aggregation result
    const totalSales =
      totalSalesThisMonth.length > 0 ? totalSalesThisMonth[0].totalSales : 0;

    return totalSales;
  } catch (error) {
    console.error("Error fetching total sales this month:", error);
    throw error;
  }
};


const getNewUserCounts = async () => {
  try {
    const currentDate = new Date();
    const last28Days = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() - 28
    );
    const lastMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      currentDate.getDate()
    );
    const lastYear = new Date(
      currentDate.getFullYear() - 1,
      currentDate.getMonth(),
      currentDate.getDate()
    );

    // Count users who joined in the last 28 days
    const newUserCountLast28Days = await User.countDocuments({
      createdAt: { $gte: last28Days },
    });

    // Count users who joined last month
    const newUserCountLastMonth = await User.countDocuments({
      createdAt: { $gte: lastMonth, $lt: currentDate },
    });

    // Count users who joined last year
    const newUserCountLastYear = await User.countDocuments({
      createdAt: { $gte: lastYear, $lt: currentDate },
    });

    return {
      last28Days: newUserCountLast28Days,
      lastMonth: newUserCountLastMonth,
      lastYear: newUserCountLastYear,
    };
  } catch (error) {
    console.error("Error fetching new user counts:", error);
    throw error;
  }
};

const getTotalOverallSalesData = async () => {
  try {
    const totalSalesData = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$finalPrice" }, // Assuming 'finalPrice' is the field representing the sales amount in each order document
          totalSales: { $sum: 1 }, // Count the number of documents in the group
        },
      },
    ]);

    if (totalSalesData.length > 0) {
      return {
        totalAmount: totalSalesData[0].totalAmount,
        totalSales: totalSalesData[0].totalSales,
      };
    } else {
      return {
        totalAmount: 0,
        totalSales: 0,
      };
    }
  } catch (error) {
    console.error("Error calculating total overall sales data:", error);
    throw error;
  }
};

const getSalesAmountPerDay = async () => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const salesData = await Order.aggregate([
      {
        $match: {
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: "$date" },
          totalAmount: { $sum: "$finalPrice" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const salesAmountPerDay = Array.from(
      { length: endOfMonth.getDate() },
      (_, index) => {
        const dayData = salesData.find((data) => data._id === index + 1);
        return dayData ? dayData.totalAmount : 0;
      }
    );

    return salesAmountPerDay;
  } catch (error) {
    console.error("Error fetching sales amount per day:", error);
    throw error;
  }
};

module.exports.getAllAnalytics = async (req, res) => {
  try {
    const totalSessions = await Session.countDocuments();

    // Get total number of mobile sessions
    const totalMobileSessions = await Session.countDocuments({
      isMobile: true,
    });

    // Get total number of desktop sessions
    const totalDesktopSessions = await Session.countDocuments({
      isMobile: false,
    });

    let sessions = {
      totalSessions: totalSessions ? totalSessions : 0,
      totalMobileSessions: totalMobileSessions ? totalMobileSessions : 0,
      totalDesktopSessions: totalDesktopSessions ? totalDesktopSessions : 0,
    };

    const users = await User.find({});

    const products = await Product.find({ status: true }).countDocuments();

    const pageViews = await PageVisit.aggregate([
      {
        $project: {
          _id: 0,
          category: {
            $cond: {
              if: {
                $eq: [{ $substr: ["$pathname", 0, 16] }, "/product-details"],
              },
              then: "product-details",
              else: "products",
            },
          },
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          count: 1,
        },
      },
    ]);

    const productViews = await Product.aggregate([
      {
        $project: {
          _id: 0,
          title: 1,
          totalViews: {
            $cond: {
              if: { $isArray: "$views" },
              then: { $size: "$views" },
              else: 0, // or any other default value or treatment for missing/non-array fields
            },
          },
        },
      },
    ]);

    // Get total views for main categories
    const mainCategoryViews = await MainCategory.aggregate([
      {
        $project: {
          _id: 0,
          name: 1,
          totalViews: {
            $cond: {
              if: { $isArray: "$views" },
              then: { $size: "$views" },
              else: 0, // or any other default value or treatment for missing/non-array fields
            },
          },
        },
      },
    ]);

    // Get total views for subcategories
    const subCategoryViews = await SubCategory.aggregate([
      {
        $project: {
          _id: 0,
          name: 1,
          totalViews: {
            $cond: {
              if: { $isArray: "$views" },
              then: { $size: "$views" },
              else: 0, // or any other default value or treatment for missing/non-array fields
            },
          },
        },
      },
    ]);

    const orderAnalytics = await getOrderAnalyticsData();

    const currentTime = Date.now();
    const sessionTimeout = 15 * 60 * 1000; // 15 minutes in milliseconds

    // Query the database or in-memory storage to count active sessions
    const activeUsers = await Session.countDocuments({
      lastActivity: { $gt: currentTime - sessionTimeout },
    });

    const ratings = await Rating.find({});

    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const sessionsByDay = await Session.aggregate([
      {
        $project: {
          dayOfWeek: { $dayOfWeek: "$createdAt" },
        },
      },
      {
        $facet: {
          sessionsByDay: [
            {
              $group: {
                _id: "$dayOfWeek",
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                dayOfWeek: {
                  $switch: {
                    branches: daysOfWeek.map((day, index) => ({
                      case: { $eq: ["$_id", index + 1] },
                      then: day,
                    })),
                    default: "Unknown",
                  },
                },
                count: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$sessionsByDay",
      },
      {
        $replaceRoot: { newRoot: "$sessionsByDay" },
      },
      {
        $addFields: {
          count: { $ifNull: ["$count", 0] },
        },
      },
    ]);

    let subCatSalesReport = await getTopSubcategoriesWithSales();

    let profitReport = await getTotalProfitsAndTransactions();

    let totalSalesThisMonth = await getTotalSalesThisMonth();

    let newUserCount = await getNewUserCounts();

    let totalProfits = await getTotalOverallSalesData();

    let salesMonthChartData = await getSalesAmountPerDay();

    let activityLogs = await ActivityLog.find({})
      .populate("adminId")
      .populate("productId");

    console.log(subCatSalesReport);

    res.status(200).json({
      sessions,
      pageViews,
      productViews,
      mainCategoryViews,
      subCategoryViews,
      orderAnalytics,
      activeUsers,
      users,
      productsCount: products,
      ratings,
      sessionsByDay,
      subCatSalesReport,
      profitReport,
      totalSalesThisMonth,
      newUserCount,
      totalProfits,
      salesMonthChartData,
      activityLogs,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.toString() });
  }
};

module.exports.getActivityLogs = async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const pageSize = 10;
    const skip = (page - 1) * pageSize;

    // Fetch activity logs from the database, skipping the specified number of documents

    const totalCount = await ActivityLog.find({}).countDocuments();

    const logs = await ActivityLog.find()
      .populate("adminId")
      .populate("productId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    res.json({ activityLog: logs, totalCount });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
