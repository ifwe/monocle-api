var Promise = require('bluebird');
var _ = require('lodash');
var pathToRegexp = require('path-to-regexp');

module.exports = ApiRouter;

var supportedMethods = ['get', 'post', 'put', 'delete', 'patch', 'options'];

function ApiRouter() {
    this._handlers = {};
    supportedMethods.forEach(function(method) {
        this._handlers[method] = [];
    }.bind(this));
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

    ApiRouter.prototype[handler] = function(resource, options) {
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
                    args: [params],
                    callback: route.callback
                });
            }
        });

        var unfound = options.props.filter(function(prop) {
            return -1 === found.indexOf(prop);
        });

        if (unfound.length || !handlers.length) {
            return Promise.reject("Unable to resolve props " + unfound.join(', ') + " for resource " + resource);
        }

        var callbacks = handlers.map(function(handler) {
            return handler.callback.apply(this, handler.args);
        });

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

            return result;
        });
    };


    ApiRouter.prototype.getSchema = function(resource) {
        var schema = {};
        this._handlers.get.forEach(function(route) {
            if (!route.regex.test(resource)) {
                return;
            }

            schema = _.extend(schema, route.options.props);
        });

        return schema;
    };
});
