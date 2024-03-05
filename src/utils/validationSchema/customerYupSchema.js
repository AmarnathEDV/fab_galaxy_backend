const { isValidObjectId } = require("mongoose");
const yup = require("yup");

const signup = yup.object().shape({
  fname: yup
    .string()
    .trim()
    .required("Name can not be empty")
    .min(5, "first name requires minimum 5 Character required").max(16, "first name cannot exceed 36 Characters")
    .test("isPerfectString", "Enter a valid name", (arg) =>
      /^[A-Za-z ]+$/.test(arg)
    ),
  lname: yup.string().trim().required("Last Name can not be empty").min(1, "minimum one Character required").max(16, "last name cannot exceed 36 Characters"),

  email: yup
    .string()
    .trim()
    .required("Enter you email")
    .test("isvalidEmail", "Enter a valid Email", (arg) =>
      /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(arg)
    ),
  password: yup
    .string()
    .trim()
    .required("Password can not be empty")
    .min(8, "Too short password")
    .max(16, "Too long password")
    .test("isPerfectPasswrod", "Enter a strong password", (arg) =>
      /((?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W])(?!.*\s).{8,16})/.test(arg)
    ),
});

const login = yup.object().shape({
  email: yup
    .string()
    .trim()
    .required("Enter you email")
    .test("isvalidEmail", "Enter a valid Email", (arg) =>
      /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(arg)
    ),
  password: yup.string().trim().required("Password can not be empty"),
});

const editPasswordSchema = yup.object().shape({
  pass: yup
    .string()
    .trim()
    .required("Password can not be empty")
    .min(8, "Too short password")
    .max(16, "Too long password")
    .test("isPerfectPasswrod", "Enter a strong password", (arg) =>
      /((?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W])(?!.*\s).{8,16})/.test(arg)
    ),
  newPass: yup
    .string()
    .trim()
    .required("New Password can not be empty")
    .min(8, "Too short password")
    .max(16, "Too long password")
    .test("isPerfectPasswrod", "Enter a strong password", (arg) =>
      /((?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W])(?!.*\s).{8,16})/.test(arg)
    ),
});

module.exports.customerYupSchema = { login, signup };
