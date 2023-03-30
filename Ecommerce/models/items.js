const mongoose = require("mongoose");

const itemsSchema = mongoose.Schema({
    itemID: Number,
    itemName: String,
    itemPrice: Number,
    itemDescription: String,
    itemImage: {
        data: Buffer,
        contentType: String
    },
    userID: String,
    name: String,
    phoneNumber: Number
});

module.exports = mongoose.model("items", itemsSchema);