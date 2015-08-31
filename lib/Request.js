var libUrl = require('url');
var _ = require('lodash');
var Resource = require('./Resource');

module.exports = Request;

function Request(url) {
    this.setUrl(url);
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
}

Request.prototype.getResource = function() {
    return this._resource;
}
