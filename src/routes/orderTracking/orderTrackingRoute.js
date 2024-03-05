
const { trackOrder } = require("../../controller/orderTracking/orderTrackingController");
const userAuth = require("../../middlewares/auth/userAuth");

const router = require("express").Router();


router.post("/track-order", trackOrder);


module.exports = router;