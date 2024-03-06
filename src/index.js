require("./database/db.js");
require("./scheduler/paymentCheckScheduler.js");
require("./scheduler/shipmentTrackingScheduler.js");

const express = require("express");
const session = require("express-session");
const app = express();
const crypto = require("crypto");

const cors = require("cors");

const cookieParser = require("cookie-parser");

const bodyParser = require("body-parser");

app.use(express.static(__dirname + "/public"));
const compression = require("compression");

app.use(cookieParser());

app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next();
  } else {
    bodyParser.json()(req, res, next);
  }
});

// app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: [
      "http://192.168.29.125:3000",
      "http://192.168.29.125:3001",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3005",
      "https://mfz63x5d-3001.inc1.devtunnels.ms",
      "https://mfz63x5d-3001.inc1.devtunnels.ms/",
      "https://fab-galaxy-testing.netlify.app",
      "https://mfz63x5d-3000.inc1.devtunnels.ms",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

const generateSessionId = () => {
  return crypto.randomBytes(16).toString("hex"); // Generate a 32-character hexadecimal string (16 bytes)
};

app.use(
  session({
    secret: "secret-key-value-anything",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true,
      maxAge: 3600000, // 1hours validity for reference
      sameSite : "none"
    },
    genid: function (req) {
      if (req.headers["x-no-session"]) {
        return null;
      }

      if (req.path === "/api/v1/user-session") {
        return generateSessionId();
      } else {
        return null;
      }
    },
  })
);

const destroyInactiveSessions = async (req, res, next) => {
  try {
    const sessionId = req.session.id;

    // Find the session in the database
    const sessionData = await Session.findOne({ sessionId });
    if (!sessionData) {
      // Session not found, continue with the request
      return next();
    }

    // Check if the session has been inactive for more than 15 minutes
    const lastActivityTime = new Date(sessionData.lastActivity);
    const currentTime = new Date();
    const fifteenMinutesInMs = 15 * 60 * 1000; // 15 minutes in milliseconds

    if (currentTime - lastActivityTime > fifteenMinutesInMs) {
      // Session has been inactive for more than 15 minutes, destroy it
      req.session.destroy();
    }

    next();
  } catch (error) {
    console.error("Error destroying inactive session:", error);
    next(error);
  }
};

// Add the middleware to destroy inactive sessions
app.use(destroyInactiveSessions);

app.post("/api/v1/user-session", async (req, res) => {
  let { pathname } = req.body;

  console.log(pathname);

  const sessionId = req.session.id;

  try {
    const userAgent = req.headers["user-agent"];
    const isMobile = /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile/.test(
      userAgent
    );

    console.log(isMobile);
    // Log session
    const existingSession = await Session.findOne({ sessionId });

    if (!existingSession) {
      // Log session
      const session = new Session({
        sessionId,
        lastActivity: new Date(),
        isMobile,
      });

      await session.save();
      console.log("New session logged:", sessionId);
    }

    if (existingSession) {
      existingSession.isMobile = isMobile;
      await existingSession.save();
    }

    // Log page visit
    const existingPageVisit = await PageVisit.findOne({ sessionId, pathname });
    if (!existingPageVisit) {
      // Log page visit
      if (pathname === "/") {
        pathname = "home";
      }
      const pageVisit = new PageVisit({ sessionId, pathname });
      await pageVisit.save();
      console.log("New page visit logged:", sessionId, pathname);
    }

    console.log("Session and page visit logged:", sessionId, pathname);

    // Update products if the visited page is a product details page
    const productDetailsRegex = /\/product-details\/(.+)/;
    if (productDetailsRegex.test(pathname)) {
      const productName = pathname
        .match(productDetailsRegex)[1]
        .replace(/-/g, " ");
      const titleRegex = new RegExp(`^${productName}$`, "i");
      const product = await Product.findOneAndUpdate(
        { title: titleRegex },
        { $addToSet: { views: { sessionId: sessionId } } },
        { new: true }
      );

      if (!product) {
        console.log("Product not found:", productName);
      } else {
        console.log("Product updated with session ID:", product);
      }
    }

    // Update categories and subcategories if the visited page is /products
    const productsPageRegex = /^\/products(\/.*)?$/;
    if (productsPageRegex.test(pathname)) {
      const categoryName = pathname
        .match(/^\/products\/(.+)/)[1]
        .replace(/-/g, " ");
      console.log(categoryName);
      const titleRegex = new RegExp(`^${categoryName}$`, "i");
      const category = await MainCategory.findOneAndUpdate(
        { name: titleRegex },
        { $addToSet: { views: { sessionId: sessionId } } },
        { new: true }
      );

      if (!category) {
        console.log("Category not found:", categoryName);
      } else {
        console.log("Category updated with session ID:", category);
      }
    }

    const productsPageRegex2 = /^\/products(\/.*)?$/;
    if (productsPageRegex2.test(pathname)) {
      const categoryName = pathname
        .match(/^\/products\/(.+)/)[1]
        .replace(/-/g, " ");

      console.log(categoryName);
      const titleRegex = new RegExp(`^${categoryName}$`, "i");
      const category = await SubCategory.findOneAndUpdate(
        { name: titleRegex },
        { $addToSet: { views: { sessionId: sessionId } } },
        { new: true }
      );

      if (!category) {
        console.log("Category not found:", categoryName);
      } else {
        console.log("Category updated with session ID:", category);
      }
    }

    res.send("Success");
  } catch (error) {
    console.error(
      "Error logging session, page visit, or updating product, category, or subcategory:",
      error
    );
    res.status(500).send("Internal Server Error");
  }
});

