const ContactRequest = require("../../database/contactRequest/contactRequestSchema");
const userAuth = require("../../middlewares/auth/userAuth");

const router = require("express").Router();

router.post("/", async (req, res) => {
  try {
    const { name, email, mobile, subject, message } = req.body;
    await ContactRequest({
      name,
      email,
      mobile,
      subject,
      message,
    })
      .save()
      .then((load) => {
        res.status(200).json({ message: "success", load });
      });
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

router.get("/", userAuth, async (req, res) => {
  try {
    const { pending = true } = req.query;

    let load = await ContactRequest.find({ isPending: pending });

    load = load.map((item, index) => {
      item = { ...item._doc, id: index };
      return item;
    });



    if (load) {
      return res.status(200).json({
        message: "success",
        load,
        type: "contact-request",
        total: load.length,
      });
    }
    return res.status(200).json({
      message: "success",
      load: [],
      type: "contact-request",
      pageTitle: {},
      total: 0,
    });
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

router.get("/accept", userAuth, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      res.status(404).json({ message: "Not found" });
    }

    let load = await ContactRequest.findOne({ _id: id });

    load.isPending = false;

    await load.save();

    return res.status(200).json({
      message: "success",
    });
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

module.exports = router;
