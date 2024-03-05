const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../../database/user/userSchema");

const nodemailer = require("nodemailer");
const redisClient = require("../../redis/redisInstance");
const { OTPhtmlData, welcomeEmail, editSuccessEmail } = require("../../Emails/email");

const transporter = nodemailer.createTransport({
  host: "s588.sgp8.mysecurecloudhost.com", // Use the hostname or webmail URL
  port: 465, // Use the appropriate port (e.g., 465 for secure)
  secure: true, // Set to true for secure connections
  auth: {
    user: "dev.amarnath@ekkdigitalvyapar.com", // Your email address
    pass: "Amarnath@123", // Your email password
  },
});

const createToken = (_id) => {
  return jwt.sign({ _id }, process.env.SECRET_KET_JWT);
};

module.exports.userLogin = async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email.toLowerCase();

    await User.findOne({ email, status: true })
      .then(async (user) => {
        const match = await bcrypt.compare(password, user.password);
        if (match) {
          
          const token = await createToken(user._id);
          const userData = {
            fname: user.fname,
            lname: user.lname,
            email: user.email,
            mobile: user.mobile,
            address: user.address,
          };

         
          res.status(200).json({ token, userData });
        } else {
          res.status(404).json({ error: "invalid email or password" });
        }
      })
      .catch((err) => {
        res.status(404).json({ error: "invalid email or password" });
      });
  } catch (err) {
    res.status(500).json({
      error: err,
      message: "Internal server error, Please try again later",
    });
  }
};

function generateOTP() {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

module.exports.createPublicUser = async (req, res) => {
  try {
    let { fname, lname, password, email } = req.body;
    email = email.toLowerCase();
    password = await bcrypt.hash(password, 10);
    const exist = await User.findOne({ email });
    if (exist) {
      return res
        .status(404)
        .json({ message: "User with this email already exist" });
    }

    const otp = generateOTP();

    const hashedOTP = await bcrypt.hash(otp, 10);

    const userData = {
      email,
      password,
      fname,
      lname,
      status: true,
    };

    const cacheKeyOTP = `verify_otp_key_${email}`;
    const cacheKeyData = `verify_otp_data_${email}`;

    await redisClient.setEx(cacheKeyOTP, 300, hashedOTP);

    await redisClient.setEx(cacheKeyData, 3600, JSON.stringify({ userData }));

    const mailOptions = {
      from: "dev.amarnath@ekkdigitalvyapar.com",
      to: email,
      subject: "OTP Verification",
      html: OTPhtmlData(
        otp,
        "Thank you for making Fab Galaxy your brand of choice.",
        "Please use the following OTP to complete your sign-up procedures. The OTP is valid for 5 minutes."
      ),
    };
    await transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
   
        return res.json({ message: "success" });
      }
    });
  } catch (err) {

    res.status(500).json({ message: err });
  }
};

module.exports.verifyOTP = async (req, res) => {
  try {
    let { otp, email } = req.body;

    email = email.toLowerCase();
    const cacheKeyOTP = `verify_otp_key_${email}`;
    const cacheKeyData = `verify_otp_data_${email}`;

    const otpKeyData = await redisClient.get(cacheKeyOTP);
    const otpUserData = await redisClient.get(cacheKeyData);
    if (!otpKeyData) {
      return res.status(404).json({ message: "OTP Expired please try again." });
    }

  

    const match = await bcrypt.compare(otp, otpKeyData);

    if (match) {
      const newUser = new User({
        ...JSON.parse(otpUserData).userData,
      });

      await newUser
        .save()
        .then(async (user) => {
     
          const mailOptions = {
            from: "dev.amarnath@ekkdigitalvyapar.com",
            to: user.email,
            subject: "Account created successfully",
            html: welcomeEmail(user.fname),
          };
          await transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error("Error sending email:", error);
            } else {
              console.log("Email sent:", info.response);
            }
          });
          await redisClient.del(cacheKeyOTP);
          await redisClient.del(cacheKeyData);
          return res.status(200).json({ message: "success" });
        })
        .catch((err) => {
          
          return res
            .status(404)
            .json({ message: "Something went wrong", error: err });
        });
    } else {
      return res.status(404).json({ message: "Invalid OTP" });
    }
  } catch (err) {
    
    res.status(500).json({ message: err });
  }
};

module.exports.resendOTP = async (req, res) => {
  try {
    let { email } = req.body;
    email = email.toLowerCase();


    const otp = generateOTP();
    console.log(otp);
    const hashedOTP = await bcrypt.hash(otp, 10);

    const cacheKeyOTP = `verify_otp_key_${email}`;

    await redisClient.del(cacheKeyOTP);

    await redisClient.setEx(cacheKeyOTP, 300, hashedOTP);

    const mailOptions = {
      from: "dev.amarnath@ekkdigitalvyapar.com",
      to: email,
      subject: "OTP Verification",
      html: OTPhtmlData(
        otp,
        "Thank you for making Fab Galaxy your brand of choice.",
        "Please use the following OTP to complete your sign-up procedures. The OTP is valid for 5 minutes."
      ),
    };
    await transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log("Email sent:", info.response);
        return res.send({ message: "success" });
      }
    });
  } catch (err) {
    
    res.status(500).json({ message: err });
  }
};

