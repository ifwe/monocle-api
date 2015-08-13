var Promise = require('bluebird');
var _ = require('lodash');
var pathToRegexp = require('path-to-regexp');
var EventEmitter = require('events').EventEmitter;

module.exports = ApiRouter;

var supportedMethods = ['get', 'post', 'put', 'delete', 'patch', 'options'];

function ApiRouter() {
    this._handlers = {};
    supportedMethods.forEach(function(method) {
        this._handlers[method] = [];
    }.bind(this));
    this._preDispatch = [];
    this._eventEmitter = new EventEmitter();
};

ApiRouter.prototype.on = function(event, callback) {
    this._eventEmitter.on(event, callback);
    return this;
};

ApiRouter.prototype.getHandlersForResource = function(resource, method, options) {
    var handlers = [];

    this._handlers[method].forEach(function(route) {
        var match = resource.match(route.regex);

        if (!match) {
            return;
        }

        var routeHasProperty = false;

        for (var i in options.props) {
            if (route.options.props.hasOwnProperty(options.props[i]) && -1 === found.indexOf(options.props[i])) {
                routeHasProperty = true;
                found.push(options.props[i]);
                validations[options.props[i]] = route.options.props[options.props[i]];
            }
        }

        if (routeHasProperty) {
            params = {};
            for (var i = 0, len = route.keys.length; i < len; i++) {
                var paramValue = match[i + 1];
                if (typeof paramValue == 'undefined') {
                    paramValue = null;
                }
                params[route.keys[i].name] = paramValue;
            }
            handlers.push({
                args: [params],
                callback: route.callback
            });
        }
    });

    return handler;
};

supportedMethods.forEach(function(method) {
    ApiRouter.prototype[method] = function(resource, options, callback) {
        var keys = [];
        var regex = pathToRegexp(resource, keys);
        this._handlers[method].push({
            resource: resource,
            options: options,
            callback: callback,
            regex: regex,
            keys: keys
        });
        return this;
    };

    var handler = 'handle' + method.charAt(0).toUpperCase() + method.slice(1);

    ApiRouter.prototype[handler] = function(resource, options, req) {
        // Measure how long it takes to handle this request
        var timeStart = process.hrtime(); // high resolution time
        var handlers = [];
        var found = [];
        var validations = {};

        this._handlers[method].forEach(function(route) {
            var match = resource.match(route.regex);

            if (!match) {
                return;
            }

            var routeHasProperty = false;

            for (var i in options.props) {
                if (route.options.props.hasOwnProperty(options.props[i]) && -1 === found.indexOf(options.props[i])) {
                    routeHasProperty = true;
                    found.push(options.props[i]);
                    validations[options.props[i]] = route.options.props[options.props[i]];
                }
            }

            if (routeHasProperty) {
                params = {};
                for (var i = 0, len = route.keys.length; i < len; i++) {
                    var paramValue = match[i + 1];
                    if (typeof paramValue == 'undefined') {
                        paramValue = null;
                    }
                    params[route.keys[i].name] = paramValue;
                }
                handlers.push({
                    args: [params, req],
                    callback: route.callback,
                    route: route
                });
            }
        });

        var unfound = options.props.filter(function(prop) {
            return -1 === found.indexOf(prop);
        });

        if (unfound.length || !handlers.length) {
            this._eventEmitter.emit('api:error', {
                resource: resource,
                options: options
            });

            return Promise.reject("Unable to resolve props " + unfound.join(', ') + " for resource " + resource);
        }

        var callbacks = handlers.map(function(handler) {
            this._eventEmitter.emit('api:handler', {
                method: method,
                resource: resource,
                options: handler.route.options,
                args: handler.args
            });
            return handler.callback.apply(this, handler.args);
        }.bind(this));

        return Promise.all(callbacks)
        .then(function(results) {
            var result = {};

            results.forEach(function(res) {
                for (var i in res) {
                    if (-1 !== options.props.indexOf(i)) {
                        result[i] = res[i];
                    }
                }
            });

            for (var i in options.props) {
                if (!result.hasOwnProperty(options.props[i])) {
                    return Promise.reject("Missing property " + options.props[i]);
                }
            }

            // Validate result
            for (var i in validations) {
                if (typeof result[i] !== validations[i]) {
                    return Promise.reject("Expected " + i + " to be a " + validations[i]);
                }
            }

            var timeEnd = process.hrtime(); // high resolution time
            var duration = (timeEnd[0] * 1000000000 + timeEnd[1]) - (timeStart[0] * 1000000000 + timeStart[1]);

            this._eventEmitter.emit('api:success', {
                resource: resource,
                options: options,
                duration: Math.round(duration / 1000000) // convert to milliseconds
            });

            return result;
        }.bind(this));
    };

    ApiRouter.prototype[method + 'Schema'] = function(resource) {
        var schema = {};
        this._handlers[method].forEach(function(route) {
            if (!route.regex.test(resource)) {
                return;
            }

            schema = _.extend(schema, route.options.props);
        });

        return schema;
    };
});

var respondJson = function(res, data) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data, null, 2) + '\n');
};

ApiRouter.prototype.middleware = function(options) {
    var querystring = require('querystring');
    var config = _.assign({
        basePath: '/'              // Allow APIs to be accessible from a configured base path
    }, options || {});

    var basePathLength = (config.basePath || '').length;

    return function(req, res, next) {
        // Continue if request is not under configured base path
        if (config.basePath && req.url.indexOf(config.basePath) !== 0) {
            return next();
        }

        // Parse URL
        var split = req.url.split('?', 2);
        var resource = split[0].substr(basePathLength);
        var query = querystring.parse(split[1]);

        // Support schema requests
        if (query.hasOwnProperty('schema')) {
            var schema = this.getSchema(resource);
            respondJson(res, schema);
            return;
        }

        // Determine handler
        var method = req.method.toLowerCase();
        var handler = 'handle' + method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();

        var data = {
            props: (query.props || '').split(',').filter(function(val) { return val; })
        };

        this[handler](resource, data, req).then(function(result) {
            respondJson(res, result);
        }).catch(function(error) {
            res.statusCode = 404;
            respondJson(res, error);
        }.bind(this));
    }.bind(this);
};
