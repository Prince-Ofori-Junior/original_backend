// src/config/redis.js
const { Redis } = require('@upstash/redis');

const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Upstash REST client does NOT support event listeners
// You can do simple test logging if needed
(async () => {
  try {
    const pong = await redisClient.ping();
    console.log('✅ Upstash Redis ping:', pong); // should log 'PONG'
  } catch (err) {
    console.error('❌ Upstash Redis ping failed:', err);
  }
})();

module.exports = redisClient;
