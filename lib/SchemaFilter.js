var SchemaFilter = function(schema) {
    this._schema = schema;
};

SchemaFilter.prototype.property = function(property) {
    if (-1 === property.indexOf('.') && -1 === property.indexOf('@')) {
        return this._schema.properties[property];
    }

    var path = property.split('.');
    var key = path.shift();

    if (-1 !== key.indexOf('@')) {
        // Attempting to pluck from an array
        var parts = property.split('@');
        parts.shift();

        var subkeys = parts.join('@');

        //Recursively find the nested property
        let schemaFilter = new SchemaFilter(this._schema.properties.items.items);
        return schemaFilter.property(subkeys);

    } else if (this._schema.properties[key].type == 'object'){
        //Recursively find the nested property
        let schemaFilter = new SchemaFilter(this._schema.properties[key]);
        return schemaFilter.property(path.join('.'));
    }

    //property not found
    return null;
}

module.exports = SchemaFilter;
