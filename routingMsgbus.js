module.exports = function init(msgbusMap) {
  return {
    emitCommand: (command, callback) => {
      msgbusMap[command.context].emitCommand(command, callback);
    },
  
    onCommand: (commandHandler) => {
      Object.entries(msgbusMap).forEach(([context, msgbus]) => {
        msgbus.onCommand(cmd => commandHandler(cmd, context, msgbus));        
      });
    },
  
    emitEvent: (event, callback) => {
      msgbusMap[event.context].emitEvent(event, callback);
    },
  
    onEvent: (eventHandler) => {
      Object.entries(msgbusMap).forEach(([context, msgbus]) => {
        msgbus.onEvent(evt => eventHandler(evt, context, msgbus));
      });
    }
  };
} 