const adminAuthRoutes = require("./routes/adminRoutes/adminAuthRoutes.js");
const categoryRoutes = require("./routes/categoryRoutes/categoryRoutes.js");
const productListing = require("./routes/productRoutes/productLisiting.js");
const uploadFileRoute = require("./routes/fileUploadRoutes/uploadFileRoute.js");
const userAuthRoutes = require("./routes/userRoutes/userAuthRoutes.js");
const wishlistRoutes = require("./routes/wishlist/wishlistRoutes.js");
const cartRoutes = require("./routes/cartRoutes/cartRoutes.js");
const bannerRoutes = require("./routes/banners/bannerRoutes.js");
const collectionRoutes = require("./routes/collection/collectionRoutes.js");
const promotionRoutes = require("./routes/promotions/promotionRoutes.js");
const checkoutRouter = require("./routes/checkout/checkoutRouter.js");
const paymentRouter = require("./routes/payments/paymentRoutes.js");
const orderController = require("./routes/orderRoutes/orderRoutes.js");
const faqController = require("./routes/faqRoutes/faqRoutes.js");
const inventoryRoutes = require("./routes/inventory/inventoryRoutes.js");
const orderTrackingController = require("./routes/orderTracking/orderTrackingRoute.js");
const policyRouter = require("./routes/policyRoutes/policyRoutes.js");
const contactRequestRouter = require("./routes/contactRequestRoutes/contactRequestRoutes.js");
const reportRoutes = require("./routes/reports/reportRoutes.js");
const occasionRoutes = require("./routes/ocassionRoutes/ocassionRoutes.js");
const analyticsRoutes = require("./routes/analyticsRoutes/analyticsRoutes.js");

const Product = require("./database/product/productSchema.js");
const Value = require("./database/product/valuesSchema.js");
const SubCategory = require("./database/categories/subCategorySchema.js");
const Attribute = require("./database/attributes/attributeSchema.js");
const MainCategory = require("./database/categories/mainCategorySchema.js");
const { default: mongoose } = require("mongoose");
const Color = require("./database/product/colorSchema.js");
const ColorAttribute = require("./database/attributes/colorAttributeSchema.js");
const redisClient = require("./redis/redisInstance.js");
const {
  checkPincodeAvailablilty,
} = require("./controller/orders/orderController.js");
const Order = require("./database/orders/orderSchema.js");
const { default: axios } = require("axios");
const Session = require("./database/analytics/sessionSchema.js");
const PageVisit = require("./database/analytics/pageVisitSchema.js");

app.use(compression());

app.use("/api/v1/admin", adminAuthRoutes);

app.use("/api/v1/category", categoryRoutes);

app.use("/api/v1/product", productListing);

app.use("/api/v1/upload", uploadFileRoute);

app.use("/api/v1/customer", userAuthRoutes);

app.use("/api/v1/wishlist", wishlistRoutes);

app.use("/api/v1/cart", cartRoutes);

app.use("/api/v1/banner", bannerRoutes);

app.use("/api/v1/collection", collectionRoutes);

app.use("/api/v1/promotion", promotionRoutes);

app.use("/api/v1/checkout", checkoutRouter);

app.use("/api/v1/payments", paymentRouter);

app.use("/api/v1/order", orderController);

app.use("/api/v1/faq", faqController);

app.use("/api/v1/inventory", inventoryRoutes);

app.use("/api/v1/order-tracking", orderTrackingController);

app.use("/api/v1/policy", policyRouter);

app.use("/api/v1/contact-us", contactRequestRouter);

app.use("/api/v1/reports", reportRoutes);

