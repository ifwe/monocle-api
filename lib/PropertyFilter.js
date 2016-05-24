var ERROR_PROPERTY_NOT_FOUND = 'property not found';

var PropertyFilter = function(data) {
    this._data = data;
};

var filterProp = function(data, property, filtered) {
    var filtered = filtered || {};

    // Ignore symlinks -- they can't be filtered yet.
    // Ignore data that is null
    if (data === null || data.hasOwnProperty('$link')) {
        return data;
    }

    // Always keep properties that begin with `$`
    for (var key in data) {
        if (data.hasOwnProperty(key) && key[0] == '$') {
            filtered[key] = data[key];
        }
    }
    // Directly assign top-level props or properties beginning with $
    if (property.indexOf('$') !== -1 || (-1 === property.indexOf('.') && -1 === property.indexOf('@'))) {
        if (!data.hasOwnProperty(property)) {
            return {$error: ERROR_PROPERTY_NOT_FOUND};
        }
        filtered[property] = data[property];
        return filtered;
    }

    var path = property.split('.');
    var key = path.shift();
    //If props requested is for an array of data
    if (0 == key.indexOf('@')) {
        // Attempting to pluck from an array
        var parts = property.split('@');
        parts.shift();

        var subkeys = parts.join('@');
        if (!filtered || !Array.isArray(filtered)) {
            filtered = [];
        }

        if (!Array.isArray(data)) {
            return {$error: ERROR_PROPERTY_NOT_FOUND};
        }

        //Check every item in the array
        for (var index in data) {
            filtered[index] = filterProp.call(this, data[index], subkeys, filtered[index]);
            //If there's addn error return error messgae
            if (filtered[index] && filtered[index].$error) {
                return {$error: ERROR_PROPERTY_NOT_FOUND};
            }
        };
    //If props requested is an array
    } else if (-1 !== key.indexOf('@')) {
        // Attempting to pluck from an array
        var parts = property.split('@');
        var parentKey = parts[0];

        parts.shift();

        var subkeys = parts.join('@');
        filtered[parentKey] = filtered[parentKey] || [];

        if (!data.hasOwnProperty(parentKey)) {
            return {$error: ERROR_PROPERTY_NOT_FOUND};
        }

        //Check every item in the array
        for (var index in data[parentKey]) {
            filtered[parentKey][index] = filterProp.call(this, data[parentKey][index], subkeys, filtered[parentKey][index]);

            //If there's an error return error messgae
            if (filtered[parentKey][index] && filtered[parentKey][index].$error) {
                return {$error: ERROR_PROPERTY_NOT_FOUND};
            }
        };
    //if props requested is an object
    } else {
        var parts = property.split('.');
        var parentKey = parts[0];

        parts.shift();
        var subkeys = parts.join('.');

        if (!data.hasOwnProperty(parentKey)) {
            return {$error: ERROR_PROPERTY_NOT_FOUND};
        }

        //Recursively find the nested property
        filtered[parentKey] = filterProp.call(this, data[parentKey], subkeys, filtered[parentKey]);

        //If there's an error return error messgae
        if (filtered[parentKey] && filtered[parentKey].$error) {
            return {$error: ERROR_PROPERTY_NOT_FOUND};
        }

    }
    return filtered;
}

PropertyFilter.prototype.props = function(properties) {
    var missing = [];
    var filtered = {};

    // Ignore symlinks -- they can't be filtered yet.
    if (!properties || !properties.length || this._data === null) {
        return this._data;
    }

    for (var propertyIndex in properties) {
        var property = properties[propertyIndex];

        filtered = filterProp.call(this, this._data, property, filtered);

        if (filtered && filtered.$error && filtered.$error == ERROR_PROPERTY_NOT_FOUND) {
            missing.push(property);
            delete filtered.$error;
        }

    }

    if (missing.length > 0) {
        return {
            $error: 'property not found',
            missing: missing
        };
    }

    return filtered;
}

module.exports = PropertyFilter;
