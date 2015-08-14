var Promise = require('bluebird');
var _ = require('lodash');
var pathToRegexp = require('path-to-regexp');
var EventEmitter = require('events').EventEmitter;
var jsen = require('jsen');
var validateSchema = jsen({"$ref": "http://json-schema.org/draft-04/schema#"});

module.exports = ApiRouter;

/**
 * Constructor for API Router.
 * Allows for registering and handling API routes.
 *
 */
function ApiRouter() {
    this._handlers = {};
    ApiRouter.supportedMethods.forEach(function(method) {
        this._handlers[method] = [];
    }.bind(this));
    this._preDispatch = [];
    this._eventEmitter = new EventEmitter();
};

/**
 * HTTP Methods
 *
 */
ApiRouter.METHOD_GET        = 'GET';
ApiRouter.METHOD_POST       = 'POST';
ApiRouter.METHOD_PUT        = 'PUT';
ApiRouter.METHOD_DELETE     = 'DELETE';
ApiRouter.METHOD_PATCH      = 'PATCH';
ApiRouter.METHOD_OPTIONS    = 'OPTIONS';

/**
 * HTTP methods that are supported.
 *
 */
ApiRouter.supportedMethods = [
    ApiRouter.METHOD_GET,
    ApiRouter.METHOD_POST,
    ApiRouter.METHOD_PUT,
    ApiRouter.METHOD_DELETE,
    ApiRouter.METHOD_PATCH,
    ApiRouter.METHOD_OPTIONS
];

/**
 * Registers a callback to be fired on the specified event.
 *
 * @param string event - Event name.
 * @param function callback - Callback to be invoked on event.
 * @return this - fluent interface.
 */
ApiRouter.prototype.on = function(event, callback) {
    this._eventEmitter.on(event, callback);
    return this;
};

/**
 * Registers a new API route.
 * Multiple callbacks can be registered for the same resource, and the router
 * will determine which callbacks to invoke based on the requested properties.
 *
 * @param string method - HTTP method e.g. GET, POST, etc.
 * @param string resource - The path to the resource, including named parameter placeholders e.g. `/users/:userId`
 * @param object schema - JSON schema that represents the eventual return value of the callback.
 * @param function callback - Callback function to fulfill the data requested.
 * @return this - fluent interface.
 */
ApiRouter.prototype.register = function(method, resource, schema, callback) {
    var normalizedMethod = method.toUpperCase();

    // Validate method
    if (!this._handlers.hasOwnProperty(normalizedMethod)) {
        throw new Error("Invalid method " + method);
    }

    // Validate the schema
    var isSchemaValid = validateSchema(schema);
    if (!isSchemaValid) {
        throw new Error("Invalid schema");
    }

    // Generate a regex to match URLs
    var keys = [];
    var regex = pathToRegexp(resource, keys); // keys are passed in by reference

    // Store the details of this handler so we can look it up later
    this._handlers[normalizedMethod].push({
        resource: resource,
        schema: schema,
        callback: callback,
        regex: regex,
        keys: keys
    });

    return this;
};

