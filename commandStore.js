const _ = require('lodash'),
  debug = require('debug')('command:dynamodb'),
  aws = require('aws-sdk'), 
  async = require('async'),
  uuid = require('uuid').v4,
  ConcurrencyError = require("./concurrencyError");

//https://medium.com/quick-code/node-js-restful-api-with-dynamodb-local-7e342a934a24
function CommandStore(options) {
  var awsConf = {
    endpointConf: {}
  };

  if (process.env['AWS_DYNAMODB_ENDPOINT']) {
    awsConf.endpointConf = { endpoint: process.env['AWS_DYNAMODB_ENDPOINT'] };
  }

  _.defaults(options, awsConf);

  let client = undefined;
  let documentClient = undefined;
  let isConnected = false;

  return {
    connect: (callback) => {
      client = new aws.DynamoDB(options.endpointConf);
      documentClient = new aws.DynamoDB.DocumentClient({ service: client });
      isConnected = true;
  
      const createCommandTable = (done) => {
        createTableIfNotExists(
          client,
          CommandTableDefinition(options),
          done
        );
      };
  
      createCommandTable((err) => {
        if (err) {
          if (callback) callback(err);
        } else {
          //self.emit('connect');
          if (callback) callback(null, this);
        }
      });
    },
  
    disconnect: (callback) => {
      //self.emit('disconnect');
      if (callback) callback(null);
    },
  
    save: (cmd, domainError, aggregateData, metaInfos, callback) => {  
      if (!cmd || !_.isObject(cmd) || !_.isString(cmd.id)) {
        var errValidation = new Error('Please pass a valid command!');
        debug(errValidation);
        if (callback) callback(errValidation);
        return;
      }

      const item = {
        id: cmd.id,
        cmd, domainError, aggregateData, metaInfos
      }
  
      if (cmd._commitStamp) {
        item._commitStamp = cmd._commitStamp.getTime();
        item._commitStampYearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
      }
        
      var params = {
        TableName: options.commandTableName,
        Item: item,
        ConditionExpression: "#id <> :id",
        ExpressionAttributeNames: { 
          "#id" : "id" 
        },
        ExpressionAttributeValues: {
          ":id": cmd.id
        }
      };

      documentClient.put(params, (err, data) => {
        if (err) debug(err);

        if (err && err.code && err.code >= "ConditionalCheckFailedException") {
          if (callback) callback(new ConcurrencyError());
          return;
        }
        if (callback) callback(err);
      });
    }
  }
}

function CommandTableDefinition(opts) {
  const def = {
    TableName: opts.commandTableName,
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: '_commitStampYearMonth', AttributeType: 'S' },
      { AttributeName: '_commitStamp', AttributeType: 'N' }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: opts.primaryReadCapacityUnits || 5,
      WriteCapacityUnits: opts.primaryWriteCapacityUnits || 5
    }
  };

  const globalSecondaryIndexes = [ // optional (list of GlobalSecondaryIndex)
    { 
      IndexName: '_commitStamp_index', 
      KeySchema: [
        { AttributeName: '_commitStampYearMonth', KeyType: 'HASH' },
        { 
          AttributeName: '_commitStamp',
          KeyType: 'RANGE',
        }
      ],
      Projection: {
        ProjectionType: 'ALL' // (ALL | KEYS_ONLY | INCLUDE)
      },
      ProvisionedThroughput: { // throughput to provision to the index
        ReadCapacityUnits: opts.commitStampReadCapacityUnits || 5,
        WriteCapacityUnits: opts.commitStampWriteCapacityUnits || 5
      },
    }
  ]
  
  def.GlobalSecondaryIndexes = globalSecondaryIndexes;

  return def;
}

const createTableIfNotExists = (client, params, callback) => {
  const exists = (p, cbExists) => {
    client.describeTable({ TableName: p.TableName }, (err, data) => {
      if (err) {
        if (err.code === 'ResourceNotFoundException') {
          cbExists(null, { exists: false, definition: p });
        } else {
          cbExists(err);
        }
      } else {
        cbExists(null, { exists: true, description: data });
      }
    });
  };

  const create = (r, cbCreate) => {
    if (!r.exists) {
      client.createTable(r.definition, (err, data) => {
        if (err) {
          cbCreate(err);
        } else {
          cbCreate(null, {
            Table: {
              TableName: data.TableDescription.TableName,
              TableStatus: data.TableDescription.TableStatus
            }
          });
        }
      });
    } else {
      cbCreate(null, r.description);
    }
  };

  const active = (d, cbActive) => {
    let status = d.Table.TableStatus;
    async.until(
      () => {
        return status === 'ACTIVE';
      },
      (cbUntil) => {
        client.describeTable({ TableName: d.Table.TableName }, (
          err,
          data
        ) => {
          if (err) {
            cbUntil(err);
          } else {
            status = data.Table.TableStatus;
            setTimeout(cbUntil, 1000);
          }
        });
      },
      (err, r) => {
        if (err) {
          return cbActive(err);
        }
        cbActive(null, r);
      }
    );
  };

  async.compose(active, create, exists)(params, (err, result) => {
    if (err) callback(err);
    else callback(null, result);
  });
};

module.exports = CommandStore;