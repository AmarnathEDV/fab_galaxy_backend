const {
  createMainBanner,
  getAllBanner,
  updateBanner,
  deleteBanner,
  getAllOtherBanner,
  createOtherBanner,
  updateOtherBanner,
} = require("../../controller/banners/bannerController.js");
const userAuth = require("../../middlewares/auth/userAuth.js");

const router = require("express").Router();

router.get("/", getAllBanner);
router.post("/main", userAuth, createMainBanner);
router.get("/update", userAuth, updateBanner);
router.get("/delete", userAuth, deleteBanner);

router.get("/other", getAllOtherBanner);
router.post("/other", userAuth, createOtherBanner);
router.post("/update/other", userAuth, updateOtherBanner);

module.exports = router;