app.use("/api/v1/occasion", occasionRoutes);

app.use("/api/v1/analytics", analyticsRoutes);

const nodemailer = require("nodemailer");
const { orderReceivedEmailTemplate } = require("./Emails/email.js");

const transporter = nodemailer.createTransport({
  host: "s588.sgp8.mysecurecloudhost.com", // Use the hostname or webmail URL
  port: 465, // Use the appropriate port (e.g., 465 for secure)
  secure: true, // Set to true for secure connections
  auth: {
    user: "dev.amarnath@ekkdigitalvyapar.com", // Your email address
    pass: "Amarnath@123", // Your email password
  },
});

// app.get("/", async (req, res) => {
//   try {
//     const order = await Order.findById("65dd8c4ee252c77771f95746").populate(
//       "products.productId"
//     );

//     const emailArray = ["ckramarnath@gmail.com"];

//     // Generate 100 unique email addresses
//     // for (let i = 1; i <= 100; i++) {
//     //   const email = `test${i}@example.com`;
//     //   emailArray.push(email);
//     // }

//     const mailOptions = {
//       from: "dev.amarnath@ekkdigitalvyapar.com",
//       to: emailArray,
//       subject: "Order has been Placed., Testing",
//       html: orderReceivedEmailTemplate(order),
//     };
//     await transporter.sendMail(mailOptions, (error, info) => {
//       console.log(info);
//       if (error) {
//         console.error("Error sending email:", error);
//       } else {
//         console.log("Email sent:", info.response);
//         res.send(info);
//       }
//     });
//     res.send(mailOptions);
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ error });
//   }
// });

// app.get("/", checkPincodeAvailablilty)

// app.get("/", async (req, res) => {
//   // const sub = await SubCategory.updateMany({}, {isListed :false,});
//   let main = await Order.find({ status: "success" });

//   main.map(async (items) => {
//     const orders = await Order.findOne({ _id: items._id });
//     orders.products = orders.products.map((item) => {
//       item.isLabelDownloaded = false;
//       return item;
//     });

//     await orders.save();
//   });

//   res.send({ main });
// });

// app.get("/", async (req, res) => {
//   const query = {
//     productDetails: [
//       "6593b5be8da802c7717692a7",
//       "6593a9dbdc41df7ecdfc9fe1",
//       "65939f9dfcd3ea891c567db4",
//       "65939fedf27dbe3c089d89d6",
//       "6593a087f607f2ee2ef906b2",
//       "6593aa8d5f4ca0ea3ea7fcb2",
//       "6593ab1b975adf56d64e5fff",
//       "6593ab84e6fd763b853864bf",
//       "6593b001f8f8e70cf84de1ec",
//       "6593abbfe786f6ce239d42cf",
//       "6593b03e6fa78276a498ccc5",
//       "6593acfc45e30b29974d44c4",
//     ],
//     otherDetails: [
//       "6593ad657ebb2c5f8f2263f9",
//       "6593ae119d5ce03c6a374fa6",
//       "6593ae3e6004803a85cde941",
//       "6593ae851465fe1ba1267942",
//       "6593aef3e42840c4c1f606b9",
//       "659685712f8ada41678906b8",
//     ],
//     colorDetails: [
//       {
//         name: "DRESS COLOR",
//         value: "659397227f4af2e48737bfc6",
//       },
//       {
//         name: "COLOR FAMILY",
//         value: "659397227f4af2e48737bfc6",
//       },
//     ],
//     sizeDetails: [
//       "SIZE",
//       "STOCK",
//       "BUST SIZE",
//       "WAIST SIZE",
//       "SHOULDER SIZE",
//       "LENGTH",
//     ],
//   };
//   const result = await createSubCategory(
//     "65a1292e4a537583b5b0cc7d",
//     "TOPS & TUNICS",
//     query
//   );

//   // const result = await new MainCategory({
//   //   name: "TOPS & TUNICS",

//   //   description: "TOPS & TUNICS" + " sample description",
//   //   image: "TOPS & TUNICS" + ".png",
//   //   video: "TOPS & TUNICS" + ".mp4",
//   //   companyDetails: {
//   //     address:
//   //       "FAB GALAXY PVT LTD, 2 floor,103-104 Ancillary park, Sachin Apparel Park SEZ., OPP: TULSI HOTEL Surat, Gujarat 394230",
//   //     contact: "+91 1416652270\n",
//   //     country: "INDIA",
//   //     email: "orders@FABGALAXY.com",
//   //     name: "FAB GALAXY PVT LTD, 2 floor,103-104 Ancillary park, Sachin Apparel Park SEZ., OPP: TULSI HOTEL Surat, Gujarat 394230",
//   //   },
//   // }).save();

