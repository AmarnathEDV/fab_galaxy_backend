const Occasion = require("../../database/occasion/occasionSchema");
const userAuth = require("../../middlewares/auth/userAuth");

const router = require("express").Router();

router.get("/", async (req, res) => {
  try {
    const occasion = await Occasion.findOne();

    res.send(occasion);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { data } = req.body;
    const occasion = await Occasion.findOne({});

    occasion.data[data.id - 1] = { ...data };

    await occasion.save();

    res.send(occasion);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
