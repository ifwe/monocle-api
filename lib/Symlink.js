module.exports = Symlink;
var MonocleProps = require('monocle-api-props');
var debug = require('debug')('monocle:symlink');
var Promise = require('bluebird');
var merge = require('./util/merge');

function Symlink(link, data) {
    debug('Creating symlink', link, data);
    this.$link = link;

    // Using defineProperty to hide this property from JSON output
    Object.defineProperty(this, 'mutators', {
        value: []
    });

    Object.defineProperty(this, 'data', {
        value: data
    });
}

Symlink.prototype.resolve = function(connection, options) {
    return this.mutators.reduce(function(prev, mutator) {
        debug('Mutating resource', mutator);
        return prev[mutator.type](mutator.handler);
    }, resolve(this, connection, options));
};

function resolve(symlink, connection, options) {
    debug('Resolving symlink', symlink);
    if (symlink.data) {
        // Check if prehydrated data meets requirements for props
        var props = options && options.props || [];

        if (props.length) {
            var monocleProps = new MonocleProps(symlink.data);
            var needsResolution = props.filter(function(prop) {
                return !monocleProps.has(prop);
            });

            if (needsResolution.length === 0) {
                debug('Symlink fully hydrated according to requested properties');
                // Symlink is fully hydrated for the specified props, resolve immediately
                return Promise.resolve(symlink.data);
            }

            debug('Symlink properties still needs resolution', needsResolution);
            options.props = needsResolution;
        }
    }

    return connection.get(symlink.$link, options || {})
    .then(function(result) {
        if (typeof symlink.data !== 'undefined') {
            return merge(symlink.data, result);
        }
        return result;
    });
}

Symlink.prototype.then = function(handler) {
    this.mutators.push({
        type: 'then',
        handler: handler
    });
    return this;
};

Symlink.prototype.catch = function(handler) {
    this.mutators.push({
        type: 'catch',
        handler: handler
    });
    return this;
};

Symlink.prototype.finally = function(handler) {
    this.mutators.push({
        type: 'finally',
        handler: handler
    });
    return this;
};
