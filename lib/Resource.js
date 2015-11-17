var _ = require('lodash');

module.exports = Resource;

function Resource(id, data, expires) {
    this.$id = id;
    this.$expires = parseInt(expires, 10) || 0;
    _.merge(this, data || {});
}
