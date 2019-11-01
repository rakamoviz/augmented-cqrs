let _dependencies = undefined;
let _errorCatcher = undefined;

function setDependencies(dependencies) {
  _dependencies = dependencies;
}

function setErrorCatcher(errorCatcher) {
  _errorCatcher = errorCatcher;
}

function context(name) {
  return require('cqrs-domain').defineContext({
    // optional, default is the directory name
    name: name
  });
}

function aggregate(version, name) {
  return require('cqrs-domain').defineAggregate({
    // optional, default is last part of path name
    name: name,
  
    version: version,
    
    // optional, default ''
    defaultCommandPayload: 'payload',
    
    // optional, default ''
    defaultEventPayload: 'payload',
  
    // optional, default ''
    defaultPreConditionPayload: 'payload'
  });
}

function command(version, name, commandHandler) {
  return require('cqrs-domain').defineCommand({
    name: name,
    version: version
  }, (data, aggregate) => {
    try {
      return commandHandler(data, aggregate, _dependencies);
    } catch (err) {
      console.error("Unhandled error in commandHandler ", err, JSON.stringify({data, aggregate}));
      if (_errorCatcher) {
        _errorCatcher(err);
      } else {
        throw err;
      }
    }
  });
}

function preloadCondition(version, name, preloadConditionChecker) {
  return require('cqrs-domain').definePreLoadCondition({
    name: name,
    version: version
  }, (data, callback) => {
    try {
      return preloadConditionChecker(data, callback, _dependencies);
    } catch (err) {
      console.error("Unhandled error in preloadConditionChecker ", err, JSON.stringify({data}));
      if (_errorCatcher) {
        _errorCatcher(err);
      } else {
        throw err;
      }
    }
  });
}

function precondition(version, name, preconditionChecker) {
  return require('cqrs-domain').definePreCondition({
    name: name,
    version: version
  }, (data, aggregate, callback) => {
    try {
      return preconditionChecker(data, aggregate, callback, _dependencies);
    } catch (err) {
      console.error("Unhandled error in preconditionChecker ", err, JSON.stringify({data, aggregate}));
      if (_errorCatcher) {
        _errorCatcher(err);
      } else {
        throw err;
      }
    }
  });
}

function event(version, name, eventHandler) {
  return require('cqrs-domain').defineEvent({
    name: name,
    version: version
  }, (data, aggregate) => {
    try {
      return eventHandler(data, aggregate, _dependencies);
    } catch (err) {
      console.error("Unhandled error in eventHandler ", err, JSON.stringify({data, aggregate}));
      if (_errorCatcher) {
        _errorCatcher(err);
      } else {
        throw err;
      }
    }
  });
}

function businessRule(version, name, businessRuleChecker) {
  return require('cqrs-domain').defineBusinessRule({
    name: name,
    version: version
  }, (changed, previous, events, command, callback) => {
    try {
      return businessRuleChecker(changed, previous, events, command, callback, _dependencies);
    } catch (err) {
      console.error("Unhandled error in businessRuleChecker ", err, JSON.stringify({
        changed, previous, events, command
      }));
      if (_errorCatcher) {
        _errorCatcher(err);
      } else {
        throw err;
      }
    }
  });
}

function saga(version, {id, aggregate, context, existing, 
  containingProperties, priority}, sagaHandler) {
  return require('cqrs-saga').defineSaga({
    version,
    aggregate,
    context,
    existing, 
    containingProperties,
    id,
    priority: priority || Infinity,
    payload: ''
  }, (evt, saga, callback) => {
    try {
      return sagaHandler(evt, saga, callback, _dependencies);
    } catch (err) {
      console.error("Unhandled error in sagaHandler ", err, JSON.stringify({evt, saga}));
      if (_errorCatcher) {
        _errorCatcher(err);
      } else {
        throw err;
      }
    }
  });
}

module.exports = {
  setDependencies,
  setErrorCatcher,
  context,
  aggregate,
  command,
  preloadCondition,
  precondition,
  event,
  businessRule,
  saga
}