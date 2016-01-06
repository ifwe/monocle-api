var PropertyFilter = function(data) {
    this._data = data;
};

PropertyFilter.prototype.props = function(props) {
    if (!props || !props.length) {
        return this._data;
    }

    // Ignore symlinks -- they can't be filtered yet.
    if (this._data.hasOwnProperty('$link')) {
        return this._data;
    }

    if (Array.isArray(this._data)) {
        props = props.map(function(prop) {
            return (prop[0] === '@') ? prop.substr(1) : prop;
        });

        return this._data.map(function(data) {
            var filter = new PropertyFilter(data);
            return filter.props(props);
        });
    }

    var filtered = {};

    // Always keep properties that begin with `$`
    for (var key in this._data) {
        if (this._data.hasOwnProperty(key) && key[0] == '$') {
            filtered[key] = this._data[key];
        }
    }

    // Keep track of nested and plucked properties
    var nested = {};

    // Populate filtered object with properties we want to keep
    var missing = [];

    props.forEach(function(prop) {
        // Directly assign top-level props
        if (-1 === prop.indexOf('.') && -1 === prop.indexOf('@')) {
            if (!this._data.hasOwnProperty(prop)) {
                missing.push(prop);
            } else {
                filtered[prop] = this._data[prop];
            }

            return;
        }

        // Nested or plucked props, aggregate them for later
        var path = prop.split('.');
        var key = path.shift();

        if (-1 !== key.indexOf('@')) {
            // Attempting to pluck from an array
            var parts = key.split('@');
            key = parts.shift();
            nested[key] = nested[key] || [];
            nested[key].push(parts.join('@'));
        } else {
            // Normal nested property
            nested[key] = nested[key] || [];
            nested[key].push(path.join('.'));
        }
    }.bind(this));

    if (missing.length) {
        return missingError(missing);
    }

    // Recursively handle the nested/plucked props
    for (var prop in nested) {
        if (!this._data.hasOwnProperty(prop)) {
            return missingError([prop]);
        }
        var filter = new PropertyFilter(this._data[prop]);
        filtered[prop] = filter.props(nested[prop], true);
    }

    return filtered;
};

function missingError(missing) {
    return {
        $error: "One or more properties missing from data",
        $missing: missing
    };
}

module.exports = PropertyFilter;
