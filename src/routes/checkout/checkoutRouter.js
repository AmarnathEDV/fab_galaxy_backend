const { checkout, getCheckoutPageLoad } = require("../../controller/checkout/checkoutController.js");
const userAuth = require("../../middlewares/auth/userAuth.js");

const router = require("express").Router();

router.post("/", userAuth, checkout);
router.get("/",userAuth,getCheckoutPageLoad)


module.exports = router;
