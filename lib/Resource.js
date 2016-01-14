var _ = require('lodash');

module.exports = Resource;

function Resource(id, data, expires) {
    this.$type = 'resource';
    this.$id = id;
    this.$expires = (typeof expires === 'number' ? expires : undefined);
    return _.merge(this, data || {});
}
