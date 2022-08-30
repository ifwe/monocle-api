var Router = require('../../lib/Router');
var Request = require('../../lib/Request');
var Resource = require('../../lib/Resource');
var Connection = require('../../lib/Connection');

describe('Connection', function() {
    it('is a constructor', function() {
        var connection = new Connection({}, {}, {});
        connection.should.be.instanceOf(Connection);
    });

    describe('HTTP methods', function() {
        beforeEach(function() {
            var httpRequest = {};
            var httpResponse = {};
            this.router = new Router();
            sinon.stub(this.router, 'handle');
            this.connection = new Connection(this.router, httpRequest, httpResponse);
        });

        [
            Request.METHOD_GET,
            Request.METHOD_POST,
            Request.METHOD_PUT,
            Request.METHOD_PATCH,
            Request.METHOD_DELETE,
            Request.METHOD_OPTIONS
        ].forEach(function(method) {
            it('should have a function defined for HTTP method: ' + method, function () {
                Connection.prototype[method.toLowerCase()].should.be.a.Function;
            });

            describe('HTTP methods', function () {
                beforeEach(function () {
                    this.resourceId = '/foo/1';
                    this.options = {
                        foo: 'bar'
                    };
                    sinon.spy(this.connection, method.toLowerCase());
                });

                it('should call router.handle with a new Request object for HTTP method: ' + method, function () {
                    this.connection[method.toLowerCase()](this.resourceId, this.options);

                    var resourceId = this.connection[method.toLowerCase()].lastCall.args[0];
                    this.router.handle.called.should.be.true;
                    // Request param
                    this.router.handle.lastCall.args[0].should.be.instanceOf(Request);

                    // Request object param should contain correct resourceId
                    this.router.handle.lastCall.args[0].getResourceId().should.equal(this.resourceId);

                    // Connection param
                    this.router.handle.lastCall.args[1].should.be.instanceOf(Connection);
                });

                it('sets resource if specified in options', function() {
                    this.options.resource = { foo: 'test foo' };
                    this.connection[method.toLowerCase()](this.resourceId, this.options);
                    this.router.handle.lastCall.args[0].getResource().should.equal(this.options.resource);
                });

                it('sets query params if specified in options', function() {
                    this.options.query = { foo: 'test foo', foo2: 'test foo2'};
                    this.connection[method.toLowerCase()](this.resourceId, this.options);

                    this.router.handle.lastCall.args[0].getQuery('foo').should.equal('test foo');
                    this.router.handle.lastCall.args[0].getQuery('foo2').should.equal('test foo2');
                });
            });
        });

        describe('similar GET requests', function() {
            it('caches and reuses them', function() {
                for (var i = 0; i < 3; i++) {
                    this.connection.get('/foo', {
                        props: ['a', 'b', 'c'],
                        query: {
                            derp: 'berp'
                        }
                    });
                }

                this.router.handle.calledOnce.should.be.true;
            });
        });

        describe('dissimilar GET requests', function() {
            it('does not reuse them', function() {
                for (var i = 0; i < 3; i++) {
                    this.connection.get('/foo', {
                        props: ['a', 'b', 'c'],
                        query: {
                            derp: i
                        }
                    });
                }

                this.router.handle.calledThrice.should.be.true;
            });
        });
    });
});
