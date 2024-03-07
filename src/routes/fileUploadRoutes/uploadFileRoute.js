const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userAuth = require("../../middlewares/auth/userAuth.js");
const path = require("path");
const multer = require("multer");
const sharp = require("sharp"); // Image processing library for compression
const fs = require("fs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "src/uploads/");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 10 MB limit
});




router.post("/", userAuth, upload.single("file"), (req, res, next) => {
  
    next();
  
}, (req, res) => {
  console.log("file" + req.file.filename);
  res.status(200).json({ load: req.file.filename });
});

router.get("/:filename", (req, res) => {
  const filename = req.params.filename;
  res.sendFile(path.join(__dirname, "../../uploads", filename));
});

module.exports = router;