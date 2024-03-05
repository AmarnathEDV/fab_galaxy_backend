const { getAllReports } = require("../../controller/orders/orderController.js");
const userAuth = require("../../middlewares/auth/userAuth.js");

const router = require("express").Router();

router.get("/order", userAuth, getAllReports)

module.exports = router;