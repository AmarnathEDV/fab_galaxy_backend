const FAQ = require("../../database/faq/faqSchema");

module.exports.createFAQ = async (req, res) => {
  try {
    const { title, description } = req.body;
    const { edit, faqID } = req.query;
    if (edit && faqID) {
      const newFAQ = await FAQ.findByIdAndUpdate(faqID, {
        $set: {
          title,
          description,
          position: newPosition,
        },
      });

      return res.send({ load: newFAQ });
    }
    if (!title || !description) {
      return res.status(400).send({ message: "Please fill all the fields" });
    }

    // Get the last FAQ entry to determine its position
    const lastFAQ = await FAQ.findOne().sort({ position: -1 });

    const newPosition = lastFAQ ? lastFAQ.position + 1 : 0;

    const newFAQ = new FAQ({
      title,
      description,
      position: newPosition,
    });

    await newFAQ.save();
    return res.send({ load: newFAQ });
  } catch (error) {
    
    res.status(400).send({ message: error });
  }
};

// Get all FAQs sorted by position in increasing order
module.exports.getFAQ = async (req, res) => {
  try {
    const FAQs = await FAQ.find().sort({ position: 1 });
    res.send({ load: FAQs });
  } catch (error) {
    
    res.status(400).send({ message: error });
  }
};

// Update the position of a FAQ entry
// Update the position of a FAQ entry
// Update the position of a FAQ entry
module.exports.updateFAQPosition = async (req, res) => {
  try {
    const { id, newPosition } = req.body;

    const FAQToUpdate = await FAQ.findById(id);
    if (!FAQToUpdate) {
      return res.status(404).send({ message: "FAQ not found" });
    }

    const currentPosition = FAQToUpdate.position;

    // Find FAQs affected by the position change
    const FAQsToUpdate = await FAQ.find({
      position: {
        $gte: Math.min(currentPosition, newPosition),
        $lte: Math.max(currentPosition, newPosition)
      },
      _id: { $ne: id } // Exclude the FAQ being updated
    });

    // Adjust positions of affected FAQs
    const adjustment = newPosition > currentPosition ? -1 : 1;
    FAQsToUpdate.forEach(async (faq) => {
      faq.position += adjustment;
      await faq.save();
    });

    // Update position of the FAQ being updated
    FAQToUpdate.position = newPosition;
    await FAQToUpdate.save();

    const FAQs = await FAQ.find().sort({ position: 1 });
    res.send({ load: FAQs });
  } catch (error) {
    
    res.status(400).send({ message: error });
  }
};


// Delete a FAQ entry
module.exports.deleteFAQ = async (req, res) => {
  try {
    const { faqId } = req.query ;

    const FAQToDelete = await FAQ.findById(faqId);
    if (!FAQToDelete) {
      return res.status(404).send({ message: "FAQ not found" });
    }

    // Get the position of the FAQ to be deleted
    const deletedPosition = FAQToDelete.position;

    // Delete the FAQ
    await FAQ.findByIdAndDelete(faqId)

    // Find FAQs with positions greater than the deleted position
    const FAQsToUpdate = await FAQ.find({ position: { $gt: deletedPosition } });

    // Adjust positions of affected FAQs
    FAQsToUpdate.forEach(async (faq) => {
      faq.position -= 1;
      await faq.save();
    });

    res.send({ message: "FAQ deleted successfully" });
  } catch (error) {
    
    res.status(400).send({ message: error });
  }
};

