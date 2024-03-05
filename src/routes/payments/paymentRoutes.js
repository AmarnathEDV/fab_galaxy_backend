const { createOrderIntent, stripeWebhoook } = require("../../controller/payments/paymentController");
const userAuth = require("../../middlewares/auth/userAuth");

const router = require("express").Router();


router.post("/create-payment-intent",userAuth, createOrderIntent);
router.post("/webhooks",stripeWebhoook)

module.exports = router;