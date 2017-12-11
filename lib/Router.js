var Promise = require('bluebird');
var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;
var jsen = require('jsen');
var Request = require('./Request');
var RequestRouter = require('./RequestRouter');
var Connection = require('./Connection');
var Symlink = require('./Symlink');
var PropertyFilter = require('./PropertyFilter');
var util = require('util');
var errorSchema = require('./schemas/error');
var CollectionCache = require('./CollectionCache');
var merge = require('./util/merge');
var debug = require('debug')('monocle-api:router');
var MonocleProps = require('monocle-api-props');
var Route = require('./Route');

module.exports = Router;

/**
 * @class Router
 * @extends EventEmitter
 */
function Router(openApiDocs) {
    this._routes = [];
    this._postRoutes = [];
    this._routeObjects = [];
    this.openApiDocs = openApiDocs;
}

// Extend EventEmitter
util.inherits(Router, EventEmitter);

/**
 * Registers a route for the API.
 *
 * @param {string|array} patternConfig - URL pattern for matching requests, or an array with pattern and query string config
 * @param {object} schema - JSON Schema
 * @param {object} handlers - Callback functions to support the various HTTP verbs
 */
Router.prototype.route = function (patternConfig, schema, handlers, apiDocs) {
    var newRoute = Route.createRoute(patternConfig, schema, handlers, apiDocs);
    this._routes.push(newRoute.getLegacyRouteObject());
    this._routeObjects.push(newRoute);

    return this;
};

Router.prototype.postRoute = function (callback) {
    this._postRoutes.push(callback);
    return this;
};

Router.prototype.alias = function (patternConfig, aliasResolver) {
    var newRoute = Route.createAlias(patternConfig, aliasResolver);

    this._routes.push(newRoute.getLegacyRouteObject());
    this._routeObjects.push(newRoute);

    return this;
};

Router.prototype.getRoutes = function () {
    return this._routeObjects;
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

        var routeObject = this._routeObjects[i];

        return {
            match: match,
            route: route,
            routeObject: routeObject
        };
    }
}

Router.prototype.getOpenApiDocumentation = function () {
    return Promise.map(this._routeObjects, (route) => route.getOpenApiDocumentation())
      .then((routes) => {
          return routes.reduce(function (acc, route) {
              return _.merge(acc, route)
          })
      })
      .then(function (pathData) {
          return _.merge({
              "paths": pathData
          }, this.openApiDocs)
      }.bind(this))
};


