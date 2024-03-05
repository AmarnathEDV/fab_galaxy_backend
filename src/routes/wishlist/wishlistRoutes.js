const { userLogin, createPublicUser, verifyOTP, resendOTP } = require("../../controller/user/userAuthController.js");
const { addToWishlist, getWishList, removeFromWishlist } = require("../../controller/wishlist/wishListController.js");
const userAuth = require("../../middlewares/auth/userAuth.js");
const { userValidator } = require("../../middlewares/validators/userValidators.js");

const router = require("express").Router();


router.post("/",userAuth,getWishList)
router.post("/remove",userAuth,removeFromWishlist)
router.get("/add",userAuth, addToWishlist);



module.exports = router;

