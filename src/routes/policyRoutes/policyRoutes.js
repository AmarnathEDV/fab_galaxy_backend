const {
  trackOrder,
} = require("../../controller/orderTracking/orderTrackingController");
const {
  editPolicy,
  getPolicy,
} = require("../../controller/policy/policyController");
const userAuth = require("../../middlewares/auth/userAuth");

const router = require("express").Router();

router.post("/update", userAuth, editPolicy);

router.get("/get-all", getPolicy);

module.exports = router;
