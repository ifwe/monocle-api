var Promise = require('bluebird');
var _ = require('lodash');
var pathToRegexp = require('path-to-regexp');
var EventEmitter = require('events').EventEmitter;
var jsen = require('jsen');
var validateSchema = jsen({"$ref": "http://json-schema.org/draft-04/schema#"});
var Request = require('./Request');
var RequestRouter = require('./RequestRouter');
var Connection = require('./Connection');
var Symlink = require('./Symlink');
var PropertyFilter = require('./PropertyFilter');
var util = require('util');
var errorSchema = require('./schemas/error');
var Resource = require('./Resource');
var OffsetPaginator = require('./OffsetPaginator');
var CollectionCache = require('./CollectionCache');
var querystring = require('querystring');
var merge = require('./util/merge');
var debug = require('debug')('monocle-api:router');

module.exports = Router;

function Router() {
    this._routes = [];
    this._postRoutes = [];
}

// Extend EventEmitter
util.inherits(Router, EventEmitter);

/**
 * Registers a route for the API.
 *
 * @param string|array pattern - URL pattern for matching requests, or an array with pattern and query string config
 * @param object schema - JSON Schema
 * @param object handlers - Callback functions to support the various HTTP verbs
 */
Router.prototype.route = function(patternConfig, schema, handlers) {
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
        keys: keys,
        query: query
    });

    return this;
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

Router.prototype.postRoute = function(callback) {
    this._postRoutes.push(callback);
    return this;
};

Router.prototype.alias = function(patternConfig, aliasResolver) {
    var parsedPattern = parsePatternConfig(patternConfig);

    this._routes.push({
        pattern: parsedPattern.pattern,
        query: parsedPattern.query,
        regex: parsedPattern.regex,
        keys: parsedPattern.keys,
        aliasResolver: aliasResolver
    });

    return this;
};

var sortByTitle = function(docs) {
    return docs.sort(titleCompare);
};

var titleCompare = function(a, b) {
    return ((a.schema && a.schema.title) || a.pattern) > ((b.schema && b.schema.title) || b.pattern);
};

var documentAllCache = null;
Router.prototype.documentAll = function() {
    if (null === documentAllCache) {
        documentAllCache = Promise.map(this._routes, documentRoute);
    }
    return documentAllCache;
};

var documentedRoutesCache = {};

