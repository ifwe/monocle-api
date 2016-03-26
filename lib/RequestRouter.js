var libUrl = require('url');
var _ = require('lodash');
var SchemaFilter = require('./SchemaFilter');
var Resource = require('./Resource');
var validationErrors = require('./models/validationErrors');
var jsen = require('jsen');
var Busboy = require('busboy');
var Promise = require('bluebird');
var HttpStatusCodes = require('./HttpStatusCodes');
var Request = require('./Request');
module.exports = RequestRouter;

function RequestRouter(request, route, connection) {
    this._request = request;
    this._schema = route.schema;
    this._propertyErrors = [];
    this._connection = connection;
    this._stream = null;

    var queries = request.getQueries();
    var params = request.getParams();
    var resource = request.getResource();

    //Set the default queries in routes if not already specified in request
    if (request.isGet()) {
        //Set the default queries first
        for (var key in route.query) {
            //if getQuery is not undefined then setQuery
            if (request.getQuery(key)) {
                continue;
            }

            value = route.query[key];

            //If there's no default values and the param has not been set then don't set it
            if (value !== '') {
                queries[key] = value;
            }
        }

        //Remove queries that are not set in the route
        for (var key in queries) {
            if (!route.query.hasOwnProperty(key)) {
                delete queries[key];
            }
        }
    }

    // Update parameters with parameters in the route url such as /test/:fooId/foo. Parameters in this case is fooId
    for (var i = 0, len = route.keys.length; i < len; i++) {
        var paramName = route.keys[i].name;
        var match = this.getResourceId().match(route.regex);
        var paramValue = match[i + 1];

        if (typeof paramValue == 'undefined') {
            paramValue = null;
        }

        params[paramName] = paramValue;
        queries[paramName] = paramValue;
    }

    var method = this.getMethod();

    if (!!~[Request.METHOD_PATCH, Request.METHOD_POST, Request.METHOD_PUT, Request.METHOD_DELETE].indexOf(method) && resource) {
        var validate;

        // Using duck-typing to see if the schema represents a collection
        var isCollection = this.isCollection();

        if (method === Request.METHOD_POST && isCollection) {
            validate = jsen(_.extend({additionalProperties: false}, route.schema.properties.items.items));
        } else {
            validate = jsen(_.extend({additionalProperties: false}, route.schema));
        }

        //Remove props from resource
        remove$Props.call(resource);
        this.setResource(resource);
    }

    this.setParams(params);

    if (request.isGet()) {
        this.setQueries(queries);
    }
}

// Upload validation errors
RequestRouter.ERROR_UPLOAD_TOO_LARGE              = 'ERROR_UPLOAD_TOO_LARGE';
RequestRouter.ERROR_UPLOAD_TOO_SMALL              = 'ERROR_UPLOAD_TOO_SMALL';
RequestRouter.ERROR_UPLOAD_MIME_TYPE              = 'ERROR_UPLOAD_MIME_TYPE';
RequestRouter.ERROR_UPLOAD_NOT_FOUND              = 'ERROR_UPLOAD_NOT_FOUND';

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

RequestRouter.prototype.setUrl = function(url) {
    this._request.setUrl(url);
};

RequestRouter.prototype.hasPropertyErrors = function() {
    return this._propertyErrors.length > 0
};

RequestRouter.prototype.getUrl = function() {
    return this._request.getUrl();
};

RequestRouter.prototype.getProps = function() {
    return this._request.getProps();
};

RequestRouter.prototype.setProps = function(props) {
    this._request.setProps(props);
    return this;
};

RequestRouter.prototype.setMethod = function(method) {
    this._request.setMethod(method);
    return this;
};

RequestRouter.prototype.getMethod = function() {
    return this._request.getMethod();
};

RequestRouter.prototype.isOptions = function() {
    return this._request.isOptions();
};

RequestRouter.prototype.isGet = function() {
    return this._request.isGet();
};

RequestRouter.prototype.isPost = function() {
    return this._request.isPost();
};

RequestRouter.prototype.setParams = function(params) {
    this._request.setParams(params);

    //Validate params
    var params = validateAndCast.call(this, params);
    if (params) {
        this._request.setParams(params);
    }
    return this;
};

