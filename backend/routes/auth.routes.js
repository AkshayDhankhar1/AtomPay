const express=require("express");
const router=express.Router();
const {
    signup, login,
    changePassword, changePin,
    sendOTP, verifyOTP          // ← add karo
} = require("../controllers/auth.controller");

const {
    signupSchema, loginSchema,
    changePasswordSchema, changePinSchema,
    sendOTPSchema, verifyOTPSchema  // ← add karo
} = require("../validators/auth.schema");
const authMiddleware=require("../middlewares/auth.middlewares");
const{validate}=require("../middlewares/validate");
router.post("/signup",validate(signupSchema),signup);
router.post("/login",validate(loginSchema),login);
router.patch("/change-password",authMiddleware,validate(changePasswordSchema),changePassword);
router.patch("/change-pin",authMiddleware,validate(changePinSchema),changePin);
router.post("/send-otp", validate(sendOTPSchema), sendOTP);
router.post("/verify-otp", validate(verifyOTPSchema), verifyOTP);

module.exports=router;