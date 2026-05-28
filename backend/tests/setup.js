const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

let mongoServer;

module.exports.setupDB = () => {
    // Use MongoMemoryReplSet instead of MongoMemoryServer
    // because the transfer endpoint uses MongoDB transactions (startSession/startTransaction)
    // which require a replica set.
    beforeAll(async () => {
        // Set test env vars
        process.env.JWT_SECRET = "test-jwt-secret-key-for-unit-tests";
        process.env.OTP_SECRET = "TESTSECRETBASE32KEY";
        process.env.BREVO_API_KEY = "test-brevo-key";

        mongoServer = await MongoMemoryReplSet.create({
            replSet: { count: 1 }  // Single-node replica set (fast, supports transactions)
        });
        const uri = mongoServer.getUri();
        await mongoose.connect(uri);
    }, 120000); // 120 second timeout for binary download + replica set init

    afterEach(async () => {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }
    });

    afterAll(async () => {
        await mongoose.disconnect();
        if (mongoServer) {
            await mongoServer.stop();
        }
    });
};
