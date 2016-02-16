var Promise = require('bluebird');
var _ = require('lodash');
var pathToRegexp = require('path-to-regexp');
var EventEmitter = require('events').EventEmitter;
var jsen = require('jsen');
var validateSchema = jsen({"$ref": "http://json-schema.org/draft-04/schema#"});
var Request = require('./Request');
var Connection = require('./Connection');
var Symlink = require('./Symlink');
var PropertyFilter = require('./PropertyFilter');
var util = require('util');
var HttpStatusCodes = require('./HttpStatusCodes');
var errorSchema = require('./schemas/error');
var validationErrors = require('./models/validationErrors');
var Resource = require('./Resource');
var OffsetPaginator = require('./OffsetPaginator');
var CollectionCache = require('./CollectionCache');
var querystring = require('querystring');

module.exports = Router;

function Router() {
    this._routes = [];
    this._httpStatusCodes = new HttpStatusCodes();
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

    // Ensure numbers are converted to int/float for query defaults
    for (var queryParam in query) {
        // Skip prototype properties, if any
        if (!query.hasOwnProperty(queryParam)) continue;

        if (!schema.properties) {
            throw new Error("Query parameters requires an object schema with properties.");
        }

        if (!schema.properties.hasOwnProperty(queryParam)) {
            throw new Error("Unexpected query param " + queryParam + " not found in schema.");
        }

        if ('' === query[queryParam]) {
            // No default
            continue;
        }

        switch (schema.properties[queryParam].type) {
            case 'integer':
                query[queryParam] = parseInt(query[queryParam]);
                break;

            case 'number':
                query[queryParam] = parseFloat(query[queryParam]);
                break;
        }

        if (isNaN(query[queryParam])) {
            throw new Error("Query param " + queryParam + " contains invalid default value.");
        }
    }

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

var sortByTitle = function(docs) {
    return docs.sort(titleCompare);
};

var titleCompare = function(a, b) {
    return (a.schema.title || a.pattern) > (b.schema.title || b.pattern);
};

Router.prototype.error = function(httpStatusCode, message) {
    var error = this._httpStatusCodes.lookupByCode(httpStatusCode);

    return this.status(httpStatusCode, {
        code: parseInt(httpStatusCode, 10),
        error: error,
        message: message || 'Unknown error',
        properties: []
    });
};

Router.prototype.propertyError = function(property, errorCode, httpStatusCode) {
    httpStatusCode = parseInt(httpStatusCode, 10) || 400;
    var httpErrorString = this._httpStatusCodes.lookupByCode(httpStatusCode);
    var properties = [];

    return this.status(httpStatusCode, {
        code: httpStatusCode,
        error: httpErrorString,
        message: 'Unknown error',
        properties: properties
    });
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
        query: route.query,
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
    if (code >= 200 && code < 300) {
        return Promise.resolve(body);
    } else {
        return Promise.reject(body);
    }
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
        return request.error(404, "No handlers registered for resource " + resourceId);
    }

    var match = matched.match;
    route = matched.route;

    // Support OPTIONS
    if (request.isOptions()) {
        return Promise.resolve(documentRoute(route));
    }

    // Validate query parameters for GET requests
    if (request.isGet()) {
        var validation = request.validateQuery(route.schema, route.query);

        if (!validation.valid) {
            emit.call(this, 'api:error', request, null, timeStart);

            // Get the first error and make sure to get the base property name (e.g. if an array of values is needs
            // to validate to an enum and the second one doesn't validate successfully, it returns propertyName.1 -
            // this will shorten it just to propertyName.
            var error = validation.errors[0];
            var propertyName = '';

            if (error.path) {
                propertyName = error.path.split('.')[0];
            }

            var code = validationErrors.default.code;
            var message = validationErrors.default.message;

            if (error.keyword && validationErrors[error.keyword]) {
                code = validationErrors[error.keyword].code;
                message = validationErrors[error.keyword].message;
            }

            return request.propertyError(propertyName, code, 422, message);
        }
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
        request.setQuery(paramName, paramValue);
    }

    if (!route.handlers.hasOwnProperty(method)) {
        emit.call(this, 'api:error', request, null, timeStart);
        return request.error(404, "No " + method + " handler for " + resourceId);
    }

    if (_.isFunction(route.handlers[method])) {
        handlers.push(route.handlers[method]);
    } else if (_.isArray(route.handlers[method])) {
        var props = request.getProps();

        if (props.length) {
            route.handlers[method].filter(function(handler) {
                var topLevelProps = props.map(function(prop) {
                    return prop.split(/[\.@]/)[0];
                });
                return _.intersection(topLevelProps, handler.props).length;
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
        return request.error(404, "No handlers available for resource " + resourceId);
    }

    if (!!~[Request.METHOD_PATCH, Request.METHOD_POST, Request.METHOD_PUT, Request.METHOD_DELETE].indexOf(method)) {
        var validate;

        // Using duck-typing to see if the schema represents a collection
        var isCollection = request.isCollection(route.schema);

        if (method === Request.METHOD_POST && isCollection) {
            validate = jsen(_.extend({additionalProperties: false}, route.schema.properties.items.items));
        } else {
            validate = jsen(_.extend({additionalProperties: false}, route.schema));
        }

        var resource = _.clone(request.getResource());
        if (resource) {
            remove$Props(resource);
            var valid = validate(resource);

            if (!valid) {
                emit.call(this, 'api:error', request, null, timeStart);

                // Get the first error and make sure to get the base property name (e.g. if an array of values is needs
                // to validate to an enum and the second one doesn't validate successfully, it returns propertyName.1 -
                // this will shorten it just to propertyName.
                var propertyName = '';
                if (validate.errors[0].path) {
                    propertyName = validate.errors[0].path.split('.')[0];
                }
                var code = validationErrors.default.code;
                var message = validationErrors.default.message;

                if (validate.errors[0].keyword && validationErrors[validate.errors[0].keyword]) {
                    code = validationErrors[validate.errors[0].keyword].code;
                    message = validationErrors[validate.errors[0].keyword].message;
                }

                return request.propertyError(propertyName, code, 422, message);
            }
        }
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
                    // Convert to an object if an instance
                    return (_.isObject(r)) ? _.merge({}, r) : r;
                });
            } else if (_.isObject(result)) {
                return _.merge({}, result);
            }

            return result;
        });

        // Merges results from different functions
        var result = _.merge.apply(null, results.concat([function Customizer(a, b) {
            if (a instanceof Resource || b instanceof Resource) {
                return _.merge(a, b);
            }
        }]));

        // Support internal errors
        if (result.$internalError == 'missing') {
            emit.call(this, 'api:error', request, route, timeStart);
            return Promise.reject("Unable to resolve props " + result.unfound.join(', ') + " for resource " + resourceId);
        }

        var props = request.getProps();

        // Restrict by props before resolving symlinks to delete symlinks that are not needed.
        result = restrictProps(result, props);

        // Validate etag for GET requests of arrays
        if (method === Request.METHOD_GET) {
            var etag = request.getEtag();
            var collectionCache = new CollectionCache(result, request);

            // Validate etag
            if (etag && collectionCache.isValid(etag)) {
                // Emit success event
                emit.call(this, 'api:success', request, route, timeStart);
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
                var collectionCache = new CollectionCache(result, request);
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
            emit.call(this, 'api:success', request, route, timeStart);

            return result;
        }.bind(this));
    }.bind(this))
    .catch(function(error) {
        // Validate error
        var validate = jsen(errorSchema);
        var valid = validate(error);

        if (!valid) {
            // Error response must validate with error schema
            return this.error(500, 'Error response did not validate with schema');
        }

        // Forward error
        return Promise.reject(error);
    });
};

var remove$Props = function(resource) {
    if (!resource || !_.isObject(resource)) {
        return;
    }

    _.each(_.keys(resource), function (key) {
        if (key.indexOf('$') == 0) {
            delete resource[key];
        } else {
            remove$Props(resource[key]);
        }
    });
};

var restrictProps = function(resource, props) {
    if (resource.hasOwnProperty('$httpStatus') && (resource.$httpStatus < 200 || resource.$httpStatus >= 300)) {
        return resource;
    }

    var filter = new PropertyFilter(resource);
    var filtered = filter.props(props);

    if (filtered.$error) {
        return {
            $internalError: 'missing',
            unfound: filtered.$missing
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

                if (_.has(value, '$link')) {
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

                    var promise = connection.get(value.$link, { props: childProps })
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
