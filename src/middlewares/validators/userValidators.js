const Joi = require("joi");
const { customerYupSchema } = require("../../utils/validationSchema/customerYupSchema");


const customerValidationLogin = async (req, res, next) => {
  try {
    req.body = await customerYupSchema.login.validate(req.body);
    next();
  } catch (err) {
    return res.status(404).send({ message: err.errors[0] });
  }
};

const customerValidationSignup = async (req, res, next) => {
  try {
    req.body = await customerYupSchema.signup.validate(req.body);
    next();
  } catch (err) {
    return res.status(404).send({ message: err.errors[0] });
  }
};

module.exports.userValidator = {
  customerValidationLogin,
  customerValidationSignup,
};
