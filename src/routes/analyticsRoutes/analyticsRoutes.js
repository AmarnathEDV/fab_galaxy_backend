const {
  getAllAnalytics, getActivityLogs,
} = require("../../controller/analyticsController/analyticsController");
const userAuth = require("../../middlewares/auth/userAuth");

const router = require("express").Router();

router.get("/", userAuth, getAllAnalytics);

router.get("/activity-logs",userAuth,getActivityLogs)

module.exports = router;
