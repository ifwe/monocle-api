'use strict';

var Promise = require('bluebird');
var _ = require('lodash');
var Request = require('./Request');
var pathToRegexp = require('path-to-regexp');
var jsen = require('jsen');
var validateSchema = jsen({"$ref": "http://json-schema.org/draft-04/schema#"});
var querystring = require('querystring');


function Route(routeDef, openApiDocs) {
    this._routeDef = routeDef;
    this.schema = routeDef.schema;
    this.aliasResolver = routeDef.aliasResolver;
    this.pattern = routeDef.pattern;
    this.handlers = routeDef.handlers;
    this.keys = routeDef.keys;
    this.query = routeDef.query;
    this.openApiDocs = openApiDocs || {};
}

/**
 * @param patternConfig
 * @param schema
 * @param handlers
 * @param openApiDocs
 * @return {Route}
 */
Route.createRoute = function (patternConfig, schema, handlers, openApiDocs) {
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
        query: query,
    };

    return new Route(route, openApiDocs);
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
 * @param {Object} [openApiDocs]
 * @return {Route}
 */
Route.createAlias = function (patternConfig, aliasResolver, openApiDocs) {
    var parsedPattern = parsePatternConfig(patternConfig);

    var routeDef = {
        pattern: parsedPattern.pattern,
        query: parsedPattern.query,
        regex: parsedPattern.regex,
        keys: parsedPattern.keys,
        aliasResolver: aliasResolver
    };

    return new Route(routeDef, openApiDocs);
};

Route.prototype.getLegacyRouteObject = function () {
    return this._routeDef;
}

Route.prototype.getSupportedProps = function (method) {
    var handler = this.handlers[method] || [];
    if (_.isFunction(handler)) {
        return [];
    }
    return handler.reduce(function (acc, propHandler) {
        acc.push.apply(acc, propHandler.props);
        return acc;
    }, []);
};

Route.prototype.isAlias = function () {
    return !!this.aliasResolver;
};

Route.prototype.resolveAlias = function (request, connection) {
    var target;
    var resolver = this.aliasResolver;
    if (typeof resolver === 'function') {
        target = Promise.resolve(resolver(request, connection));
    } else if (typeof resolver === 'string') {
        request.setResourceId(resolver);
        target = Promise.resolve(request);
    }

    return target;
}

Route.prototype.canHandleMethod = function (method) {
    return this.handlers.hasOwnProperty(method)
}

/**
 * @param {Object} requestRouter a Router
 * @param {String} method
 * @returns {Object[]|Promise}
 */
Route.prototype.resolveHandlers = function (requestRouter, method) {
    var handlers = [];
    if (_.isFunction(this.handlers[method])) {
        handlers.push(this.handlers[method]);
    } else if (_.isArray(this.handlers[method])) {
        var props = requestRouter.getProps();
        var resource = requestRouter.getResource();

        //For PUT OR PATCH map the resource passed in to the correct handler
        if (typeof resource !== 'undefined' && [Request.METHOD_PATCH, Request.METHOD_PUT].indexOf(method) !== -1) {
            var keys = Object.keys(resource);

            // If resource passed in is an empty array, return an empty resource
            // (this module's tested behavior relies on this being a promise for an empty resource)
            if (!keys.length) {
                return Promise.resolve({});
            }

            handlers = this.getHandlers(requestRouter, keys);
        } else if (props.length) {
            handlers = this.getHandlers(requestRouter, props);
        } else {
            this.handlers[method].forEach(function (handler) {
                handlers.push(handler.callback);
            });
        }
    }

    return handlers;
}

Route.prototype.getHandlers = function (request, input) {
    var method = request.getMethod();
    var handlers = [];

    this.handlers[method].filter(function (handler) {
        var topLevelInput = input.map(function (input) {
            return input.split(/[.@]/)[0];
        });
        return _.intersection(topLevelInput, handler.props).length;
    }).forEach(function (handler) {
        handlers.push(handler.callback);
    });

    return handlers;
}

Route.prototype.getOpenApiDocumentation = function () {
    var openApiPath = this.pattern.replace(/:(\w+)/g, '{$1}');
    var docs = {};
    if (this.isAlias()) {
        docs[openApiPath] = this.openApiDocs;
    } else {
        docs[openApiPath] = Object.keys(this.handlers).reduce(function (bcc, method) {
            var parameters = [];
            var props = this.getSupportedProps(method);
            if (props.length) {
                parameters.push({
                    "name": "props",
                    "in": "query",
                    "schema": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": props,
                        }
                    },
                    "explode": false,
                    "description": props.join(", ")
                })
            }

            _.each(this.keys, function (val) {
                parameters.push({
                    "name": val.name,
                    "in": "path",
                    "required": true
                })
            });

            _.each(this.query, function (val, key) {
                parameters.push({
                    "name": key,
                    "in": "query",
                    "required": !val
                })
            });

            bcc[method.toLowerCase()] = {
                "parameters": parameters,
                "responses": {
                    "200": {
                        "content": {
                            "application/json": {
                                "schema": this.schema
                            }
                        }
                    }
                }
            };

            return bcc;
        }.bind(this), {});
    }

    return Promise.resolve(docs);
};

module.exports = Route;