RequestRouter.prototype.getParams = function() {
    return this._request.getParams();
};

RequestRouter.prototype.setParam = function(key, value) {
    this._request.setParam(key, value);
    var returnParam = validateAndCast.call(this, {key : value});

    if (returnParam && returnParam.hasOwnProperty(key)) {
        this._request.setParam(key, returnParam[key]);
    }

    return this;
};

RequestRouter.prototype.getParam = function(param) {
    return this._request.getParam(param);
};

RequestRouter.prototype.setQueries = function(queries) {
    this._request.setQueries(queries);
    //Validate queries
    var queries = validateAndCast.call(this, queries);
    if (queries) {
        this._request.setQueries(queries);
    }
    return this;
};

RequestRouter.prototype.getQueries = function() {
    return this._request.getQueries();
};

RequestRouter.prototype.setQuery = function(key, value) {
    this._request.setQuery(key, value);
    var returnQuery = validateAndCast.call(this, {key : value});

    if (returnQuery && returnQuery.hasOwnProperty(key)) {
        this._request.setQuery(key, returnQuery[key]);
    }
    return this;
};

RequestRouter.prototype.unsetQuery = function(query) {
    this._request.unsetQuery(query);
    return this;
};

RequestRouter.prototype.getQuery = function(query) {
    return this._request.getQuery(query);
};

function cleanParamKey(key) {
    key = key.toString();
    if (key.substr(-2) == '[]' || key.substr(-2) == '{}') {
        return key.slice(0, key.length - 2);
    }

    return key;
}

function castParam(key, value, type) {
    var hasTypeError = true;
    if (type.indexOf('boolean') !== -1) {
        switch(value) {
            case 'true' :
            case true :
                return true;
            case 'false':
            case false:
                return false;
            default:
                hasTypeError = true;
        }
    }

    if (type.indexOf('integer') !== - 1) {
        if (value.toString().match(/^[0-9]+$/)) {
           return parseInt(value);
        }

        hasTypeError = true;
    }

    if (type.indexOf('float') !== - 1) {
        if (value.toString().match(/^[0-9\.]+$/)) {
           return parseFloat(value);
        }

        hasTypeError = true;
    }

    if (type.indexOf('string') !== -1) {
        //Cast non objects to string
        if (typeof value !== 'object') {
            return value.toString();
        }
        return value;
    }

    if (hasTypeError) {
        return {errorCode: getErrorCode()};
    }

    return value;
}

function validateAndCastParam(key, value, schemaProperty) {
    //If null are allowed and the value is null than don't transform the value
    if (value == null && schemaProperty.type.indexOf('null') !== -1) {
        return null;
    }

    value = castParam.call(this, key, value, schemaProperty.type);

    if (schemaProperty.enum && schemaProperty.enum.indexOf(value) === -1) {
        return {errorCode: getErrorCode('enum')};
    }

    return value;
}

/**
 * Validates the query  or passed in params with the provided schema.
 * Query parameters that are not included in the schema are added to the propertyError array.
 * Query parameters that are defined as type "integer", "number", "boolean" and "string" are converted accordingly.
 */
