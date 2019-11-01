const commandLineArgs = require('command-line-args');
const {resolve} = require("path");
const merge = require('deepmerge');

const optionDefinitions = [
  { name: 'type', alias: 't', type: String },
  { name: 'name', alias: 'n', type: String },
  { name: 'redisInline', alias: 'r', type: String },
  { name: 'redisFile', alias: 'R', type: String },
  { name: 'dataInline', alias: 'd', type: String },
  { name: 'dataFile', alias: 'D', type: String }
];
const options = commandLineArgs(optionDefinitions);

const redisConfigFile = options.redisFile ? require(resolve(options.redisFile)) : {};
const redisConfigInline = options.redisInline ? JSON.parse(options.redisInline) : {}
const redisConfig = merge(redisConfigFile, redisConfigInline);

const msgFile = options.dataFile ? require(resolve(options.dataFile)) : {};
const msgInline = options.dataInline ? JSON.parse(options.dataInline) : {};
const msg = merge(msgFile, msgInline);

const redisMsgbusCorePromise = require("./redisMsgbus")(
  redisConfig, (err) => {
    console.log("DISCONNECTED ", err);
    process.exit(1);
  }
)
redisMsgbusCorePromise.then(redisMsgbusCore => {
  const msgbus = require("./msgbus")(options.name, redisMsgbusCore)
  const messageDispatcher = require("./messageDispatcher")({type: "redis", redisConfig});

  const responseHandler = (err, msg, done) => {
    console.log("responseHandler, err: ", err, " , msg: ", msg, " , done: ", done);
  }
  const errorHandler = (err) => {
    console.error("errorHandler, err: ", err);
  }

  messageDispatcher.dispatch(options.type, msgbus, msg, {responseHandler, errorHandler});
});