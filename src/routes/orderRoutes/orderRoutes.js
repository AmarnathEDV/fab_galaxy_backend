const {
  getAllOrders,
  getAllOrdersAdmin,
  createShippingConsignment,
  checkPincodeAvailablilty,
  fetchReadyToshipOrders,
  generateShippingLabel,
  getMergedPdf,
  getSinglePdf,
  getAllProductsInCart,
  getMergedManifest,
  getOrderCount,
  
  fetchCancelledOrders,
  updateOrderStatus,
  getAllInTransitOrders,
  getAllDeliveredOrders,
  rateOrder,
  generateOrderReport,
  getOrderReports,
  getAllReports,
  returnOrder,
  getAllPendingReturnOrders,
  createReturnConsignment,
  getAllReturnIntransit,
  getAllReturnDeliveredOrders,
  cancelOrder,

} = require("../../controller/orders/orderController");

const userAuth = require("../../middlewares/auth/userAuth");

const router = require("express").Router();

router.get("/", userAuth, getAllOrders);



router.get("/get-pending-order-count", userAuth, getOrderCount);

router.get("/get-all-order", userAuth, getAllOrdersAdmin);

router.post("/accept-order", userAuth, createShippingConsignment);

router.get("/check-service", userAuth, checkPincodeAvailablilty);

router.get("/get-ready-to-ship", userAuth, fetchReadyToshipOrders);

router.post("/download-label", userAuth, generateShippingLabel);

router.get("/files/pdf/merged/:filename", getMergedPdf);
router.get("/files/pdf/single/:filename", getSinglePdf);
router.get("/files/pdf/manifest/merged/:filename", getMergedManifest);
router.get("/files/excell/orders/reports/:filename", getOrderReports);

router.get("/get-order-on-hold", userAuth, getAllProductsInCart);

router.post("/cancel-order", userAuth, cancelOrder);

router.get("/get-cancelled-orders", userAuth, fetchCancelledOrders);

router.get("/update-order-status", userAuth, updateOrderStatus);

router.get("/get-intransit", userAuth, getAllInTransitOrders);

router.get("/get-delivered", userAuth, getAllDeliveredOrders);

router.post("/order-rating", userAuth , rateOrder)

router.post("/generate-report", userAuth, generateOrderReport)

router.post("/return-order", userAuth, returnOrder)

router.get("/get-pending-returns", userAuth, getAllPendingReturnOrders)

router.post("/accept-return",userAuth, createReturnConsignment)

router.get("/get-return-intransit", userAuth, getAllReturnIntransit)

router.get("/get-return-delivered",userAuth,getAllReturnDeliveredOrders)



module.exports = router;
