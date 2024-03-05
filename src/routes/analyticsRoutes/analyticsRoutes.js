const {
  getAllAnalytics, getActivityLogs,
} = require("../../controller/analyticsController/analyticsController.js");
const userAuth = require("../../middlewares/auth/userAuth.js");

const router = require("express").Router();

router.get("/", userAuth, getAllAnalytics);

router.get("/activity-logs",userAuth,getActivityLogs)

module.exports = router;