Router.prototype.handle = function (request, connection) {
    var timeStart = process.hrtime();
    var route = null;

    var method = request.getMethod();
    var resourceId = request.getResourceId();

    // Loop through requests to find matching resource
    var matched = getMatchedRoute.call(this, resourceId);

    if (!matched) {
        emit.call(this, 'api:error', request, null, timeStart);
        return request.error(404, RequestRouter.ERROR_NO_HANDLER);
    }

    route = matched.route;
    var routeObject = matched.routeObject;

    if (routeObject.isAlias()) {
        var originalResourceId = request.getResourceId();

        // route is an alias, resolve the alias and handle the modified request
        var target = routeObject.resolveAlias(request, connection);

        return target.then(function (targetRequest) {
            if (!targetRequest || typeof targetRequest.getResourceId !== 'function') {
                debug('Alias did not resolve to a Request instance', originalResourceId, typeof targetRequest);
                return request.error(500, RequestRouter.ERROR_ALIAS_DID_NOT_RESOLVE);
            }

            if (targetRequest.getResourceId() === originalResourceId) {
                debug('Alias pointed back to itself', originalResourceId);
                return request.error(508, RequestRouter.ERROR_ALIAS_ITSELF);
            }

            debug('Resolving alias', targetRequest.getResourceId());
            return this.handle(targetRequest, connection);
        }.bind(this));
    }

    var requestRouter = new RequestRouter(request, route, connection);

    if (requestRouter.hasPropertyErrors()) {
        emit.call(this, 'api:error', requestRouter, null, timeStart);
        debug('property errors', requestRouter);
        return requestRouter.error(422, RequestRouter.ERROR_SCHEMA);
    }

    if (!routeObject.canHandleMethod(method)) {
        emit.call(this, 'api:error', requestRouter, null, timeStart);
        return requestRouter.error(404, RequestRouter.ERROR_NO_HANDLER);
    }

    var handlers = routeObject.resolveHandlers(requestRouter, method);

    if(handlers instanceof Promise) {
        return handlers;
    }

    if (!handlers.length) {
        emit.call(this, 'api:error', requestRouter, null, timeStart);
        return requestRouter.error(404, RequestRouter.ERROR_NO_HANDLER.message);
    }

    var callbacks = handlers.map(function (handler) {
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
        var hasProps = !!(props && props.length);
        var isUpdate = (-1 !== [Request.METHOD_PATCH, Request.METHOD_PUT].indexOf(method));

          if (hasProps && isUpdate) {
              debug('Converting to symlink to help resolve any missing requested props %O', request.getProps());
              return new Symlink(resourceId, result).resolve(connection, {
                  props: request.getProps(),
                  query: request.getQuery()
              });
          }

        return result;
    })
    .then(function(result) {
        var props = request.getProps();
        // Restrict by props before resolving embedded symlinks to delete symlinks that are not needed.
        result = restrictProps(result, props);

        // Support internal errors
        if (result.$internalError == 'missing') {
            emit.call(this, 'api:error', requestRouter, route, timeStart);
            result.unfound.forEach(function(prop) {
                requestRouter.addPropertyError(prop, 200);
            });

              return requestRouter.error(404, RequestRouter.ERROR_PROPS_NOT_FOUND);
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
          return resolveSymlinks(result, connection, props, request.getQueries()).then(function () {
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
      .catch(function (error) {
          // Validate error
          var validate = jsen(errorSchema);
          var valid = validate(error);

          if (!valid) {
              // Error response must validate with error schema
              return requestRouter.error(500, RequestRouter.ERROR_RESPONSE_INVALID);
          }

          // Forward error
          return Promise.reject(error);
      });
};

var applyPostRoutes = function (body) {
    var result = Promise.resolve(body);
    this._postRoutes.forEach(function (postRoute) {
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

var restrictProps = function (resource, props) {
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

var emit = function (event, request, route, timeStart, extraData) {
    var data = extraData || {};
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
var resolveSymlinks = function (results, connection, props, query) {
    var promises = [];
    props = props || [];
    var monocleProps = new MonocleProps(query);

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
                debug('paths:', paths);

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
                    }).filter(function (prop) {
                        return prop && prop[0] !== '$' && prop !== key;
                    });

                    var pathString = path.replace(/@$/, '');
                    var matchingProps = monocleProps.get(pathString);
                    var filteredQuery = matchingProps[0] || {};
                    if (Array.isArray(filteredQuery)) filteredQuery = filteredQuery[0];
                    debug('filteredQuery:', filteredQuery);
                    var promise = value.resolve(connection, {props: childProps, query: filteredQuery})
                      .then(function (result) {
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
var respondJson = function (res, obj) {
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

var cachedDocs = null;
var respondDocs = function (res) {
    if (null !== cachedDocs) {
        return cachedDocs.then(function (docs) {
            respondJson(res, docs)
        });
    }

    cachedDocs = this.getOpenApiDocumentation();
    return cachedDocs.then(function (docs) {
        respondJson(res, docs);
    });
};

/**
 * Returns a function that can be used as connect middleware.
 *
 * The middleware will call next() if the request does not start with the configured base path.
 * Otherwise, the api router will kick and and try to handle the request.
 *
 * @param {Object} options - Custom options
 *      basePath (default: '/') - base path to mount your API to.
 * @return function
 */
Router.prototype.middleware = function (options) {
    var config = _.assign({
        basePath: '/'              // Allow APIs to be accessible from a configured base path
    }, options || {});

    // Determine how much of the path to trim based on the number of characters leading up to the trailing `/`
    var basePathLength = (config.basePath || '').replace(/\/$/, '').length;

    return function (req, res, next) {
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
              .then(function (results) {
                  respondJson(res, results);
              });
            return;
        }

        var connection = new Connection(this, req, res);
        var request = new Request(req.url, this, connection);

        if (req.headers['if-none-match']) {
            request.setEtag(req.headers['if-none-match']);
        }

        request.setMethod(req.method);

        request.setResourceId(path);

        if (req.body) {
            request.setResource(req.body);
        }

        this.handle(request, connection).then(function (result) {
            respondJson(res, result);
        }).catch(function (result) {
            respondJson(res, result);
        }.bind(this));
    }.bind(this);
};

Router.prototype.batch = function (req, res) {
    var connection = new Connection(this, req, res);

    var requestEnvelopes = [];
    if (Array.isArray(req.body)) {
        requestEnvelopes = req.body;
    } else {
        requestEnvelopes = Object.keys(req.body).map(function (key) {
            return req.body[key];
        });
    }

    return Promise.all(requestEnvelopes.map(function (envelope) {
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
          .then(function (result) {
              var headers = {};

              if (result.$etag) headers.etag = result.$etag;
              if (result.$expires) headers['cache-control'] = 'private, max-age=' + result.$expires;

              return {
                  status: result.$httpStatus || 200,
                  headers: headers,
                  body: result
              };
          })
          .catch(function (error) {
              return {
                  headers: {},
                  status: error.$httpStatus || 500,
                  body: error
              };
          });
    }.bind(this)))
      .then(function (responseEnvelopes) {
          if (!Array.isArray(req.body)) {
              var mappedResponseEnvelopes = {
                  $type: 'batch',
                  $httpStatus: 200
              };
              Object.keys(req.body).forEach(function (key, index) {
                  mappedResponseEnvelopes[key] = responseEnvelopes[index];
              });
              return mappedResponseEnvelopes;
          }
          return responseEnvelopes;
      });
};
