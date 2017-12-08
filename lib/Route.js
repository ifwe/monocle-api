var Promise = require('bluebird');
var _ = require('lodash');
var Request = require('./Request');
var debug = require('debug')('monocle-api:route');
var pathToRegexp = require('path-to-regexp');
var jsen = require('jsen');
var validateSchema = jsen({"$ref": "http://json-schema.org/draft-04/schema#"});
var querystring = require('querystring');


function Route(routeDef) {
    this._routeDef = routeDef;
    this._documentation = null;
}

/**
 * @param patternConfig
 * @param schema
 * @param handlers
 * @return {Route}
 */
Route.createRoute = function (patternConfig, schema, handlers) {
    // Validate the schema
    var isSchemaValid = validateSchema(schema);
    if (!isSchemaValid) {
        throw new Error("Invalid schema");
    }

    var pattern;
    var query;
    if (Array.isArray(patternConfig)) {
        pattern = patternConfig[0];
        query = querystring.parse(patternConfig[1]);
    } else {
        pattern = patternConfig;
        query = {};
    }

    // Generate a regex to match URLs
    var keys = [];
    var regex = pathToRegexp(pattern, keys); // keys are passed in by reference

    var normalizedHandlers = {};

    _.forOwn(handlers, function (handler, method) {
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


    var route = {
        pattern: pattern,
        schema: schema,
        handlers: normalizedHandlers,
        regex: regex,
        keys: keys,
        query: query
    };

    return new Route(route);
};


function parsePatternConfig(patternConfig) {
    var pattern;
    var query;

    if (Array.isArray(patternConfig)) {
        pattern = patternConfig[0];
        query = querystring.parse(patternConfig[1]);
    } else {
        pattern = patternConfig;
        query = {};
    }

    // Generate a regex to match URLs
    var keys = [];
    var regex = pathToRegexp(pattern, keys); // keys are passed in by reference

    return {
        pattern: pattern,
        query: query,
        regex: regex,
        keys: keys
    };
}

/**
 * @param patternConfig
 * @param aliasResolver
 *
 * @return {Route}
 */
Route.createAlias = function (patternConfig, aliasResolver) {
    var parsedPattern = parsePatternConfig(patternConfig);

    var routeDef = {
        pattern: parsedPattern.pattern,
        query: parsedPattern.query,
        regex: parsedPattern.regex,
        keys: parsedPattern.keys,
        aliasResolver: aliasResolver
    };

    return new Route(routeDef);
};

Route.prototype.getLegacyRouteObject = function () {
    return this._routeDef;
}

Route.prototype.getSupportedProps = function () {
    return this._routeDef.handlers.reduce(function (acc, handler) {
        if (_.isFunction(handler)) {
            return acc;
        } else {
            return acc.push.apply(acc, handler.props);
        }
    }, []);
};

Route.prototype.getPattern = function () {
    return this._routeDef.pattern
}

Route.prototype.isAlias = function () {
    return !!this._routeDef.aliasResolver;
};

Route.prototype.resolveAlias = function (request, connection) {
    var target;
    var resolver = this._routeDef.aliasResolver;
    if (typeof resolver === 'function') {
        target = Promise.resolve(resolver(request, connection));
    } else if (typeof resolver === 'string') {
        request.setResourceId(resolver);
        target = Promise.resolve(request);
    }

    return target;
}

Route.prototype.canHandleMethod = function (method) {
    return this._routeDef.handlers.hasOwnProperty(method)
}

Route.prototype.resolveHandlers = function (requestRouter, method) {
    var handlers = [];
    if (_.isFunction(this._routeDef.handlers[method])) {
        handlers.push(this._routeDef.handlers[method]);
    } else if (_.isArray(this._routeDef.handlers[method])) {
        var props = requestRouter.getProps();
        var resource = requestRouter.getResource();

        //For PUT OR PATCH map the resource passed in to the correct handler
        if (typeof resource !== 'undefined' && [Request.METHOD_PATCH, Request.METHOD_PUT].indexOf(method) !== -1) {
            var keys = Object.keys(resource);

            //If resource passed in is an empty array, return an empty resource
            if (!keys.length) {
                return new Promise.resolve({});
            }

            handlers = this.getHandlers(requestRouter, keys);
        } else if (props.length) {
            handlers = this.getHandlers(requestRouter, props);
        } else {
            this._routeDef.handlers[method].forEach(function (handler) {
                handlers.push(handler.callback);
            });
        }
    }

    return handlers;
}

Route.prototype.getHandlers = function (request, input) {
    var method = request.getMethod();
    var handlers = [];

    this._routeDef.handlers[method].filter(function (handler) {
        var topLevelInput = input.map(function (input) {
            return input.split(/[\.@]/)[0];
        });
        return _.intersection(topLevelInput, handler.props).length;
    }).forEach(function (handler) {
        handlers.push(handler.callback);
    });

    return handlers;
}

/**
 * @return {Promise}
 */
Route.prototype.getDocumentation = function () {
    var alias;
    var methods;
    var route = this._routeDef;
    if (!this._documentation) {
        this._documentation = new Promise(function (resolve, reject) {
            if (route.aliasResolver) {
                debug('documenting alias', route);
                alias = (typeof route.aliasResolver === 'string') ? route.aliasResolver : '<dynamic>';
            } else {
                debug('documenting route', route);
                // OPTIONS are always supported
                methods = Object.keys(route.handlers).concat([Request.METHOD_OPTIONS]).sort(function (a, b) {
                    var valueOf = function (method) {
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
            }

            resolve({
                pattern: route.pattern,
                methods: methods,
                query: route.query,
                schema: route.schema,
                alias: alias
            });
        });
    }

    return this._documentation
};

module.exports = Route;
