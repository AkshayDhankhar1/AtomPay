
const mongoose = require("mongoose");
const User=require("../db/users");
const Wallet=require("../db/wallet");
const bcrypt=require("bcrypt");
const generateToken = require("../utils/jwt");
const QRCode=require("qrcode");
const { generateOTP, verifyOTP } = require("../utils/otp");
const sendOTPEmail = require("../utils/mailer");
exports.signup=  async(req,res)=>{
    try{
        //1. take data from body
        //2. validate if user exists upi pin exectly 6 letters
        //3. security password upi pin hash
        //4. db user create wallet auto create
        //5. response
        const bod=req.body;
        const username=bod.username;
        const name=bod.name;
        const email=bod.email;
        const password=bod.password;
        const pin=bod.pin;
        if(!/^\d{6}$/.test(pin)){
            return res.status(400).json({msg : "you entered wrong pin"});
        }
        const f=await User.findOne({email: email});
        const t=await User.findOne({username : username});
        if(f){
            return res.status(400).json({
                msg : "Email Already exists"
            })
        }
        if(t){
            return res.status(400).json({
                msg :"Username already exists"
            })
        }
        const hashedPass=await bcrypt.hash(password,10);
        const hashedPin=await bcrypt.hash(pin,10);
        const newUser=new User({
            name :name,
            email :email,
            password:hashedPass,
            username :username,
            hashedPin: hashedPin
        })
        const newWallet=new Wallet({
            user:newUser._id
        })
        const session=await mongoose.startSession(); // session for rollback condition 
        await session.startTransaction();
        try{
        await newUser.save({session});
        await newWallet.save({session});
        const qrData=`atompay://pay?to=${username}`;
        const qrBase64=await QRCode.toDataURL(qrData);
        await session.commitTransaction();
        await Wallet.findOneAndUpdate({user : newUser._id},{qrCode : qrBase64});
        }catch(err){
            console.log(err);
            await session.abortTransaction();
            if (err.code === 11000) {
            return res.status(400).json({ msg: "Email or username already exists" });
            }
            return res.status(400).json({ msg: "Problem making a user" });
        }
        finally{await session.endSession();}
        const token=generateToken(newUser._id);
        res.json({
            msg :"Signup Successful with signup bonus of ₹5000",
            token: token,
            user: {id: newUser._id,username : username}
        });

    }catch(err){
        console.log(err);
        return res.status(500).json({
            error :err.message
        })

    }
}
exports.login=async(req,res)=>{
    const body=req.body;
    const email=body.email;
    const userpassword=body.password;
    try{const user=await User.findOne({email : email}).select("+password");
    if(!user){
        return res.status(404).json({
            msg:"user does not exists"
        })
    }
    const isMatch=await bcrypt.compare(userpassword,user.password);
    if(!isMatch){
        return res.status(401).json({msg :"Wrong password"})
    }
    const token=generateToken(user._id);
    res.json({msg: "login successfull",token :token,user:{id :user._id,username :user.username,role :user.role}});
}catch(err){
    console.log(err);
    return res.status(500).json({
        msg:err.message
    })
}
}
exports.changePassword=async(req,res)=>{
    try{
        const userid=req.user.id;
        const oldPass=req.body.oldPassword;
        const user=await User.findOne({_id : userid}).select("+password");
        if(!user){
            return res.status(404).json({
                msg : "User not found"
            })
        }
        const isMatch=await bcrypt.compare(oldPass,user.password);
        if(!isMatch){
            return res.status(401).json({
                msg : "Wrong Password Entered"
            })
        }
        const newPass=req.body.newPassword;
        if(!newPass || newPass.length<8){
            return res.status(400).json({
                msg: "Password must be atlest 8 characters"
            })
        }
        const hashPass=await bcrypt.hash(newPass,10);
        user.password=hashPass;
        await user.save();
        return res.status(200).json({
            msg : "Password changed successfully"
        })
    }
    catch(err){
        console.log(err);
        return res.status(500).json({
            msg : err.message
        })
    }
}
exports.changePin=async(req,res)=>{
    try{
        const userid=req.user.id;
        const user=await User.findOne({_id:userid}).select("+hashedPin");
        if(!user){
            return res.status(404).json({
                msg : "User Not Found"
            })
        }
        const oldPin=req.body.oldPin;
        const isMatch=await bcrypt.compare(oldPin,user.hashedPin);
        if(!isMatch){
            return res.status(401).json({
                msg : "You entered Wrong Pin"
            })
        }
        const newPin=req.body.newPin;
        if(!newPin || newPin.length != 6 ){
            return res.status(400).json({
                msg:"Enter new pin of length 6"
            })
        }
        const hashPin=await bcrypt.hash(newPin,10);
        user.hashedPin=hashPin;
        await user.save();
        return res.status(200).json({
            msg : "Pin changed successfully"
        })
    }catch(err){
        console.log(err);
        return res.status(500).json({
            msg : err.message
        })
    }
}
exports.sendOTP = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email })
                               .select("+password");
        if (!user) {
            return res.status(404).json({
                msg: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );
        if (!isMatch) {
            return res.status(401).json({
                msg: "Wrong password"
            });
        }

        const otp = generateOTP(email);
        await sendOTPEmail(email, otp);

        return res.status(200).json({
            msg: "OTP sent to your email"
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({ msg: err.message });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const isValid = verifyOTP(email, otp);
        if (!isValid) {
            return res.status(400).json({
                msg: "Wrong or expired OTP"
            });
        }

        const user = await User.findOne({ email });
        const token = generateToken(user._id);

        return res.status(200).json({
            msg: "Login successful",
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role
            }
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({ msg: err.message });
    }
};