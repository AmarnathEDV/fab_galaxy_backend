const {
  getCart,
  removeFromCart,
  addToCart,
  updateQuantityInCart,
  moveToCart,
  updatedSelectedCart,
} = require("../../controller/cart/cartController");

const userAuth = require("../../middlewares/auth/userAuth");

const router = require("express").Router();

router.post("/", userAuth, getCart);
router.post("/remove", userAuth, removeFromCart);
router.post("/update-quantity", userAuth, updateQuantityInCart);
router.post("/move-cart",userAuth,moveToCart)

router.post("/add", userAuth, addToCart);

router.post("/update-selected", userAuth,updatedSelectedCart)

module.exports = router;
