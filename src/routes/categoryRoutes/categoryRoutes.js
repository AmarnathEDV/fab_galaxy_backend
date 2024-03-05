const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userAuth = require("../../middlewares/auth/userAuth"); 
const { fetchAllCategory, getHeaderCategory, getAllSubCategory, updateCategory, updateCategoryBanner, getCategoryDetails, getAllAttributes } = require("../../controller/category/categoryController");

router.get("/", userAuth, fetchAllCategory); 

router.get("/get_all", getHeaderCategory)

router.get("/home-collection", userAuth, getAllSubCategory)

router.get("/update", userAuth,updateCategory)


router.get("/update-banner",userAuth,updateCategoryBanner)

router.get("/get-category-details",getCategoryDetails)

router.get("/get-occasion", getAllAttributes)



module.exports = router;
