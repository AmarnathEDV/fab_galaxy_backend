const { getAllReports } = require("../../controller/orders/orderController");
const userAuth = require("../../middlewares/auth/userAuth");

const router = require("express").Router();

router.get("/order", userAuth, getAllReports)

module.exports = router;