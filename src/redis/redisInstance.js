const redis = require("redis");

// Create Redis Client
const redisClient = redis.createClient(6379);

// Event Handling
redisClient.on("error", (err) => {
  console.log("Redis Client Error", err);
});

redisClient.on("connect", function () {
  console.log("Connected!");
});

redisClient.on("ready", () => {
  console.log("Redis is ready");
});

module.exports = redisClient;
