const Policy = require("../../database/policy/policySchema");

module.exports.editPolicy = async (req, res) => {
  try {
    const { data, content } = req.body;

    if (!data || !content) {
      res.status(404).json({ message: "No data found" });
    }

    const policy = await Policy.findOne();

    if (content === "privacy") {
      policy.privacy.push({
        date: Date.now(),
        content: JSON.stringify(data),
      });
    }

    if (content === "shipping") {
      policy.shipping.push({
        date: Date.now(),
        content: JSON.stringify(data),
      });
    }
    if (content === "terms") {
      policy.terms.push({
        date: Date.now(),
        content: JSON.stringify(data),
      });
    }
    if (content === "cancellation") {
      policy.cancellation.push({
        date: Date.now(),
        content: JSON.stringify(data),
      });
    }

    await policy.save();

    res.status(200).json({ message: "Policy updated" });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getPolicy = async (req, res) => {
  try {
    const policy = await Policy.findOne();

    res.status(200).json({ load: policy });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};