function validateAndCastObject(object, schema, parentKey) {
    if (!Object.getOwnPropertyNames(object).length) {
        return;
    }

    if (!parentKey) {
        parentKey = '';
    }

    for (var key in object) {
        if (!object.hasOwnProperty(key) || key[0].indexOf('$') !== -1) {
            continue;
        }

        var value = object[key];

        if (this.isGet()) {
            var isArray = key.toString().substr(-2) == '[]';
            var isObject = key.toString().substr(-2) == '{}';

            //If what's passed in as an array or an object
            if (isArray || isObject) {
                this.unsetQuery(key);
                //Remove the [] or {} from the key
                key = cleanParamKey(key);
                //Remove the [] or {} from the key so the errors would have the key without the []/{}
                object[key] = value;
            }
        } else {
            var isArray = Array.isArray(value);
            var isObject = typeof value == 'object';
        }

        var filter = new SchemaFilter(schema);
        var schemaProperty = filter.property(key);

        // Skip properties that are not in the schema
        if (!schemaProperty) {
            this.addPropertyError(parentKey + key, getErrorCode('notInSchema'));
            continue;
        }

        if (isArray) {
            if (schemaProperty.type.indexOf('array') == -1) {
                this.addPropertyError(parentKey + key, getErrorCode());
                continue;
            }

            //Check first if value is an array before trying to parse it
            if (!Array.isArray(value)) {
                try {
                    value = JSON.parse(value);
                } catch (error) {
                    this.addPropertyError(parentKey + key, getErrorCode());
                    continue;
                }
            }

            if (!Array.isArray(value)) {
                this.addPropertyError(parentKey + key, getErrorCode());
                continue;
            }

            if (!value.length) {
                continue;
            }

            //Iterate through array elements
            for (var arrayKey in value) {
                arrayValue = validateAndCastParam.call(this, key, value[arrayKey], schemaProperty.items);
                if (arrayValue && arrayValue.errorCode) {
                    this.addPropertyError(parentKey + key, arrayValue.errorCode);
                } else {
                   value[arrayKey] = arrayValue;
                }
            }

            object[key] = value;
            continue;
        }

        if (isObject) {
            if (schemaProperty.type.indexOf('object') == -1) {
                this.addPropertyError(parentKey + key, getErrorCode());
                continue;
            }

            //Check first if value is an object before trying to parse it
            if (typeof value !== 'object') {
                try {
                    value = JSON.parse(value);
                } catch (error) {
                    this.addPropertyError(parentKey + key, getErrorCode());
                    continue;
                }
            }

            if (typeof value !== 'object') {
                this.addPropertyError(parentKey + key, getErrorCode());
                continue;
            }

            if (!Object.getOwnPropertyNames(value).length) {
                continue;
            }

            object[key] = validateAndCastObject.call(this, value, schemaProperty, key+'.');
            continue;
        }

        value = validateAndCastParam.call(this, key, value, schemaProperty);

        if (value && value.errorCode) {
            this.addPropertyError(parentKey + key, value.errorCode);
        } else {
           object[key] = value;
        }
    }

    return object;
}

function validateAndCast(object, schema) {
    if (!object || !Object.getOwnPropertyNames(object).length) {
        return object;
    }

    if (!schema) {
        schema = this._schema;
    }

    var object = validateAndCastObject.call(this, object, schema);

    // Validate object with schema
    var validate = jsen(schema);
    var valid = validate(object);

    if (!valid) {
        for (var errorKey in validate.errors) {
            var error = validate.errors[errorKey];

            this.addPropertyError(error.path, getErrorCode(error.keyword));
        }

        return;
    }
    return object;
}

function getErrorCode(type) {
    if (!type) {
        type = 'type';
    }

    code = validationErrors[type].code;

    return code;
}

RequestRouter.prototype.status = function(code, body) {
    return this._request.status(code, body)
}

RequestRouter.prototype.setResourceId = function(resourceId) {
    this._request.setResourceId(resourceId);
    return this;
};

RequestRouter.prototype.getResourceId = function() {
    return this._request.getResourceId();
};

RequestRouter.prototype.setResource = function(resource) {
    this._request.setResource(resource);

    var schema = this._schema;

    if (this._request.getMethod() === Request.METHOD_POST && this.isCollection()) {
        schema = this._schema.properties.items.items;
    }

    var returnObject = validateAndCast.call(this, resource, schema);

    if (returnObject) {
        this._request.setResource(returnObject);
    }

    return this;
};

RequestRouter.prototype.getResource = function() {
    return this._request.getResource();
};

RequestRouter.prototype.setEtag = function(etag) {
    this._request.setEtag(etag);
    return this;
};

RequestRouter.prototype.getEtag = function() {
    return this._request.getEtag();
};

RequestRouter.prototype.error = function(httpStatusCode, message) {
    return this._request.error(httpStatusCode, message, this._propertyErrors);
};

RequestRouter.prototype.isCollection = function() {
    return !!(
        'object' === this._schema.type &&
        this._schema.properties &&
        this._schema.properties.items &&
        'array' === this._schema.properties.items.type &&
        this._schema.properties.items.items
    );
}

RequestRouter.prototype.getSchema = function() {
    return this._schema;
};

