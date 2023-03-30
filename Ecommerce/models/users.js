const mongoose = require("mongoose");

const usersSchema = mongoose.Schema({
    userID: Number,
    username: String,
    password: String,   
    role: {
        type: String,
        default: "User"
    },
    name: String,
    phoneNumber: Number
});

module.exports = mongoose.model("users", usersSchema);