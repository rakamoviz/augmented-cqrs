const eventstore = require('eventstore');

module.exports = function init(
  msgbus, eventStoreConf, skip, pageSize, 
  backoffTime, lastIndexTracker, eventEmittingCallback
) {
  const es = eventstore(eventStoreConf);
  es.on('connect', () => {
    //var skip = 0, limit = 4; // if you omit limit or you define it as -1 it will retrieve until the end
  
    const processStreamEvents = (err, streamEvents) => {
      console.log("EVENTSTOREMSGBUS, processStreamEvents ", streamEvents.length);

      if (streamEvents.length === 0) {
        setTimeout(() => {
          streamEvents.next(processStreamEvents);
        }, backoffTime);        
      } else {
        let amountProcessed = 0;
        streamEvents.forEach(streamEvent => {
          const evt = streamEvent.payload;
          msgbus.emitEvent(evt, (err, result) => {
            amountProcessed += 1;
            lastIndexTracker(skip + amountProcessed);
  
            if (eventEmittingCallback) {
              try {
                eventEmittingCallback(err, {evt, result});
              } catch (err) {
                console.error("unhandled error in eventEmittingCallback: ", err);
              }
            }
          });
        });
    
        if (amountProcessed === streamEvents.length) {
          streamEvents.next(processStreamEvents); // just call next to retrieve the next page...
        } else {
          console.log("EVENTSTOREMSGBUS, about to backoff after having processed ", amountProcessed);
  
          //console.log("finished")
          setTimeout(() => {
            streamEvents.next(processStreamEvents);
          }, backoffTime);
        }
      }
    }

    es.getEvents(skip, pageSize, processStreamEvents);
  
    //Streaming API is not supported by DynamoDB
    /*
    var stream = es.streamEvents(skip, limit);
    stream.on('data', function(e) {
      console.log(">>> ", e)
    });
    stream.on('end', function() {
      console.log('no more events');
    });
    */
  });
  
  es.on('disconnect', () => {
    console.log('connection to storage is gone');
  });
  
  es.init((err) => {});

  return {
    emitCommand: (command, callback) => {
      throw new Error("emitCommand is not implemented for eventstoreMsgbus");
    },
  
    onCommand: (commandHandler) => {
      throw new Error("onCommand is not implemented for eventstoreMsgbus");
    },
  
    emitEvent: (event, callback) => {
      throw new Error("emitEvent is not implemented for eventstoreMsgbus");
    },
  
    onEvent: (eventHandler) => {
      msgbus.onEvent(eventHandler);
    }
  };
}