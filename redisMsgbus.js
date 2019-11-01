const redis = require('redis');

/**
 * disconnectHandler interface:
 * err, instance
 */
module.exports = function init(redisConfig, disconnectHandler, {createCmd = true, createEvt = true} = {}) {
  return new Promise((resolve, reject) => {
    try {
      const instance = {};
      
      if (createCmd) {
        instance.cmd = redis.createClient(redisConfig);
      }

      if (createEvt) {
        instance.evt = redis.createClient(redisConfig);
      }

      setTimeout(() => {
        if (instance.cmd && instance.cmd.ping() === false) {
          reject(new Error("Cannot connect to cmd " + JSON.stringify(redisConfig)));
        }
        if (instance.evt && instance.evt.ping() === false) {
          reject(new Error("Cannot connect to evt " + JSON.stringify(redisConfig)));
        }

        Object.values(instance).forEach(redisConn => redisConn.on("error", err => {
          setImmediate(() => {
            if (err.code === "NR_CLOSED" || err.code === "CONNECTION_BROKEN") {
              disconnectHandler(err, instance);
            }
          });
        }));

        resolve(instance);
      }, 1000);
    } catch (err) {
      reject(err)
    }
  });
}