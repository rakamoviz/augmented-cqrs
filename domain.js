const redis = require("redis");
const _ = require("lodash");
const commandstore = require("./commandStore");

function sendResponse({type: responseChannelType, id: responseChannelId, redisConfig}, response) {
  const responseChannel = responseChannelType === "inproc" ? 
    require("./inprocChannel")(responseChannelId) : 
    redis.createClient(redisConfig);

  responseChannel.on("error", err => {
    setImmediate(() => {
      console.error("Error in giving response ", err);
    });
  });

  responseChannel.on("connect", _.once(() => {
    setImmediate(() => {
      responseChannel.publish(
        `${responseChannelId}.responses`, 
        JSON.stringify(response),
        (err) => {
          if (err) {
            console.error(`Failed publishing response ${JSON.stringify(response)} to ${responseChannelId}.responses`);
          }
        }
      );
    });
  }));
}

/**
 * 
 * The interface for commandHandlingCallback:
 * err, {events, aggregateData, metaInfos, domain, cmd}
 * 
 * The interface for eventEmittingCallback:
 * err, {result, saga, cmd}
 */
//https://github.com/adrai/cqrs-sample/blob/master/domain/server.js
module.exports = function init(
  domainPath, config, msgbus, disconnectCallback, 
  {commandHandlingCallback, eventEmittingCallback} = {}
) {
  return new Promise((resolve, reject) => {
    config.eventStore = () => {
      const eventStore = require("eventstore")(config.eventStoreConf);
      
      eventStore.useEventPublisher((evt, callback) => {
        if (evt.meta && evt.meta.responseChannel) {
          sendResponse(evt.meta.responseChannel, {type: "domain.evt", evt});
        }

        msgbus.emitEvent(evt, (err, result) => {
          callback(err);

          if (eventEmittingCallback) {
            try {
              eventEmittingCallback(err, {evt, result});
            } catch (err) {
              console.error("unhandled error in eventEmittingCallback: ", err);
            }
          }
        });
      });

      return eventStore;
    }

    const domain = require('cqrs-domain')({
      domainPath,
      eventStore: config.eventStore,
      aggregateLock: config.aggregateLock,
      deduplication: config.deduplication,
      snapshotThreshold: config.snapshotThreshold,
      snapshotThresholdMs: config.snapshotThresholdMs,
      retryOnConcurrencyTimeout: config.retryOnConcurrencyTimeout
    });

    domain.idGenerator(() => {
      return require('uuid/v4')()
    });

    domain.aggregateIdGenerator(() => {
      return require('uuid/v4')()
    });
  
    domain.defineCommand(config.commandDefinition);
    domain.defineEvent(config.eventDefinition);

    const resourceNames = ["eventStore", "aggregateLock", "commandBumper"];
    resourceNames.forEach(resourceName => {
      domain[resourceName].on("disconnect", () => {
        setImmediate(() => disconnectCallback(domain, resourceName));
      });
    });
    const connectPromise = Promise.all(resourceNames.map(
      resourceName => new Promise((resolve, reject) => {
      domain[resourceName].on("connect", (err) => {
        setImmediate(() => {
          if (err) {
            return reject(err);
          }
  
          resolve();
        });
      });
    })));
    
    const commandStore = commandstore(config.commandStore);
    commandStore.connect(err => {
      if (err) {
        return reject(err);
      }

      domain.init(err => {
        if (err) {
          return commandStore.disconnect(() => {
            reject(err);
          });
        }

        // on receiving a message (__=command__) from msgbus pass it to 
        // the domain calling the handle function
        msgbus.onCommand(cmd  => {
          console.log('domain -- received command ', cmd, ' from msgbus');
          
          domain.handle(cmd, (domainError, events, aggregateData, metaInfos) => {
            commandStore.save(cmd, domainError, aggregateData, metaInfos, (err) => {
              if (cmd.meta && cmd.meta.responseChannel) {
                sendResponse(cmd.meta.responseChannel, {
                  type: "domain.cmd", cmd, domainError, events, aggregateData, metaInfos
                });
              }
    
              if (commandHandlingCallback) {
                try {
                  commandHandlingCallback(err, {cmd, domainError, events, aggregateData, metaInfos});
                } catch (err) {
                  console.error("unhandled error in commandHandlingCallback ", err);
                }
              }
            });
          });
        });
        
        console.log('Starting domain service');
        
        connectPromise.then(values => resolve(domain)).catch(err => reject(err));
      });
    });
  });
}