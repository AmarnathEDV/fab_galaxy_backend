const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const adminSchema = require("../../Database/admin/adminSchema");


const createToken = (_id) => {
  return jwt.sign({ _id }, process.env.SECRET_KET_JWT);
};


const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    await adminSchema.findOne({ email })
      .then(async (user) => {
        const match = await bcrypt.compare(password, user.password);
        if (match && match.isBlocked !== true && match.isDelete !== 1) {
          
          const token = await createToken(user._id);
          const adminData = {
            userType: user.userType,
            rules: user.rules,
            permission: user.permission,
            id: user._id,
            mobile : user.mobile
          };

          
          res.status(200).json({ token, adminData });
        } else {
          res.status(404).send({ error: "User blocked, contact main admin" });
        }
      })
      .catch((err) => {
        res.status(404).send({ error: "invalid email or password" });
      });
  } catch (err) {
    res.status(500).json({ error: err });
  }
};



module.exports.adminLogin = adminLogin;

