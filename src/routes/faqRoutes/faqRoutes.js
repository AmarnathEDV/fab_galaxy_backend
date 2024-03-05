const { createFAQ, getFAQ, updateFAQPosition, deleteFAQ } = require("../../controller/faq/faqController.js");
const userAuth = require("../../middlewares/auth/userAuth.js");

const router = require("express").Router();

router.post("/", userAuth, createFAQ);
router.get("/", getFAQ);
router.get("/remove",userAuth,deleteFAQ)

router.post("/update",userAuth, updateFAQPosition);

module.exports = router;
