const express=require("express");
const router=express.Router();
const authMiddleware=require("../middlewares/auth.middlewares");
const {getMyWallet,getMyTransactions}=require("../controllers/wallet.controller");
router.get("/balance",authMiddleware,getMyWallet);
router.get("/transactions",authMiddleware,getMyTransactions);
module.exports=router;