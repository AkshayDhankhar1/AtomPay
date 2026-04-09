const express=require("express");
const router=express.Router();
const authMiddleware=require("../middlewares/auth.middlewares");
const {validate}=require("../middlewares/validate");
const {transferMoney}=require("../controllers/transections.controller");
const {transferSchema}=require("../validators/transfer.Schema");
router.post("/transfer",authMiddleware,validate(transferSchema),transferMoney);
module.exports=router;