module.exports = Symlink;

function Symlink(id) {
    this.id = id;
}

Symlink.prototype.resolve = function(connection) {
    return connection.get(this.id);
}
