const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const adminSchema = require("../../Database/admin/adminSchema.js");


const createToken = (_id) => {
  return jwt.sign({ _id }, process.env.SECRET_KET_JWT);
};

module.exports.createSubAdmin = async (req, res) => {
  try {
    let { name, email, password, rules, permission, mobile } = req.body;
    password = await bcrypt.hash(password, 10);
    const exist = await adminSchema.findOne({ email });
    if (exist) {
      return res.status(404).json({ message: "email already exist" });
    }

    const newAdmin = new adminSchema({
      name,
      email,
      password,
      rules,
      mobile,
      userType: "subAdmin",
      permission: permission,
      isBlocked: false,
      isDelete: 0,
    });

    await newAdmin
      .save()
      .then((data) => {
        res.status(200).json({ message: "success", data: data });
      })
      .catch((err) => {
        res.status(404).json({ message: "Something went wrong", error: err });
      });
  } catch (err) {
    res.status(500).json({ message: err });
  }
};

module.exports.fetchAllSubAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const access = await adminSchema.findOne({ _id: id });
    if (access.userType === "mainAdmin") {
      let load = await adminSchema.find({ userType: "subAdmin", isDelete: 0 });
      load = load.map((item) => ({
        ...item._doc,
        id: item._id.toString(),
        _id: { ...item, id: item._id.toString(), status: item.isBlocked },
      }));
      if (load.length > 0) return res.status(200).json({ load, type: "admin" });
      return res.status(200).json({ load: [], type: "admin" });
    } else {
      return res.status(500).json({ message: "UnAuthorized Access" });
    }
  } catch (err) {
    res.status(500).json({ message: err });
  }
};

module.exports.editAdmin = async (req, res) => {
  try {
    let { name, email, password, rules, permission } = req.body;
    let { adminId } = req.query;
    password = await bcrypt.hash(password, 10);
    const load = await adminSchema.findByIdAndUpdate(adminId, {
      name,
      email,
      mobile,
      password,
      rules,
      permission,
    });

    return res.status(200).json({ message: "Success" });
  } catch (err) {
    return res.status(500).json({ message: err });
  }
};

module.exports.manageAdmin = async (req, res) => {
  try {
    const { adminId, action } = req.query;
    const { id } = req.params;
    const access = await adminSchema.findOne({ _id: id });
    if (access.userType === "mainAdmin") {
      let filterQuery = {};
      if (action === "block") {
        filterQuery = {
          isBlocked: true,
        };
      } else if (action === "unblock") {
        filterQuery = {
          isBlocked: false,
        };
      } else if (action === "delete") {
        filterQuery = {
          isDelete: 1,
        };
      }
      await adminSchema.findByIdAndUpdate(adminId, filterQuery)
        .then((load) => {
          return res.status(200).json({ message: "Success" });
        })
        .catch((err) => {
          res.status(404).json({ message: "Something went wrong", error: err });
        });
    } else {
      return res.status(500).json({ message: "UnAuthorized Access" });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: err });
  }
};

module.exports.changePassword = async (req, res) => {
  let { current, password, cPassword } = req.body;
  if (current === password)
    return res.status(404).send({ error: "Password Cannot be old password" });

  const { id } = req.params;
  try {
    const user = await adminSchema.findOne({ _id: id });

    const match = await bcrypt.compare(current, user.password);

    if (match) {
      password = await bcrypt.hash(password, 10);
      const adminData = await adminSchema.findByIdAndUpdate(id, {
        password,
      });
      return res.status(200).json({ adminData });
    } else {
      return res.status(404).send({ error: "Invalid Current Password" });
    }
  } catch (err) {
    return res.status(500).json({ message: err });
  }
};
