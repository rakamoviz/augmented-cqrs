module.exports = function init(disconnectHandler, {cmdChannel, evtChannel} = {}) {
  if (!cmdChannel && !evtChannel) {
    throw new Error("cmdChannel and evtChannel cannot be both undefined");
  }

  return new Promise((resolve, reject) => {
    try {
      const instance = {
        cmd: cmdChannel,
        evt: evtChannel
      };
      
      setTimeout(() => {
        if (instance.cmd) {
          if (instance.cmd.ping()) {
            instance.cmd.on("error", err => {
              setImmediate(() => {
                if (err.code === "NR_CLOSED" || err.code === "CONNECTION_BROKEN") {
                  disconnectHandler(err, instance, "cmd");
                }
              });
            });
          } else {
            reject(new Error("Cannot connect to cmd " + instance.cmd));
          }
        }

        if (instance.evt) {
          if (instance.evt.ping()) {
            instance.evt.on("error", err => {
              setImmediate(() => {
                if (err.code === "NR_CLOSED" || err.code === "CONNECTION_BROKEN") {
                  disconnectHandler(err, instance, "cmd");
                }
              });
            });
          } else {
            reject(new Error("Cannot connect to evt " + instance.evt));
          }
        }

        resolve(instance);
      }, 1000);
    } catch (err) {
      reject(err)
    }
  });
}