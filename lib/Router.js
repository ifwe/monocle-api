var Promise = require('bluebird');
var _ = require('lodash');
var pathToRegexp = require('path-to-regexp');
var EventEmitter = require('events').EventEmitter;
var jsen = require('jsen');
var validateSchema = jsen({"$ref": "http://json-schema.org/draft-04/schema#"});
var Request = require('./Request');
var Connection = require('./Connection');
var Symlink = require('./Symlink');

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

var sortByTitle = function(docs) {
    return docs.sort(titleCompare);
};

var titleCompare = function(a, b) {
    return (a.schema.title || a.pattern) > (b.schema.title || b.pattern);
};

Router.prototype.documentAll = function() {
    return Promise.map(this._routes, documentRoute)
    .then(sortByTitle);
};

function documentRoute(route) {
    // OPTIONS are always supported
    var methods = Object.keys(route.handlers).concat([Request.METHOD_OPTIONS]).sort(function(a, b) {
        var valueOf = function(method) {
            var values = {
                GET: -10e6,
                POST: -10e5,
                PUT: -10e4,
                PATCH: -10e3,
                DELETE: -10e2,
                OPTIONS: -10e1
            }

            return (values.hasOwnProperty(method)) ? values[method] : 0;
        }

        return (valueOf(a) < valueOf(b)) ? -1 : 1;
    });

    return Promise.resolve({
        pattern: route.pattern,
        methods: methods,
        schema: route.schema
    });
};

/**
 * Generate a response with a specific HTTP status code and optional response body.
 * Responses that contain HTTP status codes will bypass schema validation.
 *
 * @param int code - HTTP status code
 * @param mixed body - Option response body
 */
Router.prototype.status = function(code, body) {
    body = body || {};
    body.$httpStatus = parseInt(code, 10);
    return Promise.resolve(body);
}

function getMatchedRoute(resourceId) {
    // Loop through requests to find matching resource
    var route;
    var match;

    for (var i = 0, len = this._routes.length; i < len; i++) {
        route = this._routes[i];
        match = resourceId.match(route.regex);

        if (!match) {
            continue;
        }

        return {
            match: match,
            route: route
        };
    }
}

