const jwt=require("jsonwebtoken");
exports.generateToken=(userid)=>{
    return jwt.sign({userid},process.env.JWT_SECRET,{expiresIn: "4d"});
}