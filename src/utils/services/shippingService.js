const { default: axios } = require("axios");

const trackShipment = async (trackingId) => {
  return await axios
    .post(
      "https://blktracksvc.dtdc.com/dtdc-api/rest/JSONCnTrk/getTrackDetails",
      {
        TrkType: "cnno",
        strcnno: trackingId,
        addtnlDtl: "Y",
      },
      {
        headers: {
          "x-access-token": "GL7412_trk_json:3d1301a7441d49df415eed09f2cf252b",
          Cookie: "JSESSIONID:604E743E6EA3FD41C4DD16A451983E94",
        },
      }
    )
    .then((response) => {
      if (response.data.statusFlag) {
        return response.data;
      } else {
        return null;
      }
    })
    .catch((err) => {
  
      return null;
    });
};

module.exports.shippingService = { trackShipment };
