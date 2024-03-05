const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userAuth = require("../../middlewares/auth/userAuth");
const {
  createProduct,
  getAllProductsForSubAdmin,
  verifyQC,
  productListing,
  getProduct,
  editProduct,
  getAllProductsPublished,
  unmarkQC,
  getAllAttributes,
  getBanners,
  getProductID,
  
  searchProduct,
  saveAsDraft,
  getDrafts,
  saveProductForQC,
  discardEditListing,
  discardListing,
  getDraftDetails,
  getCargoryID,
} = require("../../controller/product/productListingController");

router.get("/", productListing);
router.get("/attributes",getAllAttributes)
router.get("/details", getProduct);
router.get("/get-banners",getBanners)
router.get("/get-product-id",getProductID)
router.get("/get-category-id",getCargoryID)
router.get("/get-testing-product",getProduct)


router.use(userAuth);
router.get("/sub_admin", getAllProductsForSubAdmin);
router.get("/published",getAllProductsPublished)
router.get("/edit", getProduct);
router.get("/drafts",getDrafts)

router.get("/mark",userAuth, verifyQC);
router.get("/unmark",userAuth, unmarkQC);
router.post("/save-draft",userAuth,saveAsDraft)

router.post("/",userAuth, createProduct);
router.post("/edit/:productId",userAuth, editProduct);
router.get("/search", userAuth, searchProduct)
router.get("/save-product-qc",saveProductForQC)
router.get("/cancel-product-qc",discardListing)
router.get("/cancel-product-qc-edit",discardEditListing)
router.get("/get-draft-details",getDraftDetails)


module.exports = router;
