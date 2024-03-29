const {
  createCollection,
  addProductToCollection,
  updatePostionCollection,
  getAllCollections,
  getCollectionDetails,
  deleteProductFromCollection,
} = require("../../controller/collection/collectionController.js");
const userAuth = require("../../middlewares/auth/userAuth.js");

const router = require("express").Router();

router.post("/", userAuth, createCollection);

router.post("/products", userAuth, addProductToCollection);

router.get("/update-position", userAuth, updatePostionCollection);

router.get("/", getAllCollections);

router.get("/get-details",getCollectionDetails)

router.get("/delete",userAuth, deleteProductFromCollection);

module.exports = router;
