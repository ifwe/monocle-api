module.exports = Symlink;

function Symlink(link) {
    this.$link = link;

    // Using defineProperty to hide this property from JSON output
    Object.defineProperty(this, 'mutators', {
        value: []
    });
}

Symlink.prototype.resolve = function(connection) {
    return this.mutators.reduce(function(prev, mutator) {
        return prev[mutator.type](mutator.handler);
    }, connection.get(this.$link));
};

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
