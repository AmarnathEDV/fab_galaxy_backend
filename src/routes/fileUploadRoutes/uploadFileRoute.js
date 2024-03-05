const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userAuth = require("../../middlewares/auth/userAuth");
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

const upload = multer({ storage: storage });

// Middleware function to compress and resize images while maintaining aspect ratio
// const optimizeImage = async (req, res, next) => {
//   if (!req.file) {
//     return next(); // No file to process
//   }
//   try {
//     // Use Sharp to resize and compress image while maintaining aspect ratio
//     const optimizedImageBuffer = await sharp(req.file.path)
//       .resize({ width: 2400 }) // Adjust maximum width as needed
//       .jpeg({ quality: 80 }) // Adjust quality (0-100) as needed
//       .toBuffer();

//     // Generate a temporary filename for the optimized image
//     const optimizedImagePath = req.file.path + '.optimized';

//     // Write the optimized image buffer to a temporary file
//     fs.writeFileSync(optimizedImagePath, optimizedImageBuffer);

//     // Replace the original file with the optimized image
//     fs.renameSync(optimizedImagePath, req.file.path);

//     next();
//   } catch (error) {
//     console.log(error)
//     return res.status(500).json({ error: "Image processing failed" });
//   }
// };

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