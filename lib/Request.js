var libUrl = require('url');
var _ = require('lodash');
var SchemaFilter = require('./SchemaFilter');
var Resource = require('./Resource');
var jsen = require('jsen');
var Busboy = require('busboy');
var Promise = require('bluebird');
var HttpStatusCodes = require('./HttpStatusCodes');

module.exports = Request;

function Request(url) {
    this.setUrl(url);
    this._params = {};
    this._method = Request.METHOD_GET;
    this._stream = null;
    this._httpStatusCodes = new HttpStatusCodes();
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

// Upload validation errors
Request.ERROR_UPLOAD_TOO_LARGE              = 'ERROR_UPLOAD_TOO_LARGE';
Request.ERROR_UPLOAD_TOO_SMALL              = 'ERROR_UPLOAD_TOO_SMALL';
Request.ERROR_UPLOAD_MIME_TYPE              = 'ERROR_UPLOAD_MIME_TYPE';
Request.ERROR_UPLOAD_NOT_FOUND              = 'ERROR_UPLOAD_NOT_FOUND';
Request.ERROR_UNKNOWN = {
    code: 2000,
    error: 'UNKNOWN',
    message: 'Unknown error'
}

Request.ERROR_SCHEMA = {
    code: 2001,
    error: 'INVALID PROPERTIES',
    message: 'Propertie(s) do not validate with schema'
}

Request.ERROR_RESPONSE_INVALID = {
    code: 2002,
    error: 'ERROR RESPONSE INVALID',
    message: 'Error response does not validate with schema'
}

Request.ERROR_NO_HANDLER = {
    code: 2003,
    error: 'HANDLER NOT FOUND',
    message: 'No handlers available for resource'
}

Request.ERROR_PROPS_NOT_FOUND = {
    code: 2004,
    error: 'PROPS NOT FOUND',
    message: 'Some of the properties requested do not exist in schema.'
}

Request.ERROR_ALIAS_DID_NOT_RESOLVE = {
    code: 2006,
    error: 'ALIAS DID NOT RESOLVE',
    message: 'Alias did not resolve to a Request instance'
}

Request.ERROR_ALIAS_ITSELF = {
    code: 2007,
    error: 'ALIAS POINTING TO ITSELF',
    message: 'Alias pointed back to itself'
}

Request.prototype.setUrl = function(url) {
    this._url = libUrl.parse(url, true);

    this._props = (this._url.query.props || '').split(',').filter(function(value) {
        return value;
    });

    //Remove props for query parameters
    this.unsetQuery('props');

    this._etag = null;
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

Request.prototype.isGet = function() {
    return this._method === Request.METHOD_GET;
};

Request.prototype.isPost = function() {
    return this._method === Request.METHOD_POST;
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


Request.prototype.unsetQuery = function(query) {
    delete this._url.query[query];
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

Request.prototype.setEtag = function(etag) {
    this._etag = etag;
    return this;
};

Request.prototype.getEtag = function() {
    return this._etag;
};

/**
 * Generate a response with a specific HTTP status code and optional response body.
 * Responses that contain HTTP status codes will bypass schema validation.
 *
 * @param int code - HTTP status code
 * @param mixed body - Option response body
 */
Request.prototype.status = function(code, body) {
    body = body || {};
    body.$httpStatus = parseInt(code, 10);
    body.$httpMessage = this._httpStatusCodes.lookupByCode(body.$httpStatus );

    if (code >= 200 && code < 300) {
        return Promise.resolve(body);
    } else {
        return Promise.reject(body);
    }
}


Request.prototype.error = function(httpStatusCode, errorObject, propertyErrors) {
    if (!errorObject) {
        errorObject = {};
    }
    var error = new Error();
    Error.captureStackTrace(error, Request.prototype.error);
    error.code = errorObject.code || Request.ERROR_UNKNOWN.code;
    error.error = errorObject.error || Request.ERROR_UNKNOWN.error;
    error.message = errorObject.message || Request.ERROR_UNKNOWN.message;
    error.properties =  propertyErrors || [];
    return this.status(httpStatusCode, error);
};
