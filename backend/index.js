require('dotenv').config();
const connectDB = require("./db/db");
const app = require("./app");

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    if (!process.env.MONGO_URL) throw new Error('Mongo url required');
    await connectDB();
    app.listen(PORT, () => {
        console.log(`server running on port ${PORT} ✅`);
    });
}
startServer();