//   res.send(result);
// });

// const createSubCategory = async (id, name, query) => {
//   const result = await new SubCategory({
//     name: name,
//     category: id,
//     description: name + " sample description",
//     image: name + ".png",
//     video: name + ".mp4",
//     shortName: "TOP",
//     ...query,
//   }).save();

//   return result;
// };

// app.get("/", async (req, res) => {
//   const load = await Product.updateMany(
//     { status: false },
//     { $set: { status: true } }
//   );
//   res.send(load);
// });

// app.get("/", async (req, res) => {
//   // const values = [];
//   // for(let i=0;i<70;i++){
//   //   values.push(i+1)
//   // }
//   // const objIds = await Promise.all(
//   //   values.map(async (value) => {
//   //     let item = await Value.create({ value });
//   //     return item._id;
//   //   })
//   // );
//   // console.log(objIds);
//   // const name = "MODEL LENGTH";
//   // const result = await new Attribute({
//   //   name,
//   //   values: objIds,
//   // }).save();
//   // const query = {
//   //   productDetails: [
//   //     "6593b5be8da802c7717692a7",
//   //     "6593a9dbdc41df7ecdfc9fe1",
//   //     "65939fedf27dbe3c089d89d6",
//   //     "6593a087f607f2ee2ef906b2",
//   //     "6593aa8d5f4ca0ea3ea7fcb2",
//   //     "6593ab84e6fd763b853864bf",
//   //     "6593b001f8f8e70cf84de1ec",
//   //     "6593abbfe786f6ce239d42cf",
//   //     "6593ac00a65c91a34e888214",
//   //     "6593acfc45e30b29974d44c4",
//   //     "6593b03e6fa78276a498ccc5",
//   //     "659642d6e58f355f5070e975",
//   //     "659655fad53d92a70b45f53d",
//   //     "6593b0b4f3ff7b4e2bae8b76",
//   //   ],
//   //   otherDetails: [
//   //     "6593ad657ebb2c5f8f2263f9",
//   //     "6593ae119d5ce03c6a374fa6",
//   //     "6593ae3e6004803a85cde941",
//   //     "6593ae851465fe1ba1267942",
//   //     "6593aef3e42840c4c1f606b9",
//   //     "659685712f8ada41678906b8",
//   //   ],
//   //   colorDetails: [
//   //     {
//   //       name: "SAREE TOP COLOR",
//   //       value: "659397227f4af2e48737bfc6",
//   //     },
//   //     {
//   //       name: "SAREE BOTTOM COLOR",
//   //       value: "659397227f4af2e48737bfc6",
//   //     },
//   //     {
//   //       name: "COLOR FAMILY",
//   //       value: "659397227f4af2e48737bfc6",
//   //     },
//   //   ],
//   //   sizeDetails: [
//   //     "SIZE",
//   //     "STOCK",
//   //     "BUST SIZE",
//   //     "WAIST SIZE",
//   //     "CROP TOP LENGTH",
//   //     "DRAPE LENGTH",
//   //     "BOTTOM WAIST",
//   //     "BOTTOM LENGTH",
//   //   ],
//   // };
//   // const result = await new SubCategory({
//   //   name: "PRE DRAPED PALAZZO SAREE",
//   //   category: "65993d1a8afd58f90f873e4d",
//   //   description: "PRE DRAPED PALAZZO SAREE sample description",
//   //   image: "PRE DRAPED PALAZZO SAREE.png",
//   //   video: "PRE DRAPED PALAZZO SAREE",
//   //   shortName: "SAREE TOP",
//   //   ...query,
//   // }).save();
//   // res.send(result);
// });

// app.get("/", async (req, res) => {
//   // const values = [
//   //   "SHIRT", "SHIRT COLLOR","CORD SET", "Viscose Silk", "Viscose Silk", "Digital Print"
//   // ];

//   // const valueObjects = await Promise.all(
//   //   values.map(async (name) => {
//   //     let item = await Value.findOne({ value : name });
//   //     return item._id;
//   //   })
//   // );

//   // console.log(valueObjects)

//   const value = await Value.findOne({ value : "Digital Print" });

//   res.send(value)
// });

//   const colorDetails = [{name : "KURTA COLOR", value : "659397227f4af2e48737bfc6"},{name : "BOTTOM COLOR", value : "659397227f4af2e48737bfc6"},{name : "DUPATTA COLOR", value : "659397227f4af2e48737bfc6"},{name : "COLOR FAMILY", value : "659397227f4af2e48737bfc6"}]

