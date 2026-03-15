const express=require("express");
const router=express.Router();
const{signup,login,changePassword,changePin} = require("../controllers/auth.controller");
const{authMiddleware}=require("../middlewares/auth.middlewares");
const{signupSchema,loginSchema,changePasswordSchema,changePinSchema}=require("../validators/auth.schema");
const{validate}=require("../middlewares/validate");
router.post("/signup",validate(signupSchema),signup);
router.post("/login",validate(loginSchema),login);
router.patch("/change-password",authMiddleware,validate(changePasswordSchema),changePassword);
router.patch("/change-pin",authMiddleware,validate(changePinSchema),changePin);

module.exports=router;