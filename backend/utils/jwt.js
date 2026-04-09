const jwt = require("jsonwebtoken");

const generateToken = (userid) => {
    return jwt.sign({userId: userid}, process.env.JWT_SECRET, {expiresIn: "4d"});
}

module.exports = generateToken;