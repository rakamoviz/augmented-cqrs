const redis = require('redis');
const _ = require("lodash");

function withResponse(type, msgbus, msg, responseHandler, errorHandler, {type: responseChannelType = "inproc", redisConfig} = {}) {
  if (responseChannelType !== "inproc" && !redisConfig) {
    throw new Error("responseChannelType must be inproc when redisConfig is undefined");
  }

  const channelId = require("uuid/v4")();
  const responseChannel = responseChannelType === "inproc" ? 
    require("./inprocChannel")(channelId) : 
    redis.createClient(redisConfig);
  
  setTimeout(() => {
    if (responseChannel.ping() === false) {
      const err = new Error("Cannot connect to responseChannel " + responseChannel);
      return errorHandler(err);
    }
    
    responseChannel.on("error", (err) => {
      setImmediate(() => {
        if (err.code === "NR_CLOSED" || err.code === "CONNECTION_BROKEN") {
          errorHandler(err); 
        }
      });
    });

    const done = () => {
      responseChannel.quit();
    }

    responseChannel.on("message", (pubName, message) => {
      setImmediate(() => {
        if (pubName === `${channelId}.responses`) {
          const response = JSON.parse(message);
          console.log('responseChannel -- received response ' + response);
              
          try {
            responseHandler(response, done);
          } catch (err) {
            console.error("Error in responseHandler ", responseHandler, ":", err);
          }
        }
      });
    });

    responseChannel.subscribe(`${channelId}.responses`);

    const augmentedMsg = {
      ...msg, 
      meta: {
        ...msg.meta, 
        responseChannel: {type: responseChannelType, id: channelId, redisConfig}
      }
    };

    if (type === "cmd") {
      msgbus.emitCommand(augmentedMsg, err => {
        if (err) {
          errorHandler(err);
        }
      });
    } else if (type === "evt") {
      msgbus.emitEvent(augmentedMsg, err => {
        if (err) {
          errorHandler(err);
        }
      });
    }
  }, 1000);
}

function withoutResponse(type, msgbus, msg, errorHandler) {
  if (type === "cmd") {
    msgbus.emitCommand(msg, errorHandler);
  } else if (type === "evt") {
    msgbus.emitEvent(msg, errorHandler);
  }
}

module.exports = function init(responseChannelConfig) {
  return {
    dispatch: (type, msgbus, msg, {responseHandler, errorHandler} = {}) => {
      if (responseHandler) {
        withResponse(type, msgbus, msg, responseHandler, errorHandler, responseChannelConfig);
      } else {
        withoutResponse(type, msgbus, msg, errorHandler);
      }
    }
  }
}