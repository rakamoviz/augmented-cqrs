const redis = require("redis");
const _ = require("lodash");

function sendResponse({type: responseChannelType, id: responseChannelId, redisConfig}, response) {
  const responseChannel = responseChannelType !== "inproc" ? 
    redis.createClient(redisConfig) :
    require("./inprocChannel")(responseChannelId);

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

//https://github.com/adrai/cqrs-sample/blob/master/domain/server.js
/**
 * 
 * The interface for eventHandlingCallback:
 * errs, {cmds, sagaModels, pm, evt}
 * 
 * The interface for commandEmittingCallback:
 * err, {result, pm, cmd}
 * 
 */
module.exports = function init(
  sagaPath, config, msgbus, disconnectCallback, 
  {eventHandlingCallback, commandEmittingCallback, eventMissingHandler} = {} 
) {
  return new Promise((resolve, reject) => {
    const pm = require('cqrs-saga')({
      sagaPath,
      sagaStore: config.sagaStore,
      revisionGuard: config.revisionGuard,
      retryOnConcurrencyTimeout: config.retryOnConcurrencyTimeout
    });

    pm.idGenerator(() => {
      return require('uuid/v4')()
    });

    pm.defineCommand(config.commandDefinition);
    pm.defineEvent(config.eventDefinition);

    const resourceNames = ['sagaStore'];
    if (config.revisionGuard) {
      resourceNames.push('revisionGuardStore')
    } 
    resourceNames.forEach(resourceName => {
      pm[resourceName].on("disconnect", () => {
        setImmediate(() => {
          disconnectCallback(pm, resourceName);
        });
      });
    });
    const connectPromise = Promise.all(resourceNames.map(
      resourceName => new Promise((resolve, reject) => {
      pm[resourceName].on("connect", err => {
        setImmediate(() => {
          if (err) {
            return reject(err);
          }
  
          resolve();
        });
      });
    })));

    pm.init((err, warnings) => {
      if (err) {
        return reject(err);
      }

      msgbus.onEvent((evt, context, contextMsgbus) => {
        console.log('pm -- received event ', evt,  
          ' for context ', context
        );
        
        //callback: function (err, events, aggregateData, metaInfos)
        pm.handle(evt, (errs, cmds, sagaModels) => {
          if (evt.meta && evt.meta.responseChannel) {
            sendResponse(evt.meta.responseChannel, {type: "saga.evt", evt, errs, cmds, sagaModels});
          }

          console.log("Handled event ", evt, " : ", errs, cmds, sagaModels);
          if (eventHandlingCallback) {
            try {
              eventHandlingCallback(errs, {cmds, sagaModels, pm, evt});
            } catch (err) {
              console.error("unhandled error in eventHandlingCallback: ", err);
            }
          }
        });
      }); 

      pm.onCommand((cmd, callback) => {
        if (cmd.meta && cmd.meta.responseChannel) {
          sendResponse(cmd.meta.responseChannel, {type: "saga.cmd", cmd, err});
        }

        msgbus.emitCommand(cmd, (err, result) => {
          callback(err);
          
          if (commandEmittingCallback) {
            try {
              commandEmittingCallback(err, {result, pm, cmd});
            } catch (err) {
              console.error("unhandled error in commandEmittingCallback: ", err);
            }
          }
        });
      });

      if (eventMissingHandler) {
        pm.onEventMissing((info, evt) =>{
          if (evt.meta && evt.meta.responseChannel) {
            sendResponse(evt.meta.responseChannel, {type: "saga.evt-missing", info, evt});
          }

          try {
            eventMissingHandler(info, evt);
          } catch (err) {
            console.error("unhandled error in eventMissingHandler: ", err);
          }
        });
      }

      console.log('Starting pm service');
      
      connectPromise.then(values => resolve(pm)).catch(err => reject(err));

      // this callback is called when all is ready...
      // warnings: if no warnings warnings is null, else it's an array containing errors during require of files
    });
  });
}