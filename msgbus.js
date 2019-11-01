module.exports = function init(id, msgbusCore) {
  var eventHandlers = [];
  var commandHandlers = [];
  
  // listen to events from redis and call each callback from subscribers
  if (msgbusCore.evt) {
    msgbusCore.evt.on("message", (pubName, message) => {
      setImmediate(() => {
        var event = JSON.parse(message);
  
        if (pubName === id + '.events') {
          console.log('hub -- received event ', event.name, ' from pubName ', pubName);
          console.log(event);
          
          eventHandlers.forEach(eventHandler => {
            eventHandler(event);
          });
        }
      });
    });    
  }

  if (msgbusCore.cmd) {
    // listen to commands from redis and call each callback from subscribers
    msgbusCore.cmd.on("message", (pubName, message) => {
      setImmediate(() => {
        var command = JSON.parse(message);

        if (pubName === id + '.commands') {
          console.log('hub -- received command ', command.name, ' from pubName ', pubName);
          console.log(command);
          
          commandHandlers.forEach(commandHandler => {
            commandHandler(command);
          });
        }
      });
    });
  }

  return {
    emitCommand: (command, callback) => {
      console.log('hub -- publishing command ', command, ' to channel');
      msgbusCore.cmd.publish(id + '.commands', JSON.stringify(command), callback);
    },
  
    onCommand: (commandHandler) => {
      if (commandHandlers.length === 0) {
        // subscribe to __commands channel__
        msgbusCore.cmd.subscribe(id + '.commands');
      }
      commandHandlers.push(commandHandler);
      console.log('hub -- command handlers: ' + commandHandlers.length);
    },
  
    emitEvent: (event, callback) => {
      console.log('hub -- publishing event ', event, ' to channel');
      console.log(event);
      msgbusCore.evt.publish(id + '.events', JSON.stringify(event), callback);
    },
  
    onEvent: (eventHandler) => {
      if (eventHandlers.length === 0) {
        // subscribe to __events channel__
        msgbusCore.evt.subscribe(id + '.events');
      }
      eventHandlers.push(eventHandler);
      console.log('hub -- event handlers: ' + eventHandlers.length);
    }
  };
} 