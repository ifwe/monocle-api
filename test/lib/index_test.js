var Router = require(LIB_DIR);

describe('Module', function() {
    it('is a constructor', function() {
        Router.should.be.a('function');
    });

    it('exposes .Resource', function() {
        Router.Resource.should.be.a('function');
    });

    it('exposes .Request', function() {
        Router.Request.should.be.a('function');
    });
});
