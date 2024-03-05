const redis = require("redis");

// Create Redis Client
const redisClient = redis.createClient({url : "rediss://red-cnjfkf6n7f5s73f8lsl0:TjOXoeQ1iMiRDnKyynPDS7tipvAIsqZW@singapore-redis.render.com:6379"});

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
