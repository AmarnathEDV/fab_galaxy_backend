const {
  getInventoryCount,
  getNonPausedProducts,
  updateStock,
  pauseVarient,
  getLowStockProducts,
  getOutOfStockProducts,
  getPausedStocks,
  getAllSubcategory,
} = require("../../controller/inventory/inventoryController");
const userAuth = require("../../middlewares/auth/userAuth");

const router = require("express").Router();

router.get("/inventory-products-count", userAuth, getInventoryCount);
router.post("/all-products", userAuth, getNonPausedProducts);
router.post("/get-out-stock", userAuth, getOutOfStockProducts);
router.post("/get-low-stock", userAuth, getLowStockProducts);
router.post("/get-paused", userAuth,getPausedStocks)
router.post("/update-stock", userAuth, updateStock);
router.post("/pause-varient", userAuth, pauseVarient);
router.get("/get-subcategory",userAuth,getAllSubcategory)
// router.post("/webhooks",stripeWebhoook)

module.exports = router;
