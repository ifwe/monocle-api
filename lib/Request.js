var libUrl = require('url');
var _ = require('lodash');
var Resource = require('./Resource');

module.exports = Request;

function Request(url, router, connection) {
    this.setUrl(url);
    this._router = router;
    this._connection = connection;
    this._params = {};
    this._method = Request.METHOD_GET;
}

Request.METHOD_GET      = 'GET';
Request.METHOD_POST     = 'POST';
Request.METHOD_PUT      = 'PUT';
Request.METHOD_PATCH    = 'PATCH';
Request.METHOD_DELETE   = 'DELETE';
Request.METHOD_OPTIONS  = 'OPTIONS';

Request.ALL_METHODS = [
    Request.METHOD_GET,
    Request.METHOD_POST,
    Request.METHOD_PUT,
    Request.METHOD_PATCH,
    Request.METHOD_DELETE,
    Request.METHOD_OPTIONS
];

Request.prototype.setUrl = function(url) {
    this._url = libUrl.parse(url, true);

    this._props = (this._url.query.props || '').split(',').filter(function(value) {
        return value;
    });
};

Request.prototype.getUrl = function() {
    return this._url;
};

Request.prototype.getProps = function() {
    return this._props;
};

Request.prototype.setProps = function(props) {
    this._props = props;
    return this;
};

Request.prototype.setMethod = function(method) {
    if (!_.isString(method)) {
        throw new Error('Invalid method: ' + JSON.stringify(method));
    }

    var ucMethod = method.toUpperCase();

    if (-1 === Request.ALL_METHODS.indexOf(ucMethod)) {
        throw new Error('Invalid method: ' + JSON.stringify(method));
    }

    this._method = ucMethod;

    return this;
};

Request.prototype.getMethod = function() {
    return this._method;
};

Request.prototype.isOptions = function() {
    return this._method === Request.METHOD_OPTIONS;
};

Request.prototype.setParams = function(params) {
    this._params = params;
    return this;
};

Request.prototype.getParams = function() {
    return this._params;
};

Request.prototype.setParam = function(param, value) {
    this._params[param] = value;
    return this;
};

Request.prototype.getParam = function(param) {
    return this._params.hasOwnProperty(param) ? this._params[param] : undefined;
};

Request.prototype.setQueries = function(queries) {
    this._url.query = queries;
    return this;
};

Request.prototype.getQueries = function() {
    return this._url.query;
};

Request.prototype.setQuery = function(query, value) {
    this._url.query[query] = value;
    return this;
};

Request.prototype.getQuery = function(query) {
    return this._url.query.hasOwnProperty(query) ? this._url.query[query] : undefined;
};

Request.prototype.setResourceId = function(resourceId) {
    if (!_.isString(resourceId)) {
        throw new Error('Invalid resource id ' + JSON.stringify(resourceId));
    }
    this._resourceId = resourceId;
    return this;
};

Request.prototype.getResourceId = function() {
    return this._resourceId;
};

Request.prototype.setResource = function(resource) {
    this._resource = resource;
    return this;
};

Request.prototype.getResource = function() {
    return this._resource;
};

Request.prototype.error = function(httpStatusCode, message) {
    return this._router.error(httpStatusCode, message);
};

Request.prototype.propertyError = function(property, errorCode, httpStatusCode, message) {
    httpStatusCode = parseInt(httpStatusCode, 10) || 400;
    var httpErrorString = this._router._httpStatusCodes.lookupByCode(httpStatusCode);
    var properties = [];

    return this._connection.options(this._resourceId)
    .then(function(options) {
        if (options.schema.properties.hasOwnProperty(property)) {
            // Get details about the error code
            if (errorCode >= 1000) {
                var error = options.schema.properties[property].errorCodes.filter(function (item) {
                    return item.code == errorCode;
                })[0];
                properties.push({
                    property: property,
                    code: error.code,
                    error: error.error,
                    message: error.message
                });
            } else {
                properties.push({
                    property: property,
                    code: errorCode,
                    message: message
                });
            }
        }

        return this._router.status(httpStatusCode, {
            code: httpStatusCode,
            error: httpErrorString,
            message: message,
            properties: properties
        });
    }.bind(this));
};