//   const result = await SubCategory.findByIdAndUpdate(
//     "6593bee73cea7eb5d00c48bb",
//     {
//       colorDetails,
//     }
//   );

//   res.status(200).json(result);
// });

// app.get("/", async (req, res) => {
//   // const fileData = await new Product({
//   //     name  : "Product test",
//   //     description : "Product test",
//   //     image : "kurta.png",
//   //     video : "fsdfsdfs df",
//   //     subCategory : "658fbb86affafa437a862503",
//   //     productDetails : [{name : "KURTA LENGTH", value :  "658fb93c097f257b5fc0e4cc"},{name : "KURTA HEMLINE", value : "658fb93c097f257b5fc0e4cf"}]

//   // }).save()

//   // const fileData =  await SubCategory.find().populate("productDetails")

//   //   const result = await Value.aggregate([
//   //     {
//   //       $group: { _id: "$value", ids: { $addToSet: "$_id" }, count: { $sum: 1 } },
//   //     },
//   //     { $match: { count: { $gt: 1 } } },
//   //     { $project: { _id: 0, ids: 1, value: "$_id" } },
//   //   ]);

//   //   const duplicates = [
//   //     {
//   //       ids: ["658ff5e30361d70c180d53b3", "658fd743dab1d5592bbb4725"],
//   //       value: "SATIN",
//   //     },
//   //     {
//   //       ids: ["658ff6b3dc33f323994c1f93", "658ff5e30361d70c180d53a8"],
//   //       value: "BROCADE",
//   //     },
//   //     {
//   //       ids: ["658fd743dab1d5592bbb46eb", "658fd743dab1d5592bbb4715"],
//   //       value: "GOTTA PATTI",
//   //     },
//   //   ];

//   // duplicates.map(async (doc) => {
//   //   await Value.deleteOne({ _id: new mongoose.Types.ObjectId(doc.ids[1]) })
//   //     .then((res) => {
//   //       console.log("done");
//   //     })
//   //     .catch((err) => {
//   //       console.log(err);
//   //     });
//   // });

//   //   console.log(objIds);

//   // const values = [
//   //   "BROCADE",
//   //   "CHANDERI",
//   //   "CHIFFON",
//   //   "CHINON",
//   //   "COTTON",
//   //   "GEORGETTE",
//   //   "LUREX",
//   //   "MULMUL",
//   //   "MUSLIN",
//   //   "ORGANZA",
//   //   "RAYON",
//   //   "SATIN",
//   //   "SILK",
//   //   "VELVET",
//   //   "POLYESTER",
//   //   "LYCRA",
//   // ];
//   // const objIds = await Promise.all(
//   //   values.map(async (value) => {
//   //     let item = await Value.create({ value });
//   //     return item._id;
//   //   })
//   // );

//   // const valueObjects = await values.map((value) => {
//   //   return { value, colorCode : null };
//   // });

//   // console.log(valueObjects)

//   // const result = await Color.insertMany(valueObjects);

//   // const name = "FABRICS";

//   // const exist = await Attribute.findOne({ name });

//   // if (!exist) {
//   //   const result = await new Attribute({
//   //     name,
//   //     values: objIds,
//   //   }).save();
//   //   return res.status(200).json(result);
//   // } else {
//   //   return res.status(500).json({ error: "Attribute alreay exist" });
//   // }

//   // const values = [
//   //   "FABRICS",
//   //   "LENGTH",
//   //   "HEMLINE",
//   //   "SLEEVES LENGTH",
//   //   "SLEEVES STYLE",
//   //   "NECK STYLE",
//   //   "FIT/SHAPE",
//   //   "PRINT OR PATTERN TYPE",
//   //   "SET TYPE",
//   //   "STITCH TYPE",
//   //   "BOTTOM FIT/SHAPE",
//   //   "DUPATTA PATTERN",
//   //   "NET QUANTITY",
//   // ];

//   // const productDetails = await Promise.all(
//   //   values.map(async (name) => {
//   //     let item = await Attribute.findOne({ name });
//   //     return item._id;
//   //   })
//   // );

//   // const result = await SubCategory.findByIdAndUpdate(
//   //   "6593bee73cea7eb5d00c48bb",
//   //   {
//   //     productDetails,
//   //   }
//   // );

//   const result = await SubCategory.find()
//     .populate({
//       path: "productDetails",
//       populate: {
//         path: "values",
//         model: "Value",
//       },
//     })
//     .exec();

//   res.status(200).json(result);
// });

redisClient.connect();

redisClient.ping();

const server = app.listen(5001, function () {
  console.log("Server is running on port 5000 ");
});
