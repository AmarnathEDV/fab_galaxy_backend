const { createOrderIntent, stripeWebhoook } = require("../../controller/payments/paymentController.js");
const userAuth = require("../../middlewares/auth/userAuth.js");

const router = require("express").Router();


router.post("/create-payment-intent",userAuth, createOrderIntent);
router.post("/webhooks",stripeWebhoook)

module.exports = router;