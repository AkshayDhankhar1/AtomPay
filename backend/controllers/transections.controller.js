const mongoose = require("mongoose");
const User = require("../db/users");
const Wallet = require("../db/wallet");
const Transaction = require("../db/transections");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

exports.transferMoney = async (req, res) => {
    const senderId = req.user.id;
    const body = req.body;

    const receiverUsername = body.receiverUsername;
    const amount = body.amount;
    const pin = body.pin;

    if (amount < 1) {
        return res.status(400).json({
            msg: "please send a valid amount"
        });
    }
    //////////////////----------try 1----------------/////////////////////////
    let session;
    let tx;
    try {
        const sender = await User.findOne({ _id: senderId }).select("+hashedPin active");

        if (!sender) {
            return res.status(400).json({
                msg: "Invalid sender"
            });
        }


        if (sender.active !== true) {
            return res.status(400).json({
                msg: "You can not send money because you are not active"
            });
        }


        const senderWallet = await Wallet.findOne({ user: senderId });

        if (!senderWallet) {
            return res.status(400).json({
                msg: "Sender wallet does not exist"
            });
        }

        if (senderWallet.status !== "Active") {
            return res.status(400).json({
                msg: "Your wallet is either frozen or closed"
            });
        }


        const receiver = await User.findOne({ username: receiverUsername })
            .select("active");
            
        if (!receiver) {
            return res.status(400).json({
                msg: "Invalid receiver"
               });
        }
        if(senderId===receiver._id.toString()){
            return res.status(400).json({
                msg:"You are sending money to yourself"
            })
        }


        if (receiver.active !== true) {
            return res.status(400).json({
                msg: "You can not send money because receiver is inactive"
            });
        }

        const receiverWallet = await Wallet.findOne({ user: receiver._id });

        if (!receiverWallet) {
            return res.status(400).json({
                msg: "Receiver does not have a wallet ❌"
            });
        }

        if (receiverWallet.status !== "Active") {
            return res.status(400).json({
                msg: "Receiver's wallet is either closed or frozen"
            });
        }


        const isMatch=await bcrypt.compare(pin,sender.hashedPin);
        if(!isMatch){
            return res.status(400).json({
                msg :"You entered wrong pin ❌"
            })
        }
        if(senderWallet.balance<amount){
            return res.status(400).json({
                msg:"You don't have sufficient money ❌"
            })
        }
        // aggregation pipeline
        const since=new Date(Date.now()-24*60*60*1000);
        const result=await Transaction.aggregate([{
            $match :{
                fromWallet : senderWallet._id,
                status:"success",
                createdAt : {$gte :since}
            }
        },{
            $group :{
                _id: null,
                totalSent :{$sum :"$amount"}
            }
        }
    ])
    const totalSent=result[0]?.totalSent||0;
    if(totalSent + amount > 100000){
        return res.status(400).json({
            msg :"You Cann't send money more than 1lakh in 24 hours"
        })
    }
        // try{
        session = await mongoose.startSession(); 
        await session.startTransaction();
        const senderWalletTx=await Wallet.findOne({user : senderId}).session(session);
        if(!senderWalletTx){
            return res.status(404).json({msg:"sender wallet does not exists"})
        }
        const receiverWalletTx=await Wallet.findOne({user :receiver._id}).session(session);
        if(!receiverWalletTx){
            return res.status(404).json({msg: "Receiver wallet not found during transaction"})
        }
        if(senderWalletTx.balance<amount){
            return res.status(404).json({msg :"Insufficient balance"});
        }
        tx=new Transaction({
            transactionId:crypto.randomUUID(),
            fromWallet : senderWalletTx._id,
            toWallet : receiverWalletTx._id,
            amount:amount,
            status:"pending"
        })
        await tx.save({session});
        senderWalletTx.balance-=amount;
        receiverWalletTx.balance+=amount;
        await senderWalletTx.save({session});
        await receiverWalletTx.save({session});
        tx.status="success";
        await tx.save({session});
        await session.commitTransaction();

        return res.status(200).json({
            msg :"Money sent successfully ✅"
        })
    }
    catch (err) {
        console.log(err);
        if(session){
            await session.abortTransaction();
        }
        if(tx){
            tx.status="failed";
            tx.failureReason=err.message ||"Unknown error";
            await tx.save();
        }
        return res.status(500).json({
            msg: "something went wrong ❌"
        });
    }finally{
        if(session){
            await session.endSession();
        }
    }
};
