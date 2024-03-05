const { addAddress, editAddress, deleteAddress } = require("../../controller/user/userAddressController.js");
const { userLogin, createPublicUser, verifyOTP, resendOTP, editPublicUser, verifyEditOTP, changePassword } = require("../../controller/user/userAuthController.js");
const userAuth = require("../../middlewares/auth/userAuth.js");
const { userValidator } = require("../../middlewares/validators/userValidators.js");

const router = require("express").Router();



router.post("/login", userValidator.customerValidationLogin, userLogin);
router.post("/signup", userValidator.customerValidationSignup, createPublicUser);
router.post("/verify-otp",verifyOTP)
router.post("/resend-otp",resendOTP)
router.post("/add-address",userAuth,addAddress)
router.post("/edit-address/:addressId",userAuth,editAddress)
router.get("/delete-address/:addressId",userAuth,deleteAddress)

router.post("/edit-profile", userAuth,editPublicUser)

router.post("/verify-edit", userAuth,verifyEditOTP)

router.post("/change-password", userAuth,changePassword)

module.exports = router;
