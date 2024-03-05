const Order = require("../../database/orders/orderSchema");
const moment = require("moment");
const Cart = require("../../database/cart/cartSchema");
const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const { PDFDocument } = require("pdf-lib");
const { default: mongoose } = require("mongoose");
const { shippingService } = require("../../utils/services/shippingService");
const Rating = require("../../database/rating/ratingSchema");
const Product = require("../../database/product/productSchema");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const exceljs = require("exceljs");
const Report = require("../../database/reports/reportsSchema");
const ActivityLog = require("../../database/logs/logSchema");

const nodemailer = require("nodemailer");
const { editSuccessEmail } = require("../../Emails/email");

const transporter = nodemailer.createTransport({
  host: "s588.sgp8.mysecurecloudhost.com", // Use the hostname or webmail URL
  port: 465, // Use the appropriate port (e.g., 465 for secure)
  secure: true, // Set to true for secure connections
  auth: {
    user: "dev.amarnath@ekkdigitalvyapar.com", // Your email address
    pass: "Amarnath@123", // Your email password
  },
});

module.exports.getAllOrders = async (req, res) => {
  try {
    const { id } = req.params;
    let orders = await Order.find({ customer: id, status: "success" })
      .populate("products.productId")
      .sort({ createdAt: -1 });

    let load = [];
    orders = orders.map((items) => {
      return items.products.map((item, index) => {
        load.push({
          ...item._doc,
          ...items._doc,
          subOrderId: items._id.toString() + "_" + (index + 1),
        });
      });
    });

    res.status(200).json({ load });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getOrderCount = async (req, res) => {
  try {
    let matchQuery = { status: "success" };
    const totalDocumentsCountPipeline = [
      { $match: matchQuery },
      { $unwind: "$products" },
      { $match: { "products.shipped": "pending" } },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" },
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" },
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
        },
      },
      {
        $project: {
          _id: 0,
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
        },
      },
      { $count: "totalDocuments1" },
    ];

    const totalDocuments1 = await Order.aggregate(totalDocumentsCountPipeline);

    const totalDocumentsReadyCountPipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      { $match: { "products.shipped": "ready_to_shipped" } },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
        },
      }, // Match orders by status
      { $count: "totalDocuments" }, // Count the total number of documents
    ];

    const totalDocuments = await Order.aggregate(
      totalDocumentsReadyCountPipeline
    );

    return res.status(200).json({
      totalPending:
        totalDocuments1.length > 0 && totalDocuments1[0].totalDocuments1
          ? totalDocuments1[0].totalDocuments1
          : 0,
      totalReady:
        totalDocuments.length > 0 && totalDocuments[0].totalDocuments
          ? totalDocuments[0].totalDocuments
          : 0,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getAllOrdersAdmin = async (req, res) => {
  try {
    let { page, searchTerm, pageSize, searchField } = req.query;
    page = page ? parseInt(page) - 1 : 0;
    pageSize = 20;
    const skip = page * pageSize;

    let matchQuery = { status: "success" };

    const pipeline = [
      { $match: matchQuery },
      { $unwind: "$products" },
      { $match: { "products.shipped": "pending" } },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" },
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" },
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
        },
      },
      {
        $project: {
          _id: 0,
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
    ];

    if (searchTerm && searchField && searchField !== "all") {
      const fieldToSearch =
        searchField === "orderId"
          ? "id"
          : searchField === "product"
          ? "productId.title"
          : searchField;
      const matchStage = {
        $match: {
          [fieldToSearch]: { $regex: searchTerm, $options: "i" },
        },
      };
      pipeline.push(matchStage);
    } else if (searchTerm) {
      const matchStage = {
        $match: {
          $or: [
            { sku: { $regex: searchTerm, $options: "i" } },
            { vsku: { $regex: searchTerm, $options: "i" } },
            { "productId.title": { $regex: searchTerm, $options: "i" } },
            { id: { $regex: searchTerm, $options: "i" } },
          ],
        },
      };
      pipeline.push(matchStage);
    }

    let products = await Order.aggregate(pipeline);

    const totalDocumentsCountPipeline = [
      { $match: matchQuery },
      { $unwind: "$products" },
      { $match: { "products.shipped": "pending" } },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" },
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" },
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
        },
      },
      {
        $project: {
          _id: 0,
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
        },
      },
      { $count: "totalDocuments" },
    ];

    const [{ totalDocuments }] = await Order.aggregate(
      totalDocumentsCountPipeline
    );

    let duplicate = "";
    let count = 1;

    products = await Promise.all(
      products.map(async (items, index) => {
        if (items.id === duplicate) {
          count++;
        } else {
          count = 1;
        }

        const orderData = await Order.findById(items.id);

        const indexVal = orderData.products.findIndex(
          (p) =>
            p.productId.toString() === items.productId._id.toString() &&
            p.size === items.size
        );

        items.subOrderId = `${items.id}_${indexVal + 1}`;

        duplicate = items.id;
        return {
          ...items,
          _id: items.id,
          orderId: items.id,
          id: index,
        };
      })
    );

    res
      .status(200)
      .json({ products, totalPages: Math.ceil(totalDocuments / pageSize) });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.createShippingConsignment = async (req, res) => {
  try {
    const { orders } = req.body;

    if (!orders || !orders.length) {
      return res.status(400).json({ message: "No orders found" });
    }

    const consignments = [];

    for (const { orderId, subOrderId } of orders) {
      const order = await Order.findOne({ _id: orderId })
        .populate("customer")
        .populate("products.productId");

      if (!order) {
        return res
          .status(400)
          .json({ message: `Order with ID ${orderId} not found` });
      }

      const position = parseInt(subOrderId.split("_")[1]);

      const product = order.products[position - 1];

      if (!product) {
        return res.status(400).json({
          message: `Product at position ${position} not found in order ${orderId}`,
        });
      }

      const productData = product.productId;

      if (!productData) {
        return res.status(400).json({
          message: `Product with ID ${product.productId._id} not found`,
        });
      }

      // Create a consignment object for the product
      const consignment = {
        customer_code: "GL7412",
        service_type_id: `${
          // order.paymentMethod === "COD" ? "GROUND EXPRESS" : "B2C SMART EXPRESS"
          order.paymentMethod === "COD" ? "GROUND EXPRESS" : "B2C SMART EXPRESS"
        }`,
        load_type: "NON-DOCUMENT",
        description: "FAB GALAXY PRODUCTS",
        dimension_unit: "cm",
        length: 21,
        width: 15,
        height: 3 * product.quantity,
        weight_unit: "kg",
        weight: productData.weight * product.quantity,
        declared_value:
          (productData.fcp - (productData.fcp * product.promo) / 100) *
          product.quantity,
        cod_amount: `${
          order.paymentMethod === "COD"
            ? (productData.fcp - (productData.fcp * product.promo) / 100) *
              product.quantity
            : ""
        }`,
        cod_collection_mode: `${order.paymentMethod === "COD" ? "cash" : ""}`,
        num_pieces: "1",
        origin_details: {
          name: "Fabalaxy warehouse",
          phone: "7990762155",
          alternate_phone: "9562530330",
          address_line_1: "104 ANCELLARY ZONE Surat Navsari Rd",
          address_line_2: "opp TULSI HOTEL off SACHIN Kanakpur",
          pincode: "394230",
          city: "Surat",
          state: "Gujarart",
        },
        return_details: {
          name: "Fabalaxy warehouse",
          phone: "7990762155",
          alternate_phone: "9562530330",
          address_line_1: "104 ANCELLARY ZONE Surat Navsari Rd",
          address_line_2: "opp TULSI HOTEL off SACHIN Kanakpur",
          pincode: "394230",
          city: "Surat",
          state: "Gujarart",
        },

        destination_details: {
          name: `${order.address[0].fname} ${order.address[0].lname}`,
          phone: order.address[0].contact,
          alternate_phone: "9978973843",
          address_line_1: order.address[0].addressOne,
          address_line_2: order.address[0].addressTwo,
          pincode: order.address[0].postalCode,
          city: order.address[0].city,
          state: order.address[0].province,
        },
        customer_reference_number: `${order._id}_${position} | ${productData.sku}`,
        pieces_detail: [
          {
            description: productData.sku,
            declared_value:
              (productData.mrp -
                (productData.mrp *
                  (parseFloat(product.promo) + parseFloat(productData.td))) /
                  100) *
              product.quantity,
            weight: productData.weight * product.quantity,
            height: 3 * product.quantity,
            length: 21,
            width: 15,
          },
        ],
      };

      consignments.push(consignment);
    }

    await axios
      .post(
        "https://dtdcapi.shipsy.io/api/customer/integration/consignment/softdata",
        { consignments },
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": process.env.DTDC_LIVE_API_KEY,
          },
        }
      )
      .then(async (response) => {
        console.log(response.data);
        if (response.data.data[0].success) {
          const promises = response.data.data.map(async (items) => {
            if (items.success === true) {
              let currOrder = await Order.findOne({
                _id: items.customer_reference_number.split("_")[0],
              });

              if (!currOrder) {
                return res.status(404).send({ message: "Order not found" });
              }

              const proPosition = items.customer_reference_number.split("_")[1];
              const productIndex = parseInt(proPosition) - 1;

              let currData = { ...currOrder.products[productIndex]._doc };

              currOrder.products[productIndex] = {
                ...currData,
                shipped: "ready_to_shipped",
                logs: [
                  {
                    date: Date.now(),
                    note: "Order consignment created successfully",
                    orderType: currOrder.paymentMethod,
                    currentStatus: "ready_to_shipped",
                    paymentMethod: currOrder.paymentMethod,
                  },
                ],
                shippingDetails: items,
              };

              await currOrder.save();

              const existingOrder = await Order.findById(currOrder._id)
                .populate("products.productId")
                .populate("customer");

              const emailData = { ...existingOrder._doc };

              emailData.products = [currData];

              emailData.products[0].productId = await Product.findById(
                currData.productId
              );

              const mailOptions = {
                from: "dev.amarnath@ekkdigitalvyapar.com",
                to: existingOrder.customer.email,
                subject: "Order has been Confirmed",
                html: orderTemplate(
                  emailData,
                  "Order has been Confirmed and will be shipped Soon."
                ),
              };

              await transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                  console.error("Error sending email:", error);
                } else {
                  console.log("Email sent:", info.response);
                }
              });
            }
          });

          // Wait for all promises to resolve
          await Promise.all(promises);

          return res.send({
            response: response.data,
            status: response.status,
            request: consignments,
          });
        } else {
          return res.status(404).send("Error");
        }
      })
      .catch((err) => {
        console.log(err);
        return res.status(404).json(err);
      });
  } catch (error) {
    console.error("Error creating shipping consignment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getOrderOnHold = async (req, res) => {
  try {
    const { id } = req.params;
    const carts = await Cart.find({ _id: id }).populate("products.productId");

    let allProductsOnHold = carts.map((items) => {
      return items.products.map((item) => {
        return item;
      });
    });
    return res.status(200).json({ order: allProductsOnHold });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.checkPincodeAvailablilty = async (req, res) => {
  try {
    const { pincode } = req.query;

    if (!pincode) {
      return res.status(500).json({ message: "Invalid pincode" });
    }

    const requestObject = {
      orgPincode: "452001",
      desPincode: pincode,
    };

    await axios
      .post(
        "http://smarttrack.ctbsplus.dtdc.com/ratecalapi/PincodeApiCall",
        requestObject,
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": "4073ba7e4966d74fc5a6afb1991862",
          },
        }
      )
      .then((response) => {
        res.send(response.data);
      })
      .catch((err) => {
        res.send(err);
      });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.fetchReadyToshipOrders = async (req, res) => {
  try {
    let { page, searchTerm, pageSize, searchField } = req.query;
    page = page ? parseInt(page) - 1 : 0; // Adjust page number to 0-indexed
    pageSize = 20; // Default page size
    const skip = page * pageSize; //

    let matchQuery = { status: "success" }; // Default filter by status

    const pipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      { $match: { "products.shipped": "ready_to_shipped" } },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          isDownloaded: "$products.isLabelDownloaded",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
          isDownloaded: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip }, // Skip documents based on page number and page size
      { $limit: pageSize },
    ];

    if (searchTerm && searchField && searchField !== "all") {
      // Add $match stage to filter products based on search criteria for a specific field
      const fieldToSearch =
        searchField === "orderId"
          ? "id"
          : searchField === "product"
          ? "productId.title"
          : searchField;
      const matchStage = {
        $match: {
          [fieldToSearch]: { $regex: searchTerm, $options: "i" },
        },
      };
      pipeline.push(matchStage);
    } else if (searchTerm) {
      // Add $match stage to filter products based on search criteria for all fields
      const matchStage = {
        $match: {
          $or: [
            { sku: { $regex: searchTerm, $options: "i" } },
            { vsku: { $regex: searchTerm, $options: "i" } },
            { "productId.title": { $regex: searchTerm, $options: "i" } },
            { id: { $regex: searchTerm, $options: "i" } }, // Assuming "productId" contains the product document
          ],
        },
      };
      pipeline.push(matchStage);
    }

    let products = await Order.aggregate(pipeline);

    const totalDocumentsCountPipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      { $match: { "products.shipped": "ready_to_shipped" } },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
        },
      }, // Match orders by status
      { $count: "totalDocuments" }, // Count the total number of documents
    ];

    const [{ totalDocuments }] = await Order.aggregate(
      totalDocumentsCountPipeline
    );

    let duplicate = "";
    let count = 1;

    products = await Promise.all(
      products.map(async (items, index) => {
        if (items.id === duplicate) {
          count++;
        } else {
          count = 1;
        }

        const orderData = await Order.findById(items.id);

        const indexVal = orderData.products.findIndex((p) => {
          return (
            p.productId.toString() === items.productId._id.toString() &&
            p.size === items.size
          );
        });

        items.subOrderId = `${items.id}_${indexVal + 1}`;

        duplicate = items.id;
        return {
          ...items,
          _id: items.id,
          orderId: items.id,
          id: index,
        };
      })
    );

    res
      .status(200)
      .json({ products, totalPages: Math.ceil(totalDocuments / pageSize) });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.generateShippingLabel = async (req, res) => {
  try {
    const { orders } = req.body;

    if (!orders || !orders.length) {
      return res.status(400).json({ message: "No orders found" });
    }

    let savedPDFs = [];
    let savedManifests = [];

    // Initialize arrays to store consignments and manifest requests
    const consignments = [];
    const manifestRequests = [];

    // Iterate over each order object in the orders array
    for (const { orderId, subOrderId } of orders) {
      // Find the order in the database based on the order ID
      const order = await Order.findOne({ _id: orderId })
        .populate("customer")
        .populate("products.productId");

      if (!order) {
        return res
          .status(400)
          .json({ message: `Order with ID ${orderId} not found` });
      }

      // Extract the position from the suborder ID
      const position = parseInt(subOrderId.split("_")[1]);

      // Find the product at the specified position within the order
      const product = order.products[position - 1]; // Adjust position to 0-based index

      if (!product) {
        return res.status(400).json({
          message: `Product at position ${position} not found in order ${orderId}`,
        });
      }

      if (product.isLabelDownloaded) {
        savedPDFs.push(
          `C:\\Users\\SUB\\Desktop\\Projects\\fab_galaxy\\fab_galaxy_backend\\src\\files\\singleshippingLabels\\${product.labelFiles}`
        );
        savedManifests.push(
          `C:\\Users\\SUB\\Desktop\\Projects\\fab_galaxy\\fab_galaxy_backend\\src\\files\\singlemanifests\\${product.labelFiles}`
        );
        continue;
      }

      // Find the product in the database based on the product ID
      const productData = product;

      if (!productData) {
        return res.status(400).json({
          message: `Product with ID ${product.productId._id} not found`,
        });
      }

      // Create a consignment object for the product
      const consignment = productData.shippingDetails;

      // Push the consignment object to the consignments array
      consignments.push(consignment);

      // Create a manifest request object
      manifestRequests.push({
        reference_number: consignment.reference_number,
        customer_reference_number: consignment.customer_reference_number,
      });
    }

    // Fetch manifest PDFs
    const manifestPromises = manifestRequests.map(async (manifestRequest) => {
      try {
        const response = await axios.get(
          `https://dtdcapi.shipsy.io/api/customer/integration/consignment/shippinglabel/link?reference_number=${manifestRequest.reference_number}`,
          {
            headers: {
              "Content-Type": "application/json",
              "api-key": process.env.DTDC_LIVE_API_KEY,
            },
          }
        );

        // Save manifest PDF
        const manifestBuffer = await axios.get(response.data.data.url, {
          responseType: "arraybuffer",
        });
        const manifestPath = path.join(
          __dirname,
          `../../files/singlemanifests/${
            manifestRequest.customer_reference_number.split(" | ")[0]
          }.pdf`
        );
        await fs.writeFile(manifestPath, manifestBuffer.data);
        console.log(`Manifest saved successfully: ${manifestPath}`);

        savedManifests.push(manifestPath);
      } catch (error) {
        console.error(`Error fetching or saving manifest: ${error}`);
        throw error;
      }
    });

    // Wait for all manifest PDFs to be saved
    await Promise.all(manifestPromises);

    // Fetch label PDFs
    const labelPromises = consignments.map(async (consignment, index) => {
      try {
        const response = await axios.post(
          "https://dtdcapi.shipsy.io/api/customer/integration/consignment/label/multipiece",
          { reference_number: consignment.reference_number },
          {
            headers: {
              "Content-Type": "application/json",
              "api-key": process.env.DTDC_LIVE_API_KEY,
            },
          }
        );

        // Save label PDF
        const labelPath = path.join(
          __dirname,
          `../../files/singleshippingLabels/${
            consignment.customer_reference_number.split(" | ")[0]
          }.pdf`
        );
        await fs.writeFile(
          labelPath,
          Buffer.from(response.data.data[0].label, "base64")
        );
        console.log(`Label saved successfully: ${labelPath}`);

        const orderData = await Order.findOne({
          _id: consignment.customer_reference_number.split("_")[0],
        });

        productList = {
          ...orderData.products[
            parseInt(consignment.customer_reference_number.split("_")[1]) - 1
          ]._doc,
        };
        orderData.products[
          parseInt(consignment.customer_reference_number.split("_")[1]) - 1
        ] = {
          ...productList,
          isLabelDownloaded: true,
          labelFiles:
            consignment.customer_reference_number.split(" | ")[0] + ".pdf",
        };
        await orderData.save();

        savedPDFs.push(labelPath);
      } catch (error) {
        console.error(`Error fetching or saving label: ${error}`);
        throw error;
      }
    });

    // Wait for all label PDFs to be saved
    await Promise.all(labelPromises);

    // Merge saved label PDFs into a single PDF
    const mergedPdf = await PDFDocument.create();
    for (const pdfPath of savedPDFs) {
      const pdfBytes = await fs.readFile(pdfPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    // Save the merged label PDF to file system
    const mergedLabelFilename = `merged_shipping_labels_${Date.now()}.pdf`;
    const mergedLabelFilePath = path.join(
      __dirname,
      `../../files/mergedshippinglabels/${mergedLabelFilename}`
    );
    await fs.writeFile(mergedLabelFilePath, await mergedPdf.save());
    console.log(`Merged label PDF saved: ${mergedLabelFilePath}`);

    // Merge saved manifest PDFs into a single PDF
    const mergedManifestPdf = await PDFDocument.create();
    for (const pdfPath of savedManifests) {
      const pdfBytes = await fs.readFile(pdfPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedManifestPdf.copyPages(
        pdf,
        pdf.getPageIndices()
      );
      copiedPages.forEach((page) => mergedManifestPdf.addPage(page));
    }

    // Save the merged manifest PDF to file system
    const mergedManifestFilename = `merged_manifests_${Date.now()}.pdf`;
    const mergedManifestFilePath = path.join(
      __dirname,
      `../../files/mergedmanifests/${mergedManifestFilename}`
    );
    await fs.writeFile(mergedManifestFilePath, await mergedManifestPdf.save());
    console.log(`Merged manifest PDF saved: ${mergedManifestFilePath}`);

    // Send the filenames as response
    res.status(200).json({
      singleLabelPDFs: savedPDFs.map((pdfPath) => path.basename(pdfPath)),
      mergedLabelPDF: mergedLabelFilename,
      singleManifestPDFs: savedManifests.map((pdfPath) =>
        path.basename(pdfPath)
      ),
      mergedManifestPDF: mergedManifestFilename,
    });
  } catch (error) {
    console.error("Error creating shipping consignment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getSinglePdf = async (req, res) => {
  try {
    const { filename } = req.params;

    // Stream the file as response
    res.sendFile(
      path.join(__dirname, "../../files/singleshippingLabels", filename)
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getMergedPdf = async (req, res) => {
  try {
    const { filename } = req.params;

    // Stream the file as response
    res.sendFile(
      path.join(__dirname, "../../files/mergedshippinglabels", filename)
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getMergedManifest = async (req, res) => {
  try {
    const { filename } = req.params;

    // Stream the file as response
    res.sendFile(path.join(__dirname, "../../files/mergedmanifests", filename));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getAllProductsInCart = async (req, res) => {
  try {
    let { page, searchTerm, pageSize, searchField } = req.query;
    page = page ? parseInt(page) - 1 : 0; // Adjust page number to 0-indexed
    pageSize = 20; // Default page size
    const skip = page * pageSize;

    const pipeline = [
      { $unwind: "$products" }, // Unwind products array
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          customerId: "$customer",
          quantity: "$products.quantity",
          size: "$products.size",
          sku: "$productData.sku",
          vsku: "$products.vsku",
          selected: "$products.selected",
          dateAdded: "$products.date",
        },
      },
      {
        $lookup: {
          from: "users", // Assuming your users collection is named "users"
          localField: "customerId",
          foreignField: "_id",
          as: "userData",
        },
      },
      { $unwind: "$userData" }, // Unwind the userData array
      {
        $addFields: {
          username: { $concat: ["$userData.fname", " ", "$userData.lname"] },
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          id: { $toString: "$_id" }, // Convert ObjectId to string for the datatable
          productId: 1,
          username: 1,
          quantity: 1,
          size: 1,
          vsku: 1,
          sku: 1,
          selected: 1,
          dateAdded: 1,
        },
      },
      { $sort: { dateAdded: -1 } }, // Sort by dateAdded field in descending order
      { $skip: skip }, // Skip documents based on page number and page size
      { $limit: pageSize },
    ];

    if (searchTerm && searchField && searchField !== "all") {
      // Add $match stage to filter products based on search criteria for a specific field
      const fieldToSearch =
        searchField === "product" ? "productId.title" : searchField;
      const matchStage = {
        $match: {
          [fieldToSearch]: { $regex: searchTerm, $options: "i" },
        },
      };
      pipeline.push(matchStage);
    } else if (searchTerm) {
      // Add $match stage to filter products based on search criteria for all fields
      const matchStage = {
        $match: {
          $or: [
            { sku: { $regex: searchTerm, $options: "i" } },
            { vsku: { $regex: searchTerm, $options: "i" } },
            { "productId.title": { $regex: searchTerm, $options: "i" } },
          ],
        },
      };
      pipeline.push(matchStage);
    }

    let products = await Cart.aggregate(pipeline);

    const totalDocumentsCountPipeline = [
      { $unwind: "$products" }, // Unwind products array
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      { $count: "totalDocuments" }, // Count the total number of documents
    ];

    const [{ totalDocuments }] = await Cart.aggregate(
      totalDocumentsCountPipeline
    );

    products.map((items, index) => {
      items.id = index;
      return items;
    });

    res.status(200).json({
      products,
      totalPages: Math.ceil(totalDocuments / pageSize),
    });
  } catch (error) {
    console.error("Error fetching products from cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.cancelOrder = async (req, res) => {
  try {
    const { subOrderId, question, answer } = req.body;
    const orderId = subOrderId.split("_")[0];
    const position = subOrderId.split("_")[1];

    console.log("order cancellation initiated");

    if (!answer || !question) {
      return res
        .status(404)
        .json({ message: "Reason is required for cancellation." });
    }

    const orderData = await Order.findOne({ _id: orderId });

    if (!orderData) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (orderData.products[position - 1].shipped === "pending") {
      if (orderData.paymentMethod === "COD") {
        orderData.products[position - 1].status = "cancelled";
        orderData.products[position - 1].shipped = "cancelled";
        orderData.products[position - 1].cancelReason = { question, answer };
        orderData.products[position - 1].logs.push({
          date: Date.now(),
          note: `subOrderId : ${subOrderId} is cancelled`,
          orderType: "COD",
          currentStatus: "cancelled",
          paymentMethod: "COD",
        });

        orderData.allLogs.push({
          date: Date.now(),
          note: `subOrderId : ${subOrderId} is cancelled`,
          orderType: "COD",
          paymentDetails: "COD",
          paymentMethod: "COD",
        });

        await orderData.save();

        await await (
          await orderData.populate("products.productId")
        ).populate("customer");

        console.log(orderData.customer);

        const mailOptions = {
          from: "dev.amarnath@ekkdigitalvyapar.com",
          to: orderData.customer.email,
          subject: "Order Cancelled",
          html: editSuccessEmail(
            "Order Cancellation successful",
            `Your order with id ${subOrderId} has been cancelled, if you did not cancel this order, please reach out to the administrator at support@fabgalaxy.com for assistance.`
          ),
        };

        console.log("started email");

        await transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error("Error sending email:", error);
          } else {
            console.log("Email sent:", info.response);
            return res.status(200).json({ message: "Order cancelled" });
          }
        });
      } else {
        const refund = await stripe.refunds.create({
          payment_intent: orderData.paymentDetails.id,
          amount:
            parseFloat(orderData.products[position - 1].productValue - 1) * 100,
        });
        if (refund.status === "succeeded") {
          orderData.products[position - 1].status = "cancelled";
          orderData.products[position - 1].shipped = "cancelled";
          orderData.products[position - 1].cancelReason = { question, answer };

          orderData.products[position - 1].logs.push({
            date: Date.now(),
            note: `subOrderId : ${subOrderId} is cancelled`,
            orderType: "CARD",
            currentStatus: "cancelled",
            paymentMethod: JSON.stringify(refund),
          });

          orderData.allLogs.push({
            date: Date.now(),
            note: `subOrderId : ${subOrderId} is cancelled`,
            orderType: "CARD",
            paymentDetails: JSON.stringify(refund),
            paymentMethod: "CARD",
          });

          await orderData.save();

          await (
            await orderData.populate("products.productId")
          ).populate("customer");

          console.log(orderData.customer);

          const mailOptions = {
            from: "dev.amarnath@ekkdigitalvyapar.com",
            to: orderData.customer.email,
            subject: "Order Cancelled",
            html: editSuccessEmail(
              "Order Cancellation successful",
              `Your order with id ${subOrderId} has been cancelled, if you did not cancel this order, please reach out to the administrator at support@fabgalaxy.com for assistance.`
            ),
          };

          console.log("started email");

          await transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error("Error sending email:", error);
            } else {
              console.log("Email sent:", info.response);
              return res.status(200).json({ message: "Order cancelled" });
            }
          });
        } else {
          return res
            .status(500)
            .json({ message: "Refund failed try again in 10 mins" });
        }
      }
    } else {
      await axios
        .post(
          "https://demodashboardapi.shipsy.in/api/customer/integration/consignment/cancel?=",
          {
            AWBNo: [
              orderData.products[position - 1].shippingDetails.reference_number,
            ],
            customerCode: "GL7412",
          },
          {
            headers: {
              "Content-Type": "application/json",
              "api-key": "4073ba7e4966d74fc5a6afb1991862",
            },
          }
        )
        .then(async (response) => {
          if (response.data && response.data.success === false) {
            return res
              .status(500)
              .json({ message: "Refund failed try again in 10 mins" });
          }

          if (
            response.data &&
            response.data.successConsignments &&
            response.data.successConsignments[0].success
          ) {
            orderData.products[position - 1].logs.push({
              date: Date.now(),
              note: `subOrderId : ${subOrderId}, shipping is cancelled`,
              orderType: "COD",
              currentStatus: "shipping",
              paymentMethod: "COD",
            });

            orderData.products[position - 1].logs.push({
              date: Date.now(),
              note: `subOrderId : ${subOrderId}, shipping is cancelled`,
              orderType: "COD",
              currentStatus: "shipping",
              paymentMethod: "COD",
            });
            orderData.products[position - 1].shipped = "cancelled";

            if (orderData.paymentMethod === "COD") {
              orderData.products[position - 1].status = "cancelled";

              orderData.products[position - 1].cancelReason = {
                question,
                answer,
              };
              orderData.products[position - 1].logs.push({
                date: Date.now(),
                note: `subOrderId : ${subOrderId} is cancelled`,
                orderType: "COD",
                currentStatus: "cancelled",
                paymentMethod: "COD",
              });

              orderData.allLogs.push({
                date: Date.now(),
                note: `subOrderId : ${subOrderId} is cancelled`,
                orderType: "COD",
                paymentDetails: "COD",
                paymentMethod: "COD",
              });

              await orderData.save();

              (await orderData.populate("products.productId")).populate(
                "customer"
              );

              console.log(orderData.customer);

              const mailOptions = {
                from: "dev.amarnath@ekkdigitalvyapar.com",
                to: orderData.customer.email,
                subject: "Order Cancelled",
                html: editSuccessEmail(
                  "Order Cancellation successful",
                  `Your order with id ${subOrderId} has been cancelled, if you did not cancel this order, please reach out to the administrator at support@fabgalaxy.com for assistance.`
                ),
              };

              console.log("started email");

              await transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                  console.error("Error sending email:", error);
                } else {
                  console.log("Email sent:", info.response);
                  return res.status(200).json({ message: "Order cancelled" });
                }
              });
            } else {
              const refund = await stripe.refunds.create({
                payment_intent: orderData.paymentDetails.id,
                amount:
                  parseFloat(
                    orderData.products[position - 1].productValue - 1
                  ) * 100,
              });
              if (refund.status === "succeeded") {
                orderData.products[position - 1].status = "cancelled";

                orderData.products[position - 1].cancelReason = {
                  question,
                  answer,
                };

                orderData.products[position - 1].logs.push({
                  date: Date.now(),
                  note: `subOrderId : ${subOrderId} is cancelled`,
                  orderType: "CARD",
                  currentStatus: "cancelled",
                  paymentMethod: JSON.stringify(refund),
                });

                orderData.allLogs.push({
                  date: Date.now(),
                  note: `subOrderId : ${subOrderId} is cancelled`,
                  orderType: "CARD",
                  paymentDetails: JSON.stringify(refund),
                  paymentMethod: "CARD",
                });

                await orderData.save();

                (await orderData.populate("products.productId")).populate(
                  "customer"
                );

                console.log(orderData.customer);

                const mailOptions = {
                  from: "dev.amarnath@ekkdigitalvyapar.com",
                  to: orderData.customer.email,
                  subject: "Order Cancelled",
                  html: editSuccessEmail(
                    "Order Cancellation successful",
                    `Your order with id ${subOrderId} has been cancelled, if you did not cancel this order, please reach out to the administrator at support@fabgalaxy.com for assistance.`
                  ),
                };

                console.log("started email");

                await transporter.sendMail(mailOptions, (error, info) => {
                  if (error) {
                    console.error("Error sending email:", error);
                  } else {
                    console.log("Email sent:", info.response);
                    return res.status(200).json({ message: "Order cancelled" });
                  }
                });
              } else {
                await orderData.save();
                return res
                  .status(500)
                  .json({ message: "Refund failed try again in 10 mins" });
              }
            }
          } else {
            return res
              .status(404)
              .json({ message: "Cannot cancel now, please try again later." });
          }
        })
        .catch((err) => {
          console.log(err);
          return res
            .status(404)
            .json({ message: "Cannot cancel now, please try again later." });
        });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.fetchCancelledOrders = async (req, res) => {
  try {
    let { page, searchTerm, pageSize, searchField } = req.query;
    page = page ? parseInt(page) - 1 : 0; // Adjust page number to 0-indexed
    pageSize = 20; // Default page size
    const skip = page * pageSize; //

    let matchQuery = { status: "success" }; // Default filter by status

    const pipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      { $match: { "products.status": "cancelled" } },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      {
        $lookup: {
          from: "users", // Assuming your products collection is named "products"
          localField: "customer",
          foreignField: "_id",
          as: "userData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          isDownloaded: "$products.isLabelDownloaded",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
          reason: "$products.cancelReason",
          userData: "$userData",
          logs: "$products.logs",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
          reason: 1,
          reason: 1,
          isDownloaded: 1,
          userData: 1,
          logs: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip }, // Skip documents based on page number and page size
      { $limit: pageSize },
    ];

    if (searchTerm && searchField && searchField !== "all") {
      // Add $match stage to filter products based on search criteria for a specific field
      const fieldToSearch =
        searchField === "orderId"
          ? "id"
          : searchField === "product"
          ? "productId.title"
          : searchField;
      const matchStage = {
        $match: {
          [fieldToSearch]: { $regex: searchTerm, $options: "i" },
        },
      };
      pipeline.push(matchStage);
    } else if (searchTerm) {
      // Add $match stage to filter products based on search criteria for all fields
      const matchStage = {
        $match: {
          $or: [
            { sku: { $regex: searchTerm, $options: "i" } },
            { vsku: { $regex: searchTerm, $options: "i" } },
            { "productId.title": { $regex: searchTerm, $options: "i" } },
            { id: { $regex: searchTerm, $options: "i" } }, // Assuming "productId" contains the product document
          ],
        },
      };
      pipeline.push(matchStage);
    }

    let products = await Order.aggregate(pipeline);

    const totalDocumentsCountPipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      { $match: { "products.status": "cancelled" } },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
          reason: "$products.cancelReason",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
          reason: 1,
        },
      }, // Match orders by status
      { $count: "totalDocuments" }, // Count the total number of documents
    ];

    const [{ totalDocuments }] = await Order.aggregate(
      totalDocumentsCountPipeline
    );

    let duplicate = "";
    let count = 1;

    products = await Promise.all(
      products.map(async (items, index) => {
        if (items.id === duplicate) {
          count++;
        } else {
          count = 1;
        }

        const orderData = await Order.findById(items.id);

        const indexVal = orderData.products.findIndex((p) => {
          return (
            p.productId.toString() === items.productId._id.toString() &&
            p.size === items.size
          );
        });

        items.subOrderId = `${items.id}_${indexVal + 1}`;

        duplicate = items.id;
        return {
          ...items,
          _id: items.id,
          orderId: items.id,
          id: index,
        };
      })
    );

    res
      .status(200)
      .json({ products, totalPages: Math.ceil(totalDocuments / pageSize) });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateOrderStatus = async () => {
  const orders = await Order.find({
    "products.shipped": { $nin: ["pending", "cancelled", "Delivered"] },
    "products.shippingDetails": { $exists: true, $ne: {} },
  });

  console.log("Updating status for orders:", orders.length);

  for (const order of orders) {
    for (const product of order.products) {
      if (product.shipped !== "pending" && product.shipped !== "cancelled") {
        const referenceNumber = product.shippingDetails.reference_number;
        const packageStatus = await shippingService.trackShipment(
          referenceNumber
        );

        if (!packageStatus) {
          continue;
        }

        if (
          packageStatus &&
          packageStatus.trackHeader.strStatus === product.shipped
        ) {
          continue;
        }

        if (packageStatus) {
          product.shipped = packageStatus.trackHeader.strStatus;
        }

        if (
          packageStatus &&
          packageStatus.trackHeader.strStatus === "Delivered"
        ) {
          product.status = packageStatus.trackHeader.strStatus;
          product.deliveryData = {
            ...packageStatus,
            deliveredDate: Date.now(),
          };
        }

        //note : After getting the possible values of status,  update the order accrodinly
        ///////  with the logs included.

        await order.save();
      }
    }
  }
};

module.exports.updateOrderStatus = async (req, res) => {
  try {
    await updateOrderStatus();
    res.status(200).json({ message: "Status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getAllInTransitOrders = async (req, res) => {
  try {
    let { page, searchTerm, pageSize, searchField } = req.query;
    page = page ? parseInt(page) - 1 : 0; // Adjust page number to 0-indexed
    pageSize = 20; // Default page size
    const skip = page * pageSize;

    let matchQuery = { status: "success" }; // Default filter by status

    const pipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      {
        $match: {
          "products.shipped": {
            $nin: ["ready_to_shipped", "cancelled", "pending", "Delivered"],
          },
        },
      },
      {
        $match: {
          "products.status": {
            $nin: ["cancelled", "delivered"],
          },
        },
      },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      {
        $lookup: {
          from: "users", // Assuming your products collection is named "products"
          localField: "customer",
          foreignField: "_id",
          as: "userData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          isDownloaded: "$products.isLabelDownloaded",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
          reason: "$products.cancelReason",
          userData: "$userData",
          logs: "$products.logs",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
          shipped: 1,
          reason: 1,
          reason: 1,
          isDownloaded: 1,
          userData: 1,
          logs: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip }, // Skip documents based on page number and page size
      { $limit: pageSize },
    ];

    if (searchTerm && searchField && searchField !== "all") {
      // Add $match stage to filter products based on search criteria for a specific field
      const fieldToSearch =
        searchField === "orderId"
          ? "id"
          : searchField === "product"
          ? "productId.title"
          : searchField;
      const matchStage = {
        $match: {
          [fieldToSearch]: { $regex: searchTerm, $options: "i" },
        },
      };
      pipeline.push(matchStage);
    } else if (searchTerm) {
      // Add $match stage to filter products based on search criteria for all fields
      const matchStage = {
        $match: {
          $or: [
            { sku: { $regex: searchTerm, $options: "i" } },
            { vsku: { $regex: searchTerm, $options: "i" } },
            { "productId.title": { $regex: searchTerm, $options: "i" } },
            { id: { $regex: searchTerm, $options: "i" } }, // Assuming "productId" contains the product document
          ],
        },
      };
      pipeline.push(matchStage);
    }

    let products = await Order.aggregate(pipeline);

    const totalDocumentsCountPipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      {
        $match: {
          "products.shipped": {
            $nin: ["ready_to_shipped", "cancelled", "pending", "delivered"],
          },
        },
      },
      {
        $match: {
          "products.status": {
            $nin: ["cancelled", "delivered"],
          },
        },
      },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
          reason: "$products.cancelReason",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
          reason: 1,
        },
      }, // Match orders by status
      { $count: "totalDocuments" }, // Count the total number of documents
    ];

    const [{ totalDocuments }] = await Order.aggregate(
      totalDocumentsCountPipeline
    );

    let duplicate = "";
    let count = 1;

    products = await Promise.all(
      products.map(async (items, index) => {
        if (items.id === duplicate) {
          count++;
        } else {
          count = 1;
        }

        const orderData = await Order.findById(items.id);

        const indexVal = orderData.products.findIndex((p) => {
          return (
            p.productId.toString() === items.productId._id.toString() &&
            p.size === items.size
          );
        });

        items.subOrderId = `${items.id}_${indexVal + 1}`;

        duplicate = items.id;
        return {
          ...items,
          _id: items.id,
          orderId: items.id,
          id: index,
        };
      })
    );

    res
      .status(200)
      .json({ products, totalPages: Math.ceil(totalDocuments / pageSize) });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getAllDeliveredOrders = async (req, res) => {
  try {
    let { page, searchTerm, pageSize, searchField } = req.query;
    page = page ? parseInt(page) - 1 : 0; // Adjust page number to 0-indexed
    pageSize = 20; // Default page size
    const skip = page * pageSize;

    let matchQuery = { status: "success" }; // Default filter by status

    const pipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      {
        $match: {
          "products.shipped": "Delivered",
        },
      },
      {
        $match: {
          "products.status": "Delivered",
        },
      },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      {
        $lookup: {
          from: "users", // Assuming your products collection is named "products"
          localField: "customer",
          foreignField: "_id",
          as: "userData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          isDownloaded: "$products.isLabelDownloaded",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
          reason: "$products.cancelReason",
          userData: "$userData",
          logs: "$products.logs",
          deliveryData: "$products.deliveryData",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
          shipped: 1,
          reason: 1,
          reason: 1,
          isDownloaded: 1,
          userData: 1,
          logs: 1,
          deliveryData: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip }, // Skip documents based on page number and page size
      { $limit: pageSize },
    ];

    if (searchTerm && searchField && searchField !== "all") {
      // Add $match stage to filter products based on search criteria for a specific field
      const fieldToSearch =
        searchField === "orderId"
          ? "id"
          : searchField === "product"
          ? "productId.title"
          : searchField;
      const matchStage = {
        $match: {
          [fieldToSearch]: { $regex: searchTerm, $options: "i" },
        },
      };
      pipeline.push(matchStage);
    } else if (searchTerm) {
      // Add $match stage to filter products based on search criteria for all fields
      const matchStage = {
        $match: {
          $or: [
            { sku: { $regex: searchTerm, $options: "i" } },
            { vsku: { $regex: searchTerm, $options: "i" } },
            { "productId.title": { $regex: searchTerm, $options: "i" } },
            { id: { $regex: searchTerm, $options: "i" } }, // Assuming "productId" contains the product document
          ],
        },
      };
      pipeline.push(matchStage);
    }

    let products = await Order.aggregate(pipeline);

    const totalDocumentsCountPipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      {
        $match: {
          "products.shipped": {
            $nin: ["ready-to-ship", "cancelled", "pending", "delivered"],
          },
        },
      },
      {
        $match: {
          "products.status": {
            $nin: ["cancelled", "delivered"],
          },
        },
      },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
          reason: "$products.cancelReason",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
          reason: 1,
        },
      }, // Match orders by status
      { $count: "totalDocuments" }, // Count the total number of documents
    ];

    const [{ totalDocuments }] = await Order.aggregate(
      totalDocumentsCountPipeline
    );

    let duplicate = "";
    let count = 1;

    products = await Promise.all(
      products.map(async (items, index) => {
        if (items.id === duplicate) {
          count++;
        } else {
          count = 1;
        }

        const orderData = await Order.findById(items.id);

        const indexVal = orderData.products.findIndex((p) => {
          return (
            p.productId.toString() === items.productId._id.toString() &&
            p.size === items.size
          );
        });

        items.subOrderId = `${items.id}_${indexVal + 1}`;

        duplicate = items.id;
        return {
          ...items,
          _id: items.id,
          orderId: items.id,
          id: index,
        };
      })
    );

    res
      .status(200)
      .json({ products, totalPages: Math.ceil(totalDocuments / pageSize) });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.rateOrder = async (req, res) => {
  try {
    const { orderId, subOrderId, rating, review } = req.body;

    if (!orderId || !subOrderId || !rating || !review) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newRating = new Rating({
      orderId,
      subOrderId,
      rating,
      review,
    });

    let order = await Order.findOne({ _id: orderId });

    const orderPosition = parseInt(subOrderId.split("_")[1]);

    let indexVal = 0;

    let productId;

    for (const product of order.products) {
      if (indexVal === orderPosition - 1) {
        product.rating = {
          rating,
          review,
        };
        productId = product.productId;
      }
    }

    await order.save();

    const product = await Product.findOne({ _id: productId });

    if (product.rating) {
      product.rating.push({ rating, review });
    } else {
      product.rating = [{ rating, review }];
    }

    newRating.productId = product._id;

    await product.save();
    await newRating.save();

    res.status(200).json({ message: "Status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.generateOrderReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const orders = await Order.find({
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    }).populate("customer");

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet("Orders");

    worksheet.addRow([
      "Order Status",
      "Sub Order ID",
      "Order Date",
      "Customer Name",
      "Product Name",
      "SKU",
      "VSKU",
      "Size",
      "Quantity",
      "Price",
      "Promo Discount",
    ]);

    for (const order of orders) {
      let count = 0;
      for (const product of order.products) {
        try {
          count++;
          const productData = await Product.findById(product.productId);
          const orderId = `${order._id}_${count}`;
          const { title, sku } = productData;
          const { quantity, productValue, vsku, shipped, date, size, promo } =
            product;

          worksheet.addRow([
            shipped,
            orderId,
            order.createdAt,
            `${order.customer.fname} ${order.customer.lname}`,
            title,
            sku,
            vsku,
            size,
            quantity,
            productValue,
            promo ? promo : 0,
          ]);
        } catch (error) {
          console.error(error);
          return res.status(500).send("Error fetching product details");
        }
      }
    }

    const formattedStartDate = new Date(startDate).getTime();
    const formattedEndDate = new Date(endDate).getTime();

    const fileName = `orders_${formattedStartDate}_${formattedEndDate}_${Date.now()}.xlsx`;

    const filePath = path.join(
      __dirname,
      `../../files/ordersReports/${fileName}`
    );

    await workbook.xlsx.writeFile(filePath);

    const report = new Report({
      reportType: "order",
      fromDate: new Date(startDate),
      toDate: new Date(endDate),
      fileName,
    });

    await report.save();

    const activityLog = new ActivityLog({
      activityType: "order_report",
      adminId: req.params.id,
      link: "/order/files/excell/orders/reports/" + fileName,
      metadata: { report },
    });
    await activityLog.save();

    res.send("Successfully generated");
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getAllReports = async (req, res) => {
  try {
    const reports = await Report.find({ reportType: "order" }).sort({
      createdAt: -1,
    });

    res.status(200).json({ load: reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getOrderReports = async (req, res) => {
  try {
    const { filename } = req.params;

    // Stream the file as response
    res.sendFile(path.join(__dirname, "../../files/ordersReports", filename));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.initiateReturnOrder = async (req, res) => {
  try {
    const { filename } = req.params;

    // Stream the file as response
    res.sendFile(path.join(__dirname, "../../files/ordersReports", filename));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.returnOrder = async (req, res) => {
  try {
    const { subOrderId, question, answer, bankDetails } = req.body;
    const orderId = subOrderId.split("_")[0];
    const position = subOrderId.split("_")[1];

    if (!answer || !question) {
      return res
        .status(404)
        .json({ message: "Reason is required for cancellation." });
    }

    const orderData = await Order.findOne({ _id: orderId });

    if (!orderData) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (orderData.paymentMethod === "COD") {
      orderData.products[position - 1].logs.push({
        date: Date.now(),
        note: `subOrderId : ${subOrderId}, return initiated`,
        orderType: "return",
        currentStatus: "return_initiated",
        paymentMethod: "COD",
      });

      orderData.products[position - 1].bankDetails = bankDetails;

      orderData.allLogs.push({
        date: Date.now(),
        note: `subOrderId : ${subOrderId} return initiated`,
        orderType: "return",
        paymentDetails: "COD",
        paymentMethod: "COD",
      });
    } else {
      orderData.products[position - 1].logs.push({
        date: Date.now(),
        note: `subOrderId : ${subOrderId}, return initiated`,
        orderType: "CARD",
        currentStatus: "return_initiated",
        paymentMethod: "CARD",
      });

      orderData.allLogs.push({
        date: Date.now(),
        note: `subOrderId : ${subOrderId} return initiated`,
        orderType: "return",
        paymentDetails: "CARD",
        paymentMethod: "CARD",
      });
    }

    orderData.products[position - 1].returnReason = { answer, question };
    orderData.products[position - 1].isReturnInitiated = true;

    await orderData.save();

    await (await orderData.populate("products.productId")).populate("customer");

    const mailOptions = {
      from: "dev.amarnath@ekkdigitalvyapar.com",
      to: orderData.customer.email,
      subject: "Order Cancelled",
      html: editSuccessEmail(
        "Order Cancellation successful",
        `Your order with id ${subOrderId} has been cancelled, if you did not cancel this order, please reach out to the administrator at support@fabgalaxy.com for assistance.`
      ),
    };

    console.log("started email");

    await transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log("Email sent:", info.response);
        return res.status(200).json({ message: "Order cancelled" });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getAllPendingReturnOrders = async (req, res) => {
  try {
    let { page, searchTerm, pageSize, searchField } = req.query;
    page = page ? parseInt(page) - 1 : 0; // Adjust page number to 0-indexed
    pageSize = 20; // Default page size
    const skip = page * pageSize;

    let matchQuery = { status: "success" }; // Default filter by status

    const pipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      {
        $match: {
          "products.isReturnInitiated": true,
        },
      },
      {
        $match: {
          "products.isReturnAccepted": {
            $nin: [true],
          },
        },
      },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      {
        $lookup: {
          from: "users", // Assuming your products collection is named "products"
          localField: "customer",
          foreignField: "_id",
          as: "userData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          isDownloaded: "$products.isLabelDownloaded",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
          reason: "$products.returnReason",
          userData: "$userData",
          logs: "$products.logs",
          returnDate: "$products.returnReason",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
          shipped: 1,
          reason: 1,
          reason: 1,
          isDownloaded: 1,
          userData: 1,
          logs: 1,
          returnDate: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip }, // Skip documents based on page number and page size
      { $limit: pageSize },
    ];

    if (searchTerm && searchField && searchField !== "all") {
      // Add $match stage to filter products based on search criteria for a specific field
      const fieldToSearch =
        searchField === "orderId"
          ? "id"
          : searchField === "product"
          ? "productId.title"
          : searchField;
      const matchStage = {
        $match: {
          [fieldToSearch]: { $regex: searchTerm, $options: "i" },
        },
      };
      pipeline.push(matchStage);
    } else if (searchTerm) {
      // Add $match stage to filter products based on search criteria for all fields
      const matchStage = {
        $match: {
          $or: [
            { sku: { $regex: searchTerm, $options: "i" } },
            { vsku: { $regex: searchTerm, $options: "i" } },
            { "productId.title": { $regex: searchTerm, $options: "i" } },
            { id: { $regex: searchTerm, $options: "i" } }, // Assuming "productId" contains the product document
          ],
        },
      };
      pipeline.push(matchStage);
    }

    let products = await Order.aggregate(pipeline);

    const totalDocumentsCountPipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      {
        $match: {
          "products.isReturnInitiated": true,
        },
      },
      {
        $match: {
          "products.isReturnAccepted": {
            $nin: [true],
          },
        },
      },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
          reason: "$products.cancelReason",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
          reason: 1,
        },
      }, // Match orders by status
      { $count: "totalDocuments" }, // Count the total number of documents
    ];

    const [{ totalDocuments }] = await Order.aggregate(
      totalDocumentsCountPipeline
    );

    let duplicate = "";
    let count = 1;

    products = await Promise.all(
      products.map(async (items, index) => {
        if (items.id === duplicate) {
          count++;
        } else {
          count = 1;
        }

        const orderData = await Order.findById(items.id);

        const indexVal = orderData.products.findIndex((p) => {
          return (
            p.productId.toString() === items.productId._id.toString() &&
            p.size === items.size
          );
        });

        items.subOrderId = `${items.id}_${indexVal + 1}`;

        duplicate = items.id;
        return {
          ...items,
          _id: items.id,
          orderId: items.id,
          id: index,
        };
      })
    );

    res
      .status(200)
      .json({ products, totalPages: Math.ceil(totalDocuments / pageSize) });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.createReturnConsignment = async (req, res) => {
  try {
    const { orders } = req.body;

    if (!orders || !orders.length) {
      return res.status(400).json({ message: "No orders found" });
    }

    const consignments = [];

    for (const { orderId, subOrderId } of orders) {
      const order = await Order.findOne({ _id: orderId })
        .populate("customer")
        .populate("products.productId");

      if (!order) {
        return res
          .status(400)
          .json({ message: `Order with ID ${orderId} not found` });
      }

      const position = parseInt(subOrderId.split("_")[1]);

      const product = order.products[position - 1];

      if (!product) {
        return res.status(400).json({
          message: `Product at position ${position} not found in order ${orderId}`,
        });
      }

      const productData = product.productId;

      if (!productData) {
        return res.status(400).json({
          message: `Product with ID ${product.productId._id} not found`,
        });
      }

      // Create a consignment object for the product
      const consignment = {
        customer_code: "GL083",
        service_type_id: "GROUND EXPRESS",
        load_type: "NON-DOCUMENT",
        description: "FAB GALAXY PRODUCTS",
        dimension_unit: "cm",
        length: 21,
        width: 15,
        height: 3 * product.quantity,
        weight_unit: "kg",
        weight: productData.weight * product.quantity,
        declared_value:
          (productData.fcp - (productData.fcp * product.promo) / 100) *
          product.quantity,
        cod_amount: "",
        cod_collection_mode: "",
        num_pieces: "1",
        destination_details: {
          name: "Fabalaxy warehouse",
          phone: "7990762155",
          alternate_phone: "9876543210",
          alternate_phone: "9562530330",
          address_line_1:
            "demo address demo address demo address demo address demo address demo address",
          address_line_2: "demo addressdemo addressdemo address",
          pincode: "394230",
          city: "Surat",
          state: "Gujarart",
        },

        origin_details: {
          name: `${order.address[0].fname} ${order.address[0].lname}`,
          phone: order.address[0].contact,
          alternate_phone: "9978973843",
          address_line_1: order.address[0].addressOne,
          address_line_2: order.address[0].addressTwo,
          pincode: order.address[0].postalCode,
          city: order.address[0].city,
          state: order.address[0].province,
        },
        customer_reference_number: `${order._id}_${position} | ${productData.sku}`,
        pieces_detail: [
          {
            description: productData.sku,
            declared_value:
              (productData.mrp -
                (productData.mrp *
                  (parseFloat(product.promo) + parseFloat(productData.td))) /
                  100) *
              product.quantity,
            weight: productData.weight * product.quantity,
            height: 3 * product.quantity,
            length: 21,
            width: 15,
          },
        ],
      };

      consignments.push(consignment);
    }

    await axios
      .post(
        "https://dtdcapi.shipsy.io/api/customer/integration/consignment/softdata",
        { consignments },
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": "4073ba7e4966d74fc5a6afb1991862",
          },
        }
      )
      .then(async (response) => {
        if (response.data.data[0].success) {
          const promises = response.data.data.map(async (items) => {
            if (items.success === true) {
              let currOrder = await Order.findOne({
                _id: items.customer_reference_number.split("_")[0],
              });

              if (!currOrder) {
                return res.status(404).send({ message: "Order not found" });
              }

              const proPosition = items.customer_reference_number.split("_")[1];
              const productIndex = parseInt(proPosition) - 1;

              let currData = { ...currOrder.products[productIndex]._doc };

              currData.logs.push({
                date: Date.now(),
                note: "Order return consignment created successfully",
                orderType: "return_accepted",
                currentStatus: "return_ready_to_shipped",
                paymentMethod: currOrder.paymentMethod,
              });

              currOrder.products[productIndex] = {
                ...currData,
                isReturnAccepted: true,

                returnShippingDetails: items,
                returnStatus: "ready_to_shipped",
              };

              await currOrder.save();
            }
          });

          // Wait for all promises to resolve
          await Promise.all(promises);

          return res.send({
            response: response.data,
            status: response.status,
            request: consignments,
          });
        } else {
          return res.status(404).send("Error");
        }
      })
      .catch((err) => {
        return res.status(404).send(err);
      });
  } catch (error) {
    console.error("Error creating shipping consignment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getAllReturnIntransit = async (req, res) => {
  try {
    let { page, searchTerm, pageSize, searchField } = req.query;
    page = page ? parseInt(page) - 1 : 0; // Adjust page number to 0-indexed
    pageSize = 20; // Default page size
    const skip = page * pageSize;

    let matchQuery = { status: "success" }; // Default filter by status

    const pipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      {
        $match: {
          "products.isReturnInitiated": true,
        },
      },
      {
        $match: {
          "products.isReturnAccepted": true,
        },
      },
      {
        $match: {
          "products.returnStatus": "ready_to_shipped",
        },
      },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      {
        $lookup: {
          from: "users", // Assuming your products collection is named "products"
          localField: "customer",
          foreignField: "_id",
          as: "userData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          isDownloaded: "$products.isLabelDownloaded",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
          reason: "$products.returnReason",
          userData: "$userData",
          logs: "$products.logs",
          returnDate: "$products.returnReason",
          returnStatus: "$products.returnStatus",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
          shipped: 1,
          reason: 1,
          reason: 1,
          isDownloaded: 1,
          userData: 1,
          logs: 1,
          returnDate: 1,
          returnStatus: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip }, // Skip documents based on page number and page size
      { $limit: pageSize },
    ];

    if (searchTerm && searchField && searchField !== "all") {
      // Add $match stage to filter products based on search criteria for a specific field
      const fieldToSearch =
        searchField === "orderId"
          ? "id"
          : searchField === "product"
          ? "productId.title"
          : searchField;
      const matchStage = {
        $match: {
          [fieldToSearch]: { $regex: searchTerm, $options: "i" },
        },
      };
      pipeline.push(matchStage);
    } else if (searchTerm) {
      // Add $match stage to filter products based on search criteria for all fields
      const matchStage = {
        $match: {
          $or: [
            { sku: { $regex: searchTerm, $options: "i" } },
            { vsku: { $regex: searchTerm, $options: "i" } },
            { "productId.title": { $regex: searchTerm, $options: "i" } },
            { id: { $regex: searchTerm, $options: "i" } }, // Assuming "productId" contains the product document
          ],
        },
      };
      pipeline.push(matchStage);
    }

    let products = await Order.aggregate(pipeline);

    const totalDocumentsCountPipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      {
        $match: {
          "products.isReturnInitiated": true,
        },
      },
      {
        $match: {
          "products.isReturnAccepted": true,
        },
      },
      {
        $match: {
          "products.returnStatus": "ready_to_shipped",
        },
      },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
          reason: "$products.cancelReason",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
          reason: 1,
        },
      }, // Match orders by status
      { $count: "totalDocuments" }, // Count the total number of documents
    ];

    const [{ totalDocuments }] = await Order.aggregate(
      totalDocumentsCountPipeline
    );

    let duplicate = "";
    let count = 1;

    products = await Promise.all(
      products.map(async (items, index) => {
        if (items.id === duplicate) {
          count++;
        } else {
          count = 1;
        }

        const orderData = await Order.findById(items.id);

        const indexVal = orderData.products.findIndex((p) => {
          return (
            p.productId.toString() === items.productId._id.toString() &&
            p.size === items.size
          );
        });

        items.subOrderId = `${items.id}_${indexVal + 1}`;

        duplicate = items.id;
        return {
          ...items,
          _id: items.id,
          orderId: items.id,
          id: index,
        };
      })
    );

    res
      .status(200)
      .json({ products, totalPages: Math.ceil(totalDocuments / pageSize) });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getAllReturnDeliveredOrders = async (req, res) => {
  try {
    let { page, searchTerm, pageSize, searchField } = req.query;
    page = page ? parseInt(page) - 1 : 0; // Adjust page number to 0-indexed
    pageSize = 20; // Default page size
    const skip = page * pageSize;

    let matchQuery = { status: "success" }; // Default filter by status

    const pipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      {
        $match: {
          "products.returnStatus": "Delivered",
        },
      },

      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      {
        $lookup: {
          from: "users", // Assuming your products collection is named "products"
          localField: "customer",
          foreignField: "_id",
          as: "userData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          isDownloaded: "$products.isLabelDownloaded",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.returnStatus",
          reason: "$products.cancelReason",
          userData: "$userData",
          logs: "$products.logs",
          deliveryData: "$products.returnDeliveryData",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
          shipped: 1,
          reason: 1,
          reason: 1,
          isDownloaded: 1,
          userData: 1,
          logs: 1,
          deliveryData: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip }, // Skip documents based on page number and page size
      { $limit: pageSize },
    ];

    if (searchTerm && searchField && searchField !== "all") {
      // Add $match stage to filter products based on search criteria for a specific field
      const fieldToSearch =
        searchField === "orderId"
          ? "id"
          : searchField === "product"
          ? "productId.title"
          : searchField;
      const matchStage = {
        $match: {
          [fieldToSearch]: { $regex: searchTerm, $options: "i" },
        },
      };
      pipeline.push(matchStage);
    } else if (searchTerm) {
      // Add $match stage to filter products based on search criteria for all fields
      const matchStage = {
        $match: {
          $or: [
            { sku: { $regex: searchTerm, $options: "i" } },
            { vsku: { $regex: searchTerm, $options: "i" } },
            { "productId.title": { $regex: searchTerm, $options: "i" } },
            { id: { $regex: searchTerm, $options: "i" } }, // Assuming "productId" contains the product document
          ],
        },
      };
      pipeline.push(matchStage);
    }

    let products = await Order.aggregate(pipeline);

    const totalDocumentsCountPipeline = [
      { $match: matchQuery }, // Match orders by status
      { $unwind: "$products" }, // Unwind products array
      {
        $match: {
          "products.returnStatus": "Delivered",
        },
      },
      {
        $match: {
          "products.status": {
            $nin: ["cancelled", "delivered"],
          },
        },
      },
      {
        $lookup: {
          from: "products", // Assuming your products collection is named "products"
          localField: "products.productId",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" }, // Unwind the productData array
      {
        $addFields: {
          productId: "$productData",
          id: { $toString: "$_id" }, // Convert ObjectId to string for searching
          subOrderId: { $toString: "$_id" },
          sku: "$productData.sku",
          vsku: "$products.vsku",
          quantity: "$products.quantity",
          size: "$products.size",
          createdAt: "$createdAt",
          paymentMethod: "$paymentMethod",
          shipped: "$products.shipped",
          reason: "$products.cancelReason",
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          productId: 1,
          id: 1,
          subOrderId: 1,
          sku: 1,
          vsku: 1,
          quantity: 1,
          size: 1,
          createdAt: 1,
          paymentMethod: 1,
          shipping: 1,
          reason: 1,
        },
      }, // Match orders by status
      { $count: "totalDocuments" }, // Count the total number of documents
    ];

    const [{ totalDocuments }] = await Order.aggregate(
      totalDocumentsCountPipeline
    );

    let duplicate = "";
    let count = 1;

    products = await Promise.all(
      products.map(async (items, index) => {
        if (items.id === duplicate) {
          count++;
        } else {
          count = 1;
        }

        const orderData = await Order.findById(items.id);

        const indexVal = orderData.products.findIndex((p) => {
          return (
            p.productId.toString() === items.productId._id.toString() &&
            p.size === items.size
          );
        });

        items.subOrderId = `${items.id}_${indexVal + 1}`;

        duplicate = items.id;
        return {
          ...items,
          _id: items.id,
          orderId: items.id,
          id: index,
        };
      })
    );

    res
      .status(200)
      .json({ products, totalPages: Math.ceil(totalDocuments / pageSize) });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
