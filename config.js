module.exports = function create(appName, contextName) {
  return {
    snapshotThreshold: 1,
    //snapshotThresholdMs: 30000,
    retryOnConcurrencyTimeout: 1000,
    eventStoreConf: {
      type: 'mongodb',
      host: 'localhost',
      port: 27017,
      dbName: `${appName}-${contextName}-cqrs`,
      eventsCollectionName: 'events',
      snapshotsCollectionName: 'snapshots',
      transactionsCollectionName: 'transactions',
      timeout: 10000
      // authSource: 'authedicationDatabase',
      // username: 'technicalDbUser',
      // password: 'secret'
      // url: 'mongodb://user:pass@host:port/db?opts
    },
    /*
    sagaStore: {
      type: 'redis',
      host: 'localhost',                          // optional
      port: 6379,                                 // optional
      db: 0,                                      // optional
      prefix: `${appName}-saga`,                      // optional
      timeout: 10000                              // optional
      // password: 'secret'                          // optional
    },
    */
    sagaStore: {
      type: 'dynamodb',
      sagaTableName: `${appName}-${contextName}-sagas`,
      primaryReadCapacityUnits: 10,
      primaryWriteCapacityUnits: 10,
      commitStampReadCapacityUnits: 10,
      commitStampWriteCapacityUnits: 10,
      timeoutAtReadCapacityUnits: 10,
      timeoutAtWriteCapacityUnits: 10,
    },
    aggregateLock: {
      type: 'redis',
      host: 'localhost', 
      port: 6379,
      db: 0,
      timeout: 10000,
      prefix: `${appName}-${contextName}-aggregatelock`
    },
    deduplication: {
      type: 'redis',
      host: 'localhost', 
      port: 6379,
      db: 0,
      timeout: 10000,
      ttl: 1000 * 60 * 60 * 1,
      prefix: `${appName}-${contextName}-deduplication`
    },
    revisionGuard: {
      type: 'redis',
      host: 'localhost',
      port: 6379,
      db: 0,
      timeout: 10000,
      queueTimeout: 1000,
      queueTimeoutMaxLoops: 3,
      startRevisionNumber: 1,
      prefix: `${appName}-${contextName}-saga-revisionGuard`
      // password: 'secret'
    },
    //revisionGuard: false,
    commandDefinition: {
      correlationId: 'correlationId',
      causationId: 'causationId',
      id: 'id',
      name: 'name',
      aggregateId: 'aggregate.id',
      aggregate: 'aggregate.name',
      revision: 'aggregate.revision',
      payload: 'payload',
      version: 'version',
      meta: 'meta',
      context: 'context'
    },
    eventDefinition : {
      correlationId: 'correlationId',
      causationId: 'causationId',
      id: 'id',
      name: 'name',
      aggregateId: 'aggregate.id',
      aggregate: 'aggregate.name',
      revision: 'aggregate.revision',
      payload: 'payload',
      version: 'version',
      meta: 'meta',
      context: 'context',
    },
    commandStore: {
      type: 'dynamodb', //only dynamodb for the moment
      commandTableName: `${appName}-${contextName}-commands`,
      primaryReadCapacityUnits: 10,
      primaryWriteCapacityUnits: 10,
      commitStampReadCapacityUnits: 10,
      commitStampWriteCapacityUnits: 10,
      timeoutAtReadCapacityUnits: 10,
      timeoutAtWriteCapacityUnits: 10,
    }
  }
}