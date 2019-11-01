const events = require('events');

const instances = {};

module.exports = function get(id) {
  let instance = instances[id];
  if (instance) {
    setImmediate(() => instance.connect());
    return instance;
  }
  
  const eventEmitter = new events.EventEmitter();

  const connect = () => {
    eventEmitter.emit("connect");
  }

  const publish = (pubName, msgString, callback) => {
    eventEmitter.emit("message", pubName, msgString);
    callback(null);
  };

  const subscribe =  (pubName) => {
    console.debug(`Subscribe to inprocChannel ${id} for pubName ${pubName}`)
  };

  const ping = () => true;
  const quit = () => {
    console.debug(`Quit to inprocChannel ${id}`);
    delete instances[id];
  };
  const on = (eventName, callback) => {
    eventEmitter.addListener(eventName, callback);
  };
  
  instance = {
    publish, 
    subscribe,
    ping,
    quit,
    on,
    connect
  }

  instances[id] = instance;
  setImmediate(() => instance.connect());
  return instance; 
}