const { createFAQ, getFAQ, updateFAQPosition, deleteFAQ } = require("../../controller/faq/faqController");
const userAuth = require("../../middlewares/auth/userAuth");

const router = require("express").Router();

router.post("/", userAuth, createFAQ);
router.get("/", getFAQ);
router.get("/remove",userAuth,deleteFAQ)

router.post("/update",userAuth, updateFAQPosition);

module.exports = router;