//TODO: Put this into it's own object
RequestRouter.prototype.addPropertyError = function(property, errorCode) {
    //Check if propertyErrors object already has that error
    for(var propertyKey in this._propertyErrors) {
        var propertyError = this._propertyErrors[propertyKey];
        if (propertyError.code == errorCode && propertyError.property == property) {
            return;
        }

    }
    var filter = new SchemaFilter(this._schema);
    var schemaProperty = filter.property(property);

    // Get details about the error code
    var errors;
    if (errorCode >= 1000 && schemaProperty) {
        errors = schemaProperty.errorCodes.filter(function (item) {
            return item.code == errorCode;
        });
    } else {
        if (!schemaProperty) {
            errorCode = getErrorCode('notInSchema');
        }
        errors = _.filter(validationErrors, function (item) {
            return item.code == errorCode;
        });
    }

    if (this._request.getMethod() == Request.METHOD_POST && this.isCollection()) {
        //remove the appended items@ if posting to a collection
        var path = property.split('.');
        var key = path.shift();
        if (-1 !== key.indexOf('@')) {
            var parts = property.split('@');
            parts.shift();

            var subkeys = parts.join('@');
            property = subkeys;
         }
    }

    if (errors.length > 0) {
        var error = errors[0];
        this._propertyErrors.push({
            property: property,
            code: error.code,
            error: error.error,
            message: error.message
        });
    }
}

//This is a shortcut to add a property error and return the error object
//at the same time
RequestRouter.prototype.propertyError = function(property, errorCode, httpStatusCode, message) {
    this.addPropertyError(property, errorCode);
    return this.error(httpStatusCode, message);
};

/**
 * Lazy loads and returns a streamable interface powered by Busboy.
 * The streamable interface allows route callbacks to stream uploaded data
 * and write it to the disk or network as it's being uploaded.
 *
 * The stream emits the `file` event, which provides a file stream to the callback function.
 * See `Request.prototype.getUpload` for an example of how to process uploads.
 *
 * @throws      if the request does not have the `Content-Type: multipart/form-data` header,
 *              or if the boundary is missing.
 * @return      Busboy - @see https://github.com/mscdex/busboy
 */
RequestRouter.prototype.getStream = function() {
    if (null === this._stream) {
        this._stream = new Busboy({
            headers: this._connection.raw.req.headers
        });
        this._connection.raw.req.pipe(this._stream);

        validateUploads.call(this);
    }
    return this._stream;
};

function validateUploads() {
    var schema = this._schema;
    if (!schema) return;

    var stream = this.getStream();
    var isMimeTypeValid = null;

    stream.on('file', function(fieldName, file, fileName, encoding, mimeType) {
        var schemaFilter = new SchemaFilter(schema);
        var property = schemaFilter.property(fieldName);

        var maxSize = property.maxSize;
        var size = 0;

        var validate = function(data) {
            // Validate the meme type as soon as first data comes,
            // otherwise we risk emitting this event too early
            if (null === isMimeTypeValid) {
                isMimeTypeValid = validateMimeType(mimeType, schema.properties[fieldName].mimeTypes);

                if (!isMimeTypeValid) {
                    file.emit(
                        'invalid',
                        'Uploaded data for field name ' + fieldName + ' has invalid mime type ' + mimeType + '.',
                        Request.ERROR_UPLOAD_MIME_TYPE
                    );

                    // No need to continue validating, we already know the mime type is bad.
                    file.removeListener('data', validate);
                    return;
                }
            }

            size += data.length;

            if (size > maxSize) {
                file.emit(
                    'invalid',
                    'Uploaded data for field name ' + fieldName + ' is larger than allowed maximum size of ' + maxSize + ' bytes.',
                    Request.ERROR_UPLOAD_TOO_LARGE
                );

                // Stop checking the size for this file
                file.removeListener('data', validate);
            }
        };

        file.on('data', validate);
    });
}

function validateMimeType(mimeType, allowedMimeTypes) {
    if (!allowedMimeTypes || !allowedMimeTypes.length) {
        // No requirements, allow anything
        return true;
    }

    if (!mimeType) {
        mimeType = '';
    }

    for (var i = 0, len = allowedMimeTypes.length; i < len; i++) {
        var regex = allowedMimeTypes[i];
        regex = regex.replace('*', '::MATCHANY::');
        regex = escapeRegExp(regex);
        regex = regex.replace('::MATCHANY::', '[^/]+');
        regex = new RegExp('^' + regex + '$', 'i');

        if (null !== mimeType.match(regex)) {
            return true;
        }
    }

    // Assume false if we didn't pass any of the mime types above
    return false;
}

