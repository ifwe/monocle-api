var Router = require(LIB_DIR);

describe('Module', function() {
    it('is a constructor', function() {
        Router.should.be.a('function');
    });

    it('exposes .Resource', function() {
        Router.Resource.should.be.a('function');
    });

    it('exposes .OffsetPaginator', function() {
        Router.OffsetPaginator.should.be.a('function');
    });

    it('exposes .CursorPaginator', function() {
        Router.CursorPaginator.should.be.a('function');
    });

    it('exposes .Request', function() {
        Router.Request.should.be.a('function');
    });

    it('exposes .Symlink', function() {
        Router.Symlink.should.be.a('function');
    });
});
