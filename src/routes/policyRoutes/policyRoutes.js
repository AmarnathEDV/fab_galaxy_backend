const {
  trackOrder,
} = require("../../controller/orderTracking/orderTrackingController.js");
const {
  editPolicy,
  getPolicy,
} = require("../../controller/policy/policyController.js");
const userAuth = require("../../middlewares/auth/userAuth.js");

const router = require("express").Router();

router.post("/update", userAuth, editPolicy);

router.get("/get-all", getPolicy);

module.exports = router;
