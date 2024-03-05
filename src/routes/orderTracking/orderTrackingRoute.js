
const { trackOrder } = require("../../controller/orderTracking/orderTrackingController.js");
const userAuth = require("../../middlewares/auth/userAuth.js");

const router = require("express").Router();


router.post("/track-order", trackOrder);


module.exports = router;