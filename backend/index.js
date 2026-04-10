require('dotenv').config();
const express=require("express");
const cors=require("cors");
const connectDB = require("./db/db");
const authRouter=require("./routes/auth.routes");
const transactionRouter=require("./routes/transection.routes");
const walletRouter=require("./routes/wallet.routes");
const app=express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
app.use(cors({ origin: "*" }));
app.use(express.json());
const startServer=async()=>{
    if(!process.env.MONGO_URL) throw new Error('Mongo url required');
    await connectDB();
    app.get("/api",async function(req,res){
        res.status(200).json({
            msg:"working properly"
        })
    })
    app.use("/api/auth",authRouter);
    app.use("/api/wallet",walletRouter);
    app.use("/api/transaction",transactionRouter);
    app.listen(PORT, () => {
    console.log(`server running on port ${PORT} ✅`);
});
}
startServer();
