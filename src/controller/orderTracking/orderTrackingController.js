const { default: axios } = require("axios");
const User = require("../../database/user/userSchema.js");
const Order = require("../../database/orders/orderSchema.js");

module.exports.trackOrder = async (req, res) => {
  try {
    let { trackingId, orderId, email, typo } = req.body;

   

    if (typo) {
      if (!trackingId) {
        return res.status(400).json({ message: "Tracking ID is required" });
      }
    } else {
      if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
      }
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      email = email.toLowerCase();
    }

    let userValid = null;
    let orderValid = null;

    if (!typo) {
      const user = await User.findOne({ email: email });
      if (!user) {
        return res
          .status(404)
          .json({ message: "Invalid  Email or  User does not exist" });
      }

      if (!orderId.split("_")[1]) {
        return res.status(404).json({ message: "Invalid order Id" });
      }

      const order = await Order.findOne({ _id: orderId.split("_")[0] }).catch(
        (err) => {
          return res
            .status(404)
            .json({ message: "Order not found, Invalid OrderId" });
        }
      );

      if (!order) {
        return res
          .status(404)
          .json({ message: "Order not found, Invalid OrderId" });
      }

      orderValid = order;

      userValid = user;
    }

    let trackDetails;

  

    if (orderValid) {
      let position = parseInt(orderId.split("_")[1]);
      if (!orderValid.products[position - 1]) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (orderValid.products[position - 1].cancelReason) {
        return res.status(404).json({ message: "Order has been cancelled" });
      }
      if (!orderValid.products[position - 1].shippingDetails) {
        return res.status(404).json({ message: "Order is still pending" });
      }

      trackDetails =
        orderValid.products[position - 1].shippingDetails.reference_number;
    }

    let requestObject = typo
      ? {
          TrkType: "cnno",
          strcnno: trackingId,
          addtnlDtl: "Y",
        }
      : {
          TrkType: "cnno",
          strcnno: trackDetails,
          addtnlDtl: "Y",
        };

   

    await axios
      .post(
        "https://blktracksvc.dtdc.com/dtdc-api/rest/JSONCnTrk/getTrackDetails",
        requestObject,
        {
          headers: {
            "x-access-token":
              "GL7412_trk_json:3d1301a7441d49df415eed09f2cf252b",
            Cookie: "JSESSIONID:604E743E6EA3FD41C4DD16A451983E94",
          },
        }
      )
      .then((response) => {
        if (response.data.statusFlag) {
          return res.send(response.data);
        } else {
          return res
            .status(404)
            .json({ message: "Invalid  Tracking ID or  Service is down" });
        }
      })
      .catch((err) => {
 
        return res
          .status(404)
          .json({ message: "Invalid  Tracking ID or  Service is down" });
      });
  } catch (err) {

    res.status(500).json({ message: "Internal server error" });
  }
};