module.exports.editPublicUser = async (req, res) => {
  try {
    
    let { fname, lname, email } = req.body;
    email = email.toLowerCase();
    let { id } = req.params;

    const exist = await User.findOne({ _id: id });
    const duplicate = await User.find({ email: email });

    if (!exist) {
      return res.status(404).json({ message: "No user Found" });
    }

    if (exist.email === email) {
      return res
        .status(404)
        .json({ message: "Cannot be the same email as before" });
    }

    if (duplicate && duplicate.length > 1) {
      return res.status(404).json({ message: "Email cannot be used" });
    }

    const otp = generateOTP();

    const hashedOTP = await bcrypt.hash(otp, 10);

    const userData = {
      email,
      fname,
      lname,
      status: true,
    };

    const cacheKeyOTP = `verify_otp_edit_key_${id}_${email}`;
    const cacheKeyData = `verify_otp_edit_data_${id}_${email}`;

    await redisClient.setEx(cacheKeyOTP, 300, hashedOTP);

    await redisClient.setEx(cacheKeyData, 3600, JSON.stringify({ userData }));

    const mailOptions = {
      from: "dev.amarnath@ekkdigitalvyapar.com",
      to: email,
      subject: "OTP Verification",
      html: OTPhtmlData(
        otp,
        "We have received a request to change your email address.",
        "Please use the following OTP to complete your email change procedures. The OTP is valid for 5 minutes."
      ),
    };
    await transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log("Email sent:", info.response);
        return res.json({ message: "success" });
      }
    });
  } catch (err) {
    
    res.status(500).json({ message: err });
  }
};

module.exports.verifyEditOTP = async (req, res) => {
  try {
    let { otp, email } = req.body;
    const { id } = req.params;


    email = email.toLowerCase();
    const cacheKeyOTP = `verify_otp_edit_key_${id}_${email}`;
    const cacheKeyData = `verify_otp_edit_data_${id}_${email}`;

    const otpKeyData = await redisClient.get(cacheKeyOTP);
    const otpUserData = await redisClient.get(cacheKeyData);
    if (!otpKeyData) {
      return res.status(401).json({ message: "OTP Expired please try again." });
    }

   

    const match = await bcrypt.compare(otp, otpKeyData);

    if (match) {
      const data = JSON.parse(otpUserData).userData;
      const newUser = await User.findByIdAndUpdate(id, {
        $set: data,
      })
        .then(async (user) => {
   
          const mailOptions = {
            from: "dev.amarnath@ekkdigitalvyapar.com",
            to: user.email,
            subject: "Profile Edited successfully",
            html: editSuccessEmail(
              "Profile Update Successful",
              "Your profile has been updated successfully. If you did not initiate this change, please reach out to the administrator at support@fabgalaxy.com for assistance."
            ),
          };
          await transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error("Error sending email:", error);
            } else {
              console.log("Email sent:", info.response);
            }
          });

          const userData = await User.findOne({ _id: id });
          await redisClient.del(cacheKeyOTP);
          await redisClient.del(cacheKeyData);
          return res.status(200).json({ message: "success", user: userData });
        })
        .catch((err) => {
          
          return res
            .status(404)
            .json({ message: "Something went wrong", error: err });
        });
    } else {
      return res.status(404).json({ message: "Invalid OTP" });
    }
  } catch (err) {
    
    res.status(500).json({ message: err });
  }
};

module.exports.changePassword = async (req, res) => {
  try {
    let { password, newPassword, cPassword } = req.body;



    const { id } = req.params;

    await User.findOne({ _id: id, status: true })
      .then(async (user) => {
        const match = await bcrypt.compare(password, user.password);

        if (match) {
          // Checking for new password and confirm password field empty or not
          if (!newPassword || !cPassword) {
            return res.status(404).json({ message: "Password not entered" });
          }

          // Checking if the new password is same as old one
          if (newPassword === password) {
            return res
              .status(404)
              .json({ message: "New password cannot be same as old password" });
          }

          //Checking if both password are equal
          if (newPassword !== cPassword) {
            return res.status(404).json({ message: "Password should match" });
          }

          password = await bcrypt.hash(newPassword, 10);

          user.password = password;
          await user.save();

          const mailOptions = {
            from: "dev.amarnath@ekkdigitalvyapar.com",
            to: user.email,
            subject: "Password has been changed",
            html: editSuccessEmail(
              "Password Update Successful",
              "Your password has been updated successfully. If you did not initiate this change, please reach out to the administrator at support@fabgalaxy.com for assistance."
            ),
          };
          await transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error("Error sending email:", error);
            } else {
              console.log("Email sent:", info.response);
            }
          });


          return res.status(200).json({ user });
        } else {
          return res.status(404).json({ message: "invalid password" });
        }
      })
      .catch((err) => {
        return res.status(404).json({ message: "invalid password" });
      });
  } catch (err) {
    return res.status(500).json({
      error: err,
      message: "Internal server error, Please try again later",
    });
  }
};
