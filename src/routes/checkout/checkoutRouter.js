const { checkout, getCheckoutPageLoad } = require("../../controller/checkout/checkoutController");
const userAuth = require("../../middlewares/auth/userAuth");

const router = require("express").Router();

router.post("/", userAuth, checkout);
router.get("/",userAuth,getCheckoutPageLoad)


module.exports = router;