ApiRouter.prototype.handle = function(method, resource, options, req) {
    // Measure how long it takes to handle this request
    var timeStart = process.hrtime(); // high resolution time
    var handlers = [];
    var found = [];

    this._handlers[method].forEach(function(route) {
        var match = resource.match(route.regex);

        if (!match) {
            return;
        }

        var routeHasProperty = false;

        if (options.props.length) {
            for (var i in options.props) {
                if (route.schema.properties.hasOwnProperty(options.props[i]) && -1 === found.indexOf(options.props[i])) {
                    routeHasProperty = true;
                    found.push(options.props[i]);
                }
            }
        } else {
            routeHasProperty = true;
        }

        if (routeHasProperty) {
            var params = {};
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

    if (options.props.length) {
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
    }

    var callbacks = handlers.map(function(handler) {
        this._eventEmitter.emit('api:handler', {
            method: method,
            resource: resource,
            schema: handler.route.schema,
            args: handler.args
        });
        return handler.callback.apply(this, handler.args);
    }.bind(this));

    return Promise.all(callbacks)
    .then(function(results) {
        var result = {};

        results.forEach(function(res) {
            for (var i in res) {
                if (0 === options.props.length || -1 !== options.props.indexOf(i)) {
                    result[i] = res[i];
                }
            }
        });

        for (var i in options.props) {
            if (!result.hasOwnProperty(options.props[i])) {
                return Promise.reject("Missing property " + options.props[i]);
            }
        }

        var mergedSchema = {};
        handlers.forEach(function(handler) {
            _.merge(mergedSchema, handler.route.schema);
        });

        var validate = jsen(mergedSchema);
        var valid = validate(result);

        if (!valid) {
            return Promise.reject('Return value did not validate with schema');
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

/**
 * Returns a merged schema based on all handlers for the given method and resource
 *
 * @param string method - HTTP verb e.g. GET, POST, etc.
 * @param string resource - URL to resource e.g. /users/123
 * @return object schema - Merged schema from all handlers
 */
ApiRouter.prototype.getSchema = function(method, resource) {
    var normalizedMethod = method.toUpperCase();
    var mergedSchema = {};

    this._handlers[normalizedMethod].filter(function(route) {
        return route.regex.test(resource);
    }).forEach(function(route) {
        _.merge(mergedSchema, route.schema);
    });

    return mergedSchema;
};

ApiRouter.supportedMethods.forEach(function(method) {
    // Convenience methods to register each HTTP verb e.g. api.get(), api.post(), etc.
    ApiRouter.prototype[method.toLowerCase()] = function(resource, schema, callback) {
        return this.register(method, resource, schema, callback);
    };

    // Convience methods to handle each HTTP verb e.g. api.handleGet(), api.handlePost(), etc.
    var handler = 'handle' + method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
    ApiRouter.prototype[handler] = function(resource, options, req) {
        return this.handle(method, resource, options, req);
    };
});

// Utility function to send a JSON response
var respondJson = function(res, obj) {
    res.setHeader('Content-Type', 'application/json');

    try {
        var body = JSON.stringify(obj, null, 2) + '\n';
    } catch (e) {
        res.statusCode = 500;
        var body = JSON.stringify({
            error: e
        }, null, 2);
    }

    res.end(body);
};

/**
 * Returns a function that can be used as connect middleware.
 *
 * The middleware will call next() if the request does not start with the configured base path.
 * Otherwise, the api router will kick and and try to handle the request.
 *
 * @param object options - Custom options
 *      basePath (default: '/') - base path to mount your API to.
 * @return function
 */
ApiRouter.prototype.middleware = function(options) {
    var querystring = require('querystring');
    var config = _.assign({
        basePath: '/'              // Allow APIs to be accessible from a configured base path
    }, options || {});

    // Determine how much of the path to trim based on the number of characters leading up to the trailing `/`
    var basePathLength = (config.basePath || '').replace(/\/$/, '').length;

    return function(req, res, next) {
        // Continue if request is not under configured base path
        if (config.basePath && req.url.indexOf(config.basePath) !== 0) {
            return next();
        }

        // Parse request
        var split = req.url.split('?', 2);
        var resource = split[0].substr(basePathLength);
        var query = querystring.parse(split[1]);
        var method = req.method.toUpperCase();

        // Support schema requests
        if (query.hasOwnProperty('schema')) {
            var schema = this.getSchema(method, resource);
            respondJson(res, schema);
            return;
        }

        // Determine handler
        var handler = 'handle' + method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();

        var data = {
            props: (query.props || '').split(',').filter(function(val) { return val; }),
            pluck: (query.pluck || '').split(',').filter(function(val) { return val; })
        };

        this[handler](resource, data, req).then(function(result) {
            respondJson(res, result);
        }).catch(function(error) {
            res.statusCode = 404;
            respondJson(res, {
                error: error
            });
        }.bind(this));
    }.bind(this);
};
