const User = require("../../database/user/userSchema");

module.exports.addAddress = async (req, res) => {
  try {
    let {
      fname,
      lname,
      addressOne,
      addressTwo,
      city,
      contact,
      country,
      province,
      postalCode,
      isDefault,
    } = req.body;
    const { id } = req.params;

    const user = await User.findOne({ _id: id });

    if (user) {
      // Check if the address already exists
      const existingAddress = user.address.find(
        (addr) =>
          addr.fname === fname &&
          addr.lname === lname &&
          addr.addressOne === addressOne &&
          addr.addressTwo === addressTwo &&
          addr.contact === contact &&
          addr.city === city &&
          addr.country === country &&
          addr.province === province &&
          addr.postalCode === postalCode
      );

      if (existingAddress) {
        return res
          .status(400)
          .json({ message: "Address already exists for this user" });
      }

      // If isDefault is true, update the existing default address to not default
      if (isDefault) {
        const defaultAddressIndex = user.address.findIndex(
          (addr) => addr.isDefault === true
        );
        if (defaultAddressIndex !== -1) {
          user.address[defaultAddressIndex].isDefault = false;
        }
      } else {
        // If there is no default address and isDefault is false, make it default
        const hasDefaultAddress = user.address.some(
          (addr) => addr.isDefault === true
        );
        if (!hasDefaultAddress) {
          isDefault = true;
        }
      }

      // Add the new address to the user's address array
      user.address.push({
        fname,
        lname,
        addressOne,
        addressTwo,
        city,
        country,
        contact,
        province,
        postalCode,
        isDefault,
      });

      // Save the updated user document
      await user.save();

      res.status(200).json({
        message: "Address added successfully",
        load: {
          fname: user.fname,
          lname: user.lname,
          email: user.email,
          mobile: user.mobile,
          address: user.address,
        },
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    
    res.status(500).json({ message: err.message });
  }
};

module.exports.editAddress = async (req, res) => {
  try {
    const {
      fname,
      lname,
      addressOne,
      addressTwo,
      city,
      contact,
      country,
      province,
      postalCode,
      isDefault,
    } = req.body;
    const { id, addressId } = req.params;

   

    const user = await User.findOne({ _id: id });

    if (user) {
      const addressIndex = user.address.findIndex(
        (addr) => addr._id == addressId
      );

      if (addressIndex !== -1) {
        // Update the address details
        user.address[addressIndex].fname =
          fname || user.address[addressIndex].fname;
        user.address[addressIndex].lname =
          lname || user.address[addressIndex].lname;
        user.address[addressIndex].addressOne =
          addressOne || user.address[addressIndex].addressOne;
        user.address[addressIndex].addressTwo =
          addressTwo || user.address[addressIndex].addressTwo;
        user.address[addressIndex].city =
          city || user.address[addressIndex].city;
        user.address[addressIndex].country =
          country || user.address[addressIndex].country;
        user.address[addressIndex].province =
          province || user.address[addressIndex].province;
        user.address[addressIndex].postalCode =
          postalCode || user.address[addressIndex].postalCode;
        user.address[addressIndex].contact =
          contact || user.address[addressIndex].contact;

        // If isDefault is true, update the existing default address to not default
        if (isDefault) {
          // Update the current address to be the default
          user.address[addressIndex].isDefault = true;

          // Update other addresses to not be the default
          user.address.forEach((addr, idx) => {
            if (idx !== addressIndex) {
              addr.isDefault = false;
            }
          });
        }

        if(!isDefault){
          const hasDefaultAddress = user.address.some((addr) => addr.isDefault === true);
          if (!hasDefaultAddress) {
            user.address[addressIndex].isDefault = true;
          }
        }

        // Save the updated user document
        await user.save();

        res.status(200).json({
          message: "Address updated successfully",
          load: {
            fname: user.fname,
            lname: user.lname,
            email: user.email,
            mobile: user.mobile,
            address: user.address,
          },
        });
      } else {
        res.status(404).json({ message: "Address not found" });
      }
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    
    res.status(500).json({ message: err.message });
  }
};

module.exports.deleteAddress = async (req, res) => {
  try {
    const { id, addressId } = req.params;

    const user = await User.findOne({ _id: id });

    if (user) {
      const addressIndex = user.address.findIndex(
        (addr) => addr._id == addressId
      );

      if (addressIndex !== -1) {
        // Check if the address to be deleted is the default address
        const isDefault = user.address[addressIndex].isDefault;

        // Remove the address from the array
        user.address.splice(addressIndex, 1);

        // If the deleted address was the default, set the first address (if present) as the new default
        if (isDefault && user.address.length > 0) {
          user.address[0].isDefault = true;
        }

        // Save the updated user document
        await user.save();

        res.status(200).json({
          message: "Address deleted successfully",
          load: {
            fname: user.fname,
            lname: user.lname,
            email: user.email,
            mobile: user.mobile,
            address: user.address,
          },
        });
      } else {
        res.status(404).json({ message: "Address not found" });
      }
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    
    res.status(500).json({ message: err.message });
  }
};