// Borrowed from http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

/**
 * Returns a promise that resolves with the first upload that matches the provided field name.
 * Rejects promise if no uploads were found matching the field name.
 *
 * @return Promise
 */
RequestRouter.prototype.getUpload = function(field) {
    return new Promise(function(resolve, reject) {
        var stream = this.getStream();
        var found = false;
        var invalid = false;

        var onFile = function(uploadedFieldName, file, fileName, encoding, mimeType) {
            if (field != uploadedFieldName) {
                // Got an upload, but not for the field name we are looking for.
                // Skip this upload, maybe the next one will be under the desired field name.
                return;
            }

            found = true;

            // Stop listening for file events; we have the file we want.
            stream.removeListener('file', onFile);

            // Aggregrate the data as it is streamed in
            var chunks = [];

            file.on('data', function(data) {
                chunks.push(data)
            });

            file.on('invalid', function(errorMessage, errorReason) {
                invalid = true;
                reject(generateError(errorMessage, errorReason));
            });

            file.on('end', function() {
                if (!invalid) {
                    var upload = uploadContainer(uploadedFieldName, Buffer.concat(chunks), fileName, encoding, mimeType);
                    resolve(upload);
                }
            });
        };

        stream.on('file', onFile);

        stream.on('finish', function() {
            if (!found && !invalid) {
                reject(generateError('Did not find upload under field name ' + field + '.', Request.ERROR_UPLOAD_NOT_FOUND));
            }
        });
    }.bind(this));
};

generateError = function(message, reason) {
    var error = new Error(message);
    error.reason = reason;
    return error;
}

/**
 * Returns a promise that resolves with an array of all uploads that match the provided field name,
 * or all uploads if no field name is provided.
 * Reject promise if no uploads were found matching field name, or no uploads at all when no field name is provided.
 *
 * @return Promise
 */
RequestRouter.prototype.getAllUploads = function(field) {
    return new Promise(function(resolve, reject) {
        var stream = this.getStream();
        var found = [];
        var invalid = false;

        var onFile = function(uploadedFieldName, file, fileName, encoding, mimeType) {
            if (field && field != uploadedFieldName) {
                // Got an upload, but not under the field name we are looking for.
                // Skip this upload, maybe the next one will be under the desired field name.
                return;
            }

            // Aggregate the data as it is streamed in
            var chunks = [];

            file.on('data', function(data) {
                chunks.push(data);
            });

            file.on('invalid', function(errorMessage, errorReason) {
                invalid = true;
                reject(generateError(errorMessage, errorReason));
            });

            file.on('end', function() {
                var upload = uploadContainer(uploadedFieldName, Buffer.concat(chunks), fileName, encoding, mimeType);
                found.push(upload);
            });
        };

        stream.on('file', onFile);

        stream.on('finish', function() {
            if (invalid) {
                // Promise is already rejected, nothing to do
                return;
            }

            if (found.length) {
                return resolve(found);
            } else {
                var message = field ?
                    'Did not find any uploads under field name ' + field + '.' :
                    'Did not find any uploads.';
                return reject(generateError(message, Request.ERROR_UPLOAD_NOT_FOUND));
            }
        });
    }.bind(this));
};

/**
 * A simple wrapper for uploaded files.
 *
 * @param string fieldName - The name of the field this file was uploaded under
 * @param Buffer buffer - A node Buffer containing the uploaded data
 * @param string fileName - The original file name of the uploaded file (e.g. "me.png")
 * @param string encoding - The encoding of the file (e.g. "7-bit")
 * @param string mimeType - The mime type of the file (e.g. "image/png")
 * @return object
 */
function uploadContainer(fieldName, buffer, fileName, encoding, mimeType) {
    return {
        buffer: buffer,
        fieldName: fieldName,
        encoding: encoding,
        mimeType: mimeType,
        fileName: fileName,
        size: buffer.length
    };
}
