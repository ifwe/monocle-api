var Promise = require('bluebird');
var _ = require('lodash');
var pathToRegexp = require('path-to-regexp');
var EventEmitter = require('events').EventEmitter;
var jsen = require('jsen');
var validateSchema = jsen({"$ref": "http://json-schema.org/draft-04/schema#"});
var Request = require('./Request');
var util = require('util');

module.exports = Router;

function Router() {
    this._routes = [];
}

// Extend EventEmitter
util.inherits(Router, EventEmitter);

/**
 * Registers a route for the API.
 *
 * @param string pattern - URL pattern for matching requests
 * @param object schema - JSON Schema
 * @param object handlers - Callback functions to support the various HTTP verbs
 */
Router.prototype.route = function(pattern, schema, handlers) {
    // Validate the schema
    var isSchemaValid = validateSchema(schema);
    if (!isSchemaValid) {
        throw new Error("Invalid schema");
    }

    // Generate a regex to match URLs
    var keys = [];
    var regex = pathToRegexp(pattern, keys); // keys are passed in by reference

    var normalizedHandlers = {};

    _.forOwn(handlers, function(handler, method) {
        switch (method.toUpperCase()) {
            case Request.METHOD_GET:
            case Request.METHOD_POST:
            case Request.METHOD_PUT:
            case Request.METHOD_PATCH:
            case Request.METHOD_DELETE:
                normalizedHandlers[method.toUpperCase()] = handler;
                break;

            default:
                throw new Error('Unsupported method ' + method);
        }
    });

    this._routes.push({
        pattern: pattern,
        schema: schema,
        handlers: normalizedHandlers,
        regex: regex,
        keys: keys
    });

    return this;
};

[
    Request.METHOD_GET,
    Request.METHOD_POST,
    Request.METHOD_PUT,
    Request.METHOD_PATCH,
    Request.METHOD_DELETE,
    Request.METHOD_OPTIONS
].forEach(function(method) {
    Router.prototype[method.toLowerCase()] = function(resourceId, options) {
        var request = new Request(resourceId);
        request.setResourceId(resourceId);
        request.setMethod(method);
        return this.handle(request);
    };
});

Router.prototype.documentAll = function() {
    return Promise.resolve(this._routes.map(documentRoute));
};

function documentRoute(route) {
    var methods = Object.keys(route.handlers).map(function(method) {
        return method;
    });

    methods.push(Request.METHOD_OPTIONS); // Always supported

    return {
        pattern: route.pattern,
        methods: methods,
        schema: route.schema
    };
};

Router.prototype.handle = function(request) {
    var handlers = [];
    var route = null;
    var method = request.getMethod();
    var resourceId = request.getResourceId();

    // Master documentation
    if (resourceId === '/' && request.isOptions()) {
        return Promise.resolve(this.documentAll());
    }

    // Loop through requests to find matching resource
    for (var i = 0, len = this._routes.length; i < len; i++) {
        route = this._routes[i];

        var match = resourceId.match(route.regex);

        if (!match) {
            continue;
        }

        for (var i = 0, len = route.keys.length; i < len; i++) {
            var paramName = route.keys[i].name;
            var paramValue = match[i + 1];

            if (typeof paramValue == 'undefined') {
                paramValue = null;
            }

            // Make sure numbers are numeric
            if (route.schema.properties.hasOwnProperty(paramName)) {
                switch (route.schema.properties[paramName].type) {
                    case 'integer':
                        paramValue = parseInt(paramValue);
                        break;

                    case 'number':
                        paramValue = parseFloat(paramValue);
                        break;
                }
            }

            request.setParam(paramName, paramValue);
        }

        // Support OPTIONS
        if (Request.METHOD_OPTIONS === method) {
            return Promise.resolve(documentRoute(route));
        }

        if (!route.handlers.hasOwnProperty(method)) {
            return Promise.reject({ error: "No " + method + " handler for " + resourceId });
        }

        if (_.isFunction(route.handlers[method])) {
            handlers.push(route.handlers[method]);
            break;
        }

        if (_.isArray(route.handlers[method])) {
            var props = request.getProps();

            if (props.length) {
                route.handlers[method].filter(function(handler) {
                    return _.intersection(request.getProps(), handler.props).length;
                }).forEach(function(handler) {
                    handlers.push(handler.callback);
                });
            } else {
                route.handlers[method].forEach(function(handler) {
                    handlers.push(handler.callback);
                });
            }
        }

        break;
    }

    if (!handlers.length) {
        this.emit('api:error', {
            resourceId: resourceId,
            schema: null,
            request: request
        });
        return Promise.reject('No handlers');
    }

    var callbacks = handlers.map(function(handler) {
        this.emit('api:handler', {
            resourceId: resourceId,
            schema: route.schema,
            request: request
        });
        return handler.call(this, request);
    }.bind(this));

    return Promise.all(callbacks)
    .then(function(results) {
        results = results.map(function(result) {
            if (_.isArray(result)) {
                return result.map(function(r) {
                    if (typeof r.toRepresentation == 'function') {
                        return r.toRepresentation();
                    }

                    return r;
                });
            } else if (_.isObject(result)) {
                // duck typing
                if (typeof result.toRepresentation == 'function') {
                    return result.toRepresentation();
                }
            }

            return result;
        });

        var result = _.merge.apply(null, results);

        var props = request.getProps();
        if (props.length) {
            // Remove all unneeded props
            for (var i in result) {
                if (!result.hasOwnProperty(i)) continue;
                if (i[0] === '$') continue;
                if (-1 === props.indexOf(i)) delete result[i];
            }

            props.forEach(function(prop) {
                if (result.hasOwnProperty(prop)) return;

                // Check if param can be reflected from request
                var reflectedParam = request.getParam(prop);
                if (reflectedParam) result[prop] = reflectedParam;
            });

            var unfound = props.filter(function(prop) {
                return !result.hasOwnProperty(prop);
            });

            if (unfound.length) {
                this.emit('api:error', {
                    resourceId: resourceId,
                    schema: route.schema,
                    request: request
                });

                return Promise.reject("Unable to resolve props " + unfound.join(', ') + " for resource " + resourceId);
            }
        }

        var validate = jsen(route.schema);
        var valid = validate(result);

        if (!valid) {
            return Promise.reject({
                message: 'Return value did not validate with schema',
                errors: validate.errors,
                schema: route.schema,
                data: result
            });
        }

        // Emit success event
        this.emit('api:success', {
            resourceId: resourceId,
            schema: route.schema,
            request: request
        });

        return result;
    }.bind(this));
};

// Utility function to send a JSON response
var respondJson = function(res, obj) {
    res.setHeader('Content-Type', 'application/json');

    try {
        var body = JSON.stringify(obj, null, 2) + '\n';
    } catch (e) {
        res.statusCode = 500;
        var body = JSON.stringify({
            error: 'Unable to stringify to JSON',
            exception: e
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
Router.prototype.middleware = function(options) {
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

        var request = new Request(req.url);
        var parsedUrl = request.getUrl();
        request.setMethod(req.method);

        request.setResourceId(req.url.substr(basePathLength).replace(/\?.*/, ''));
        if (req.body) {
            request.setResource(req.body);
        }

        this.handle(request).then(function(result) {
            respondJson(res, result);
        }).catch(function(error) {
            res.statusCode = 404;
            respondJson(res, {
                error: 'Not found',
                exception: error
            });
        }.bind(this));
    }.bind(this);
};
