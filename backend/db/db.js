const mongoose=require("mongoose");
const connectDB=async()=>{try{
await mongoose.connect(process.env.MONGO_URL);
console.log("DB connected successfully")}
catch(err){
    console.log(err);
    process.exit(1);// if failed to connect to server so exit the process
}}
module.exports=connectDB;