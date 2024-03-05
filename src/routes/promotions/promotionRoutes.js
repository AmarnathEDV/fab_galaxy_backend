const {
    createPromotion,
    addProductToPromotion,
    updatePostionPromotion,
    getAllPromotions,
    getPromotionDetails,
    deletePromotion,
    updateProductDiscount,
    removeProductFromPromotion,
  } = require("../../controller/promotion/promotionController.js");
  const userAuth = require("../../middlewares/auth/userAuth.js");
  
  const router = require("express").Router();
  
  router.post("/", userAuth, createPromotion);
  
  router.post("/products", userAuth, addProductToPromotion);
  
  router.get("/update-position", userAuth, updatePostionPromotion);
  
  router.get("/", getAllPromotions);
  
  router.get("/get-details",getPromotionDetails)

  router.get("/delete",userAuth,deletePromotion)

  router.get("/remove-product", userAuth,removeProductFromPromotion)

  router.get("/update-discount", userAuth, updateProductDiscount);
  
  module.exports = router;
  