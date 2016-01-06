module.exports = Symlink;

function Symlink(link) {
    this.$link = link;
}

Symlink.prototype.resolve = function(connection) {
    return connection.get(this.$link);
}
