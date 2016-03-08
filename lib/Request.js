var libUrl = require('url');
var _ = require('lodash');
var SchemaFilter = require('./SchemaFilter');
var Resource = require('./Resource');
var validationErrors = require('./models/validationErrors');
var jsen = require('jsen');
var Busboy = require('busboy');
var Promise = require('bluebird');

module.exports = Request;

function Request(url, router, connection) {
    this.setUrl(url);
    this._router = router;
    this._connection = connection;
    this._params = {};
    this._method = Request.METHOD_GET;
    this._schema = null;
    this._stream = null;
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

Request.prototype.isCollection = function(schema) {
    return !!(
        'object' === schema.type &&
        schema.properties &&
        schema.properties.items &&
        'array' === schema.properties.items.type &&
        schema.properties.items.items
    );
}

Request.prototype.setSchema = function(schema) {
    this._schema = schema;
    return this;
};

Request.prototype.getSchema = function() {
    return this._schema;
};

Request.prototype.propertyError = function(property, errorCode, httpStatusCode, message) {
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

            if (this._method == Request.METHOD_POST && this.isCollection(options.schema)) {
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
                properties.push({
                    property: property,
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
Request.prototype.getStream = function() {
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
    var schema = this.getSchema();
    if (!schema) return;

    var stream = this.getStream();
    var isMimeTypeValid = null;

    stream.on('file', function(fieldName, file, fileName, encoding, mimeType) {
        var maxSize = schema.properties[fieldName].maxSize;
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
Request.prototype.getUpload = function(field) {
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
Request.prototype.getAllUploads = function(field) {
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
