var _ = require('lodash');

module.exports = Resource;

function Resource(id, data, expires) {
    this.$id = id;
    this.$expires = (typeof expires === 'number' ? expires : undefined);
    return _.merge(this, data || {});
}
