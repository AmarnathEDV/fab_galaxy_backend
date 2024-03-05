const { userLogin, createPublicUser, verifyOTP, resendOTP } = require("../../controller/user/userAuthController");
const { addToWishlist, getWishList, removeFromWishlist } = require("../../controller/wishlist/wishListController");
const userAuth = require("../../middlewares/auth/userAuth");
const { userValidator } = require("../../middlewares/validators/userValidators");

const router = require("express").Router();


router.post("/",userAuth,getWishList)
router.post("/remove",userAuth,removeFromWishlist)
router.get("/add",userAuth, addToWishlist);



module.exports = router;