Router.prototype.handle = function(request, connection) {
    var timeStart = process.hrtime();
    var handlers = [];
    var route = null;
    var method = request.getMethod();
    var resourceId = request.getResourceId();

    // Master documentation
    if (resourceId === '/' && request.isOptions()) {
        return Promise.resolve(this.documentAll());
    }

    // Loop through requests to find matching resource
    var matched = getMatchedRoute.call(this, resourceId);

    if (!matched) {
        emit.call(this, 'api:error', request, null, timeStart);
        return Promise.reject('No handlers');
    }

    var match = matched.match;
    route = matched.route;

    // Support OPTIONS
    if (request.isOptions()) {
        return Promise.resolve(documentRoute(route));
    }

    // Prepare request
    for (var i = 0, len = route.keys.length; i < len; i++) {
        var paramName = route.keys[i].name;
        var paramValue = match[i + 1];

        if (typeof paramValue == 'undefined') {
            paramValue = null;
        }

        // Make sure numbers are numeric
        var props = route.schema.properties || route.schema.items.properties;
        if (props.hasOwnProperty(paramName)) {
            switch (props[paramName].type) {
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

    if (!route.handlers.hasOwnProperty(method)) {
        emit.call(this, 'api:error', request, null, timeStart);
        return Promise.reject({ error: "No " + method + " handler for " + resourceId });
    }

    if (_.isFunction(route.handlers[method])) {
        handlers.push(route.handlers[method]);
    } else if (_.isArray(route.handlers[method])) {
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

    if (!handlers.length) {
        emit.call(this, 'api:error', request, null, timeStart);
        return Promise.reject('No handlers');
    }

    var callbacks = handlers.map(function(handler) {
        emit.call(this, 'api:handler', request, route, timeStart);
        return handler(request, connection);
    }.bind(this));

    return Promise.all(callbacks)
    .then(function(results) {
        results = results.map(function(result) {
            // Multiple resources returned
            if (_.isArray(result)) {
                return result.map(function(r) {
                    // Convert to an object
                    return _.merge({}, r);
                });
            }

            return result;
        });

        // Merges results from different functions
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
                emit.call(this, 'api:error', request, route, timeStart);
                return Promise.reject("Unable to resolve props " + unfound.join(', ') + " for resource " + resourceId);
            }
        }

        // Resolve symlinks
        return resolveSymlinks(result, connection).then(function() {
            // Validate responses except for DELETE methods
            if (!result.$httpStatus && method !== Request.METHOD_DELETE) {
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
            }

            // Emit success event
            emit.call(this, 'api:success', request, route, timeStart);

            return result;
        }.bind(this))


    }.bind(this));
};

var emit = function(event, request, route, timeStart, extraData) {
    data = extraData || {};
    data.resourceId = request.getResourceId();
    data.schema = route && route.schema;
    data.request = request;
    data.pattern = route && route.pattern;
    data.hrTimeStart = timeStart;
    data.timeStart = data.hrTimeStart[0] * 1000000 + data.hrTimeStart[1] / 1000;
    data.hrTimeEnd = process.hrtime();
    data.timeEnd = data.hrTimeEnd[0] * 1000000 + data.hrTimeEnd[1] / 1000;
    data.duration = data.timeEnd - data.timeStart;

    this.emit(event, data);
};

// This function handles arrays and objects
var resolveSymlinks = function(results, connection)
{
    var promises = [];
    for (var key in results) {
        (function(i) {
            value = results[key];
            if (value instanceof Symlink) {
                 var promise = value.resolve(connection)
                    .then(function(result) {
                        results[i] = result;
                    });

                    promises.push(promise);
            } else if (typeof value == "object" && value !== null) {
                resolveSymlinks(value, connection);
            }
        })(key);
    }

    return Promise.all(promises);
}

// Utility function to send a JSON response
var respondJson = function(res, obj) {
    res.setHeader('Content-Type', 'application/json');

    if (obj.$httpStatus) {
        res.statusCode = obj.$httpStatus;
    }

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

var respondDocs = function(res) {
    var jade = require('jade');
    var path = require('path');
    var docsPath = path.join(__dirname, 'views', 'docs.jade');
    this.documentAll().then(function(routes) {
        res.end(jade.renderFile(docsPath, {
            routes: routes
        }));
    });
}

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

        // Render fancy docs
        if ('GET' === req.method && req.url === config.basePath) {
            return respondDocs.call(this, res);
        }

        var path = req.url.substr(basePathLength).replace(/\?.*/, '');

        // Support batch
        if ('/_batch' === path && 'POST' === req.method) {
            this.batch(req, res)
            .then(function(results) {
                respondJson(res, results);
            });
            return;
        }

        var connection = new Connection(this, req, res);
        var request = new Request(req.url);
        var parsedUrl = request.getUrl();
        request.setMethod(req.method);

        request.setResourceId(path);

        if (req.body) {
            request.setResource(req.body);
        }

        this.handle(request, connection).then(function(result) {
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

Router.prototype.batch = function(req, res) {
    var connection = new Connection(this, req, res);

    return Promise.all(req.body.map(function(envelope) {
        var request = new Request(envelope.url);
        var parsedUrl = request.getUrl();
        request.setMethod(envelope.method);
        request.setResourceId(parsedUrl.pathname);

        if (envelope.body) {
            request.setResource(envelope.body);
        }

        return this.handle(request, connection)
        .then(function(result) {
            return {
                status: 200,
                body: result
            };
        })
        .catch(function(error) {
            return {
                status: 404,
                body: error
            };
        });
    }.bind(this)));
};
