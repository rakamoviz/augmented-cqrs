const redis = require('redis');

module.exports = function create(redisConfig) {
  return redis.createClient(redisConfig);
}