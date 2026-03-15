const Wallet=require("../db/wallet");
const Transaction = require("../db/transections");

exports.getMyWallet=async(req,res)=>{
    try{
        const userId=req.user.id;
        const wallet=await Wallet.findOne({user:userId});
        if(!wallet){
            return res.status(404).json({msg:"Wallet not found"});
        }
        res.json({
            balance : wallet.balance,
            currency: wallet.currency,
            status : wallet.status
        })
    }
    catch(err){
        res.status(500).json({message:err.message});
    }
}
exports.getMyTransactions=async (req,res)=>{
    try{const userId=req.user.id;
    const wallet =await Wallet.findOne({user : userId});
    if(!wallet){
        throw new Error("Wallet not found");
    }
    const txs=await Transaction.find({
        $or :[
            {fromWallet : wallet._id},
            {toWallet : wallet._id}
        ]
    }).sort({createdAt :-1}).limit(50); // -1 means decending last one shows first
    res.json(txs.map(tx=>({
        transactionId:tx.transactionId,
        amount: tx.amount,
        status: tx.status,
        type: tx.fromWallet.toString()===wallet._id.toString() ? "debit" : "credit",
        createdAt : tx.createdAt
    })));
    }catch(err){
        console.log(err);
        return res.status(500).json({
            msg :"Something went wrong"
        })
    }
}