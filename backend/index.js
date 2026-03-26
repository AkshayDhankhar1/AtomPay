require('dotenv').config();
const express=require("express");
const cors=require("cors");
const connectDB = require("./db/db");
const authRouter=require("./routes/auth.routes");
const transactionRouter=require("./routes/transection.routes");
const walletRouter=require("./routes/wallet.routes");
const app=express();
const PORT = process.env.PORT || 3000;
app.use(cors({ origin: "*" }));
app.use(express.json());
const startServer=async()=>{
    await connectDB();
    app.use("/api/auth",authRouter);
    app.use("/api/wallet",walletRouter);
    app.use("/api/transaction",transactionRouter);
    app.listen(PORT, () => {
    console.log(`server running on port ${PORT} ✅`);
});
}
startServer();
