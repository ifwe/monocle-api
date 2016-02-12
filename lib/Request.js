var libUrl = require('url');
var _ = require('lodash');
var SchemaFilter = require('./SchemaFilter');
var Resource = require('./Resource');
var validationErrors = require('./models/validationErrors');
var jsen = require('jsen');

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

/**
 * Validates the query with the provided schema.
 * Query parameters that are not included in the schema are ignored.
 * Query parameters that are defined as type "integer" or "number" are converted accordingly.
 * Returns a validation object with two properties:
 *   - boolean valid -- true if the query parameters are valid
 *   - array errors -- array of properties that are in error, if any
 *
 * @param object schema - a schema in json-schema format.
 * @return object - validation result
 */
Request.prototype.validateQuery = function(schema, defaults) {
    // Nothing to validate if the schema is not an object (rare)
    if (!schema.properties) {
        // Clear out existing query params -- they must be in the schema to access them.
        this.setQueries({});
        return {
            valid: true,
            errors: []
        };
    }

    // Build new query object based on defaults
    var query = _.assign({}, defaults);

    // Validate query with schema
    var validate = jsen(schema);

    for (var key in query) {
        // Skip prototype properties, if any
        if (!query.hasOwnProperty(key)) continue;

        // Skip properties that are not in the schema
        if (!schema.properties.hasOwnProperty(key)) continue;

        if (defaults[key] === '') {
            // Empty string in defaults means no default, i.e. undefined
            query[key] = undefined;
        }

        var value = this.getQuery(key);
        if (typeof value === 'undefined' || value === '') {
            continue;
        }

        // We have to do isNaN checks here because NaN can cause
        // false validation success, because:
        //
        // 1) (typeof NaN === 'number') evaluates to `true` and
        // 2) (NaN < 1) evaluates to `false`
        switch (schema.properties[key].type) {
            case 'integer':
                value = parseInt(value);
                if (isNaN(value)) return typeError(key);
                break;

            case 'number':
                value = parseFloat(value);
                if (isNaN(value)) return typeError(key);
                break;
        }

        query[key] = value;
    }

    var valid = validate(query);
    this.setQueries(query);

    if (true === valid) {
        return {
            valid: true,
            errors: []
        };
    } else {
        return {
            valid: false,
            errors: validate.errors
        };
    }
};

function typeError(key) {
    return {
        valid: false,
        errors: [
            {
                path: key,
                keyword: 'type'
            }
        ]
    };
}

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

Request.prototype.error = function(httpStatusCode, message) {
    return this._router.error(httpStatusCode, message);
};

Request.prototype.propertyError = function(property, errorCode, httpStatusCode, message, returnProperty) {
    httpStatusCode = parseInt(httpStatusCode, 10) || 400;
    var httpErrorString = this._router._httpStatusCodes.lookupByCode(httpStatusCode);
    var properties = [];

    return this._connection.options(this._resourceId)
    .then(function(options) {
        var filter = new SchemaFilter(options.schema);
        var schemaProperty = filter.property(property);

        if (schemaProperty) {
            // Get details about the error code
            var errors;
            if (errorCode >= 1000) {
                errors = schemaProperty.errorCodes.filter(function (item) {
                    return item.code == errorCode;
                });
            } else {
                errors = _.filter(validationErrors, function (item) {
                    return item.code == errorCode;
                });
            }

            if (errors.length > 0) {
                var error = errors[0];
                properties.push({
                    property: returnProperty ? returnProperty : property,
                    code: error.code,
                    error: error.error,
                    message: error.message
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
