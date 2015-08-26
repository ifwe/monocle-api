var _ = require('lodash');

module.exports = Resource;

function Resource(id, data, expires) {
    this.id = id;
    this.data = data || {};
    this.expires = parseInt(expires, 10) || 0;
}

Resource.prototype.toRepresentation = function() {
    return _.merge({}, this.data, {
        $id: this.id,
        $expires: this.expires
    });
};