function documentRoute(route) {
    var alias;
    var methods;

    if (documentedRoutesCache.hasOwnProperty(route.pattern)) {
        return documentedRoutesCache[route.pattern];
    }

    documentedRoutesCache[route.pattern] = new Promise(function(resolve, reject) {
        if (route.aliasResolver) {
            debug('documenting alias', route);
            alias = (typeof route.aliasResolver === 'string') ? route.aliasResolver : '<dynamic>';
        } else {
            debug('documenting route', route);
            // OPTIONS are always supported
            methods = Object.keys(route.handlers).concat([Request.METHOD_OPTIONS]).sort(function(a, b) {
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
        }

        resolve({
            pattern: route.pattern,
            methods: methods,
            query: route.query,
            schema: route.schema,
            alias: alias
        });
    });

    return documentedRoutesCache[route.pattern];
};

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

function getFunctionHandlers(request, route, input) {
    var method = request.getMethod();
    var handlers = [];

    route.handlers[method].filter(function(handler) {
        var topLevelInput = input.map(function(input) {
            return input.split(/[\.@]/)[0];
        });
        return _.intersection(topLevelInput, handler.props).length;
    }).forEach(function(handler) {
        handlers.push(handler.callback);
    });

    return handlers;
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
        return request.error(404, Request.ERROR_NO_HANDLER.message + ' ' + resourceId, Request.ERROR_NO_HANDLER.code, RequestRouter.ERROR_NO_HANDLER.error);
    }

    var match = matched.match;
    route = matched.route;

    if (route.aliasResolver) {
        // route is an alias, resolve the alias and handle the modified request
        var target;
        var originalResourceId = request.getResourceId();

        if (typeof route.aliasResolver === 'function') {
            target = Promise.resolve(route.aliasResolver(request, connection));
        } else if (typeof route.aliasResolver === 'string') {
            request.setResourceId(route.aliasResolver);
            target = Promise.resolve(request);
        }

        return target.then(function(targetRequest) {
            if (!targetRequest || typeof targetRequest.getResourceId !== 'function') {
                debug('Alias did not resolve to a Request instance', originalResourceId, typeof targetRequest);
                return request.error(500, RequestRouter.ERROR_ALIAS_DID_NOT_RESOLVE.message, RequestRouter.ERROR_ALIAS_DID_NOT_RESOLVE.code, RequestRouter.ERROR_ALIAS_DID_NOT_RESOLVE.error);
            }

            if (targetRequest.getResourceId() === originalResourceId) {
                debug('Alias pointed back to itself', originalResourceId);
                return request.error(508, RequestRouter.ERROR_ALIAS_ITSELF.message, RequestRouter.ERROR_ALIAS_ITSELF.code, RequestRouter.ERROR_ALIAS_ITSELF.error);
            }

            debug('Resolving alias', targetRequest.getResourceId());
            return this.handle(targetRequest, connection);
        }.bind(this));
    }

    // Support OPTIONS
    if (request.isOptions()) {
        return Promise.resolve(documentRoute(route));
    }

    var requestRouter = new RequestRouter(request, route, connection);


    if (requestRouter.hasPropertyErrors()) {
        emit.call(this, 'api:error', requestRouter, null, timeStart);
        return requestRouter.error(422, RequestRouter.ERROR_SCHEMA.message, RequestRouter.ERROR_SCHEMA.code, RequestRouter.ERROR_SCHEMA.error);
    }

    if (!route.handlers.hasOwnProperty(method)) {
        emit.call(this, 'api:error', requestRouter, null, timeStart);
        return requestRouter.error(404, "No " + method + " handler for " + resourceId, RequestRouter.ERROR_NO_HANDLER.code, RequestRouter.ERROR_NO_HANDLER.error + ' ' + 'resourceId');
    }

    if (_.isFunction(route.handlers[method])) {
        handlers.push(route.handlers[method]);
    } else if (_.isArray(route.handlers[method])) {
        var props = requestRouter.getProps();
        var resource = requestRouter.getResource();

         //For PUT OR PATCH map the resource passed in to the correct handler
        if (typeof resource !== 'undefined' && [Request.METHOD_PATCH, Request.METHOD_PUT].indexOf(method) !== -1) {
            var keys = Object.keys(resource);

            //If resource passed in is an empty array, return an empty resource
            if (!keys.length) {
                return new Promise.resolve({});
            }

            handlers = getFunctionHandlers(requestRouter, route, keys);
        } else if (props.length) {
            handlers = getFunctionHandlers(requestRouter, route, props);
        } else {
            route.handlers[method].forEach(function(handler) {
                handlers.push(handler.callback);
            });
        }
    }


    if (!handlers.length) {
        emit.call(this, 'api:error', requestRouter, null, timeStart);
        return requestRouter.error(404, RequestRouter.ERROR_NO_HANDLER.message + ' ' + resourceId, RequestRouter.ERROR_NO_HANDLER.code, RequestRouter.ERROR_NO_HANDLER.error);
    }

    var callbacks = handlers.map(function(handler) {
        emit.call(this, 'api:handler', requestRouter, route, timeStart);
        return handler(requestRouter, connection);
    }.bind(this));


    return Promise.all(callbacks)
    .then(function(results) {
        debug('got results from callbacks', results);

        // Merges results from different functions
        var result = merge.apply(null, results);
        debug('merged result from all callbacks', typeof result, result);

        var props = requestRouter.getProps();

        // Restrict by props before resolving symlinks to delete symlinks that are not needed.
        result = restrictProps(result, props);

        // Support internal errors
        if (result.$internalError == 'missing') {
            emit.call(this, 'api:error', requestRouter, route, timeStart);
            result.unfound.forEach(function(prop) {
                requestRouter.addPropertyError(prop, 200);
            });

            return requestRouter.error(404, RequestRouter.ERROR_PROPS_NOT_FOUND.message, RequestRouter.ERROR_PROPS_NOT_FOUND.code, RequestRouter.ERROR_PROPS_NOT_FOUND.error);
        }

        // Validate etag for GET requests of arrays
        if (method === Request.METHOD_GET) {
            var etag = requestRouter.getEtag();
            var collectionCache = new CollectionCache(result, requestRouter);

            // Validate etag
            if (etag && collectionCache.isValid(etag)) {
                // Emit success event
                emit.call(this, 'api:success', requestRouter, route, timeStart);
                return {
                    $httpStatus: 304
                };
            }
        }

        // Resolve symlinks
        return resolveSymlinks(result, connection, props).then(function() {
            // Now that all symlinks are resolved, restrict again
            result = restrictProps(result, props);

            // Add etags to all GETs for collections
            if (method === Request.METHOD_GET) {
                var collectionCache = new CollectionCache(result, requestRouter);
                var etag = collectionCache.id();
                if (etag) result.$etag = etag;
            }

            // Validate responses
            if (!result.$httpStatus) {
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
            emit.call(this, 'api:success', requestRouter, route, timeStart);

            return deleteUndefinedProperties(result, true);
        }.bind(this));
    }.bind(this))
    .then(applyPostRoutes.bind(this))
    .catch(function(error) {
        // Validate error
        var validate = jsen(errorSchema);
        var valid = validate(error);

        if (!valid) {
            // Error response must validate with error schema
            return requestRouter.error(500, RequestRouter.ERROR_RESPONSE_INVALID.message, RequestRouter.ERROR_RESPONSE_INVALID.code, RequestRouter.ERROR_RESPONSE_INVALID.error);
        }

        // Forward error
        return Promise.reject(error);
    });
};

var applyPostRoutes = function(body) {
    var result = Promise.resolve(body);
    this._postRoutes.forEach(function(postRoute) {
        result = result.then(postRoute);
    });
    return result;
};


function deleteUndefinedProperties(test, recurse) {
    for (var i in test) {
        if (typeof test[i] === 'undefined') {
            delete test[i];
        } else if (recurse && typeof test[i] === 'object') {
            deleteUndefinedProperties(test[i], recurse);
        }
    }

    return test;
}

var restrictProps = function(resource, props) {
    if (resource.hasOwnProperty('$httpStatus') && (resource.$httpStatus < 200 || resource.$httpStatus >= 300)) {
        return resource;
    }

    var filter = new PropertyFilter(resource);
    var filtered = filter.props(props);
    if (filtered.$error) {
        return {
            $internalError: 'missing',
            unfound: filtered.missing
        };
    }

    return filtered;
}

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
var resolveSymlinks = function(results, connection, props) {
    var promises = [];
    props = props || [];

    function recurse(results, connection, props, paths) {
        for (var key in results) {
            (function resolveSymlink(i) {
                value = results[key];

                if (Array.isArray(results)) {
                    // array, specify that we'll pluck nested props
                    paths.push('@')
                } else if (paths.length) {
                    // nested path for objects, prefix with .
                    var subpath = '';
                    if (paths[paths.length - 1] !== '@') {
                        subpath += '.';
                    }
                    paths.push(subpath + key);
                } else {
                    // first path
                    paths.push(key);
                }

                // Use duck typing to see the value can be resolved like a Symlink
                if (value && typeof value.resolve === 'function') {
                    var path = paths.join('');
                    childProps = props.filter(function filterSelfOnly(prop) {
                        return prop.indexOf(path) === 0;
                    }).map(function getRoot(prop) {
                        var subpath = prop.substr(path.length);
                        if (subpath[0] === '.') {
                            subpath = subpath.substr(1);
                        }
                        return subpath;
                    }).filter(function(prop) {
                        return prop && prop[0] !== '$' && prop !== key;
                    });

                    var promise = value.resolve(connection, { props: childProps })
                    .then(function(result) {
                        results[i] = result;
                    });
                    promises.push(promise);
                } else if (typeof value == "object" && value !== null) {
                    recurse(value, connection, props, paths);
                }

                paths.pop();
            })(key);
        }
    }

    recurse(results, connection, props, []);

    return Promise.all(promises);
}

// Utility function to send a JSON response
var respondJson = function(res, obj) {
    res.setHeader('Content-Type', 'application/json');

    if (obj.$httpStatus) {
        res.statusCode = obj.$httpStatus;
    }

    if (obj.$etag) {
        res.setHeader('etag', obj.$etag);
    }

    if (obj.$expires) {
        res.setHeader('cache-control', 'private, max-age=' + obj.$expires);
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

var cachedHtmlDocs = null;
var respondDocs = function(res) {
    if (null !== cachedHtmlDocs) {
        return cachedHtmlDocs
        .then(function(html) {
            res.end(html);
        });
    }

    cachedHtmlDocs = this.documentAll()
    .then(function(routes) {
        var jade = require('jade');
        var path = require('path');
        var docsPath = path.join(__dirname, 'views', 'docs.jade');

        return jade.renderFile(docsPath, {
            routes: routes
        });
    });

    cachedHtmlDocs.then(function(html) {
        res.end(html);
    });
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
        var request = new Request(req.url, this, connection);

        if (req.headers['if-none-match']) {
            request.setEtag(req.headers['if-none-match']);
        };

        var parsedUrl = request.getUrl();
        request.setMethod(req.method);

        request.setResourceId(path);

        if (req.body) {
            request.setResource(req.body);
        }

        this.handle(request, connection).then(function(result) {
            respondJson(res, result);
        }).catch(function(result) {
            respondJson(res, result);
        }.bind(this));
    }.bind(this);
};

Router.prototype.batch = function(req, res) {
    var connection = new Connection(this, req, res);

    return Promise.all(req.body.map(function(envelope) {
        var request = new Request(envelope.url, this, connection);
        var parsedUrl = request.getUrl();
        request.setMethod(envelope.method);
        request.setResourceId(parsedUrl.pathname);

        if (envelope.headers) {
            if (envelope.headers['if-none-match']) {
                request.setEtag(envelope.headers['if-none-match']);
            }
        }

        if (envelope.body) request.setResource(envelope.body);

        return this.handle(request, connection)
        .then(function(result) {
            var headers = {};

            if (result.$etag) headers.etag = result.$etag;
            if (result.$expires) headers['cache-control'] = 'private, max-age=' + result.$expires;

            return {
                status: result.$httpStatus || 200,
                headers: headers,
                body: result
            };
        })
        .catch(function(error) {
            return {
                headers: {},
                status: error.$httpStatus || 500,
                body: error
            };
        });
    }.bind(this)));
};
