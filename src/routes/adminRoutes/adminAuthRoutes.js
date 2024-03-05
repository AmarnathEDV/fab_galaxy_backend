const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userAuth = require("../../middlewares/auth/userAuth.js");

const { adminLogin } = require("../../controller/admin/adminAuth.js");
const Admin = require("../../database/admin/adminSchema.js");

const {
  fetchAllSubAdmin,
  manageAdmin,
  editAdmin,
  changePassword,
  createAdmin,
  createSubAdmin,
} = require("../../controller/admin/adminManageController.js");
// router.post("/create-admin",createAdmin)

router.post("/create-subadmin", userAuth, createSubAdmin);

router.post("/login", adminLogin);

router.get("/get_all_admin", userAuth, fetchAllSubAdmin);

router.get("/manage_admin", userAuth, manageAdmin);

router.post("/edit_admin", userAuth, editAdmin);

router.post("/change-password", userAuth, changePassword);

router.get("/auth", userAuth, async (req, res) => {

  const adminData = await Admin.findOne({ _id: req.params.id });
  res.status(200).json({ adminData });
});

module.exports = router;
