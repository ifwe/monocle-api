var Router = require('../../lib/Router');
var Request = require('../../lib/Request');
var Resource = require('../../lib/Resource');
var Promise = require('bluebird');

describe('API Router', function() {
    beforeEach(function() {

    });

    it('is a constructor', function() {
        var router = new Router();
        router.should.be.instanceOf(Router);
    });

    describe('simple routing', function() {
        beforeEach(function() {
            this.router = new Router();
            this.clock = sinon.useFakeTimers(10000000);

            // Set up "/foo/:fooId" resource -- sync
            this.fooSchema = {
                type: 'object',
                properties: {
                    foo: { type: 'string' }
                }
            };
            this.getFooSpy = sinon.spy(function(request) {
                return {
                    foo: 'test foo'
                };
            });
            this.router.route('/foo/:fooId', this.fooSchema, {
                get: this.getFooSpy
            });

            // Set up "/bar/:barId" resource -- async
            this.getBarSpy = sinon.spy(function(request) {
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        resolve({
                            bar: 'test bar'
                        });
                    }, 1000);
                });
            });
            this.barSchema = {
                type: 'object',
                properties: {
                    barId: { type: 'integer' },
                    bar: { type: 'string' }
                }
            };
            this.router.route('/bar/:barId', this.barSchema, {
                get: this.getBarSpy
            });
        });

        afterEach(function() {
            this.clock.restore();
        });

        it('calls associated callback with request object', function(done) {
            this.router.get('/foo/123')
            .then(function(foo) {
                this.getFooSpy.called.should.be.true;
                var request = this.getFooSpy.lastCall.args[0];
                request.should.be.instanceOf(Request);
                request.getParam('fooId').should.equal('123');
            }.bind(this))
            .finally(done);
        });

        it('resolves with object from callback', function(done) {
            this.router.get('/foo/123')
            .then(function(foo) {
                foo.should.deep.equal({
                    foo: 'test foo'
                });
            }.bind(this))
            .finally(done);
        });

        it('supports async callbacks via promises', function(done) {
            this.router.get('/bar/123')
            .then(function(bar) {
                bar.should.deep.equal({
                    bar: 'test bar'
                });
            }.bind(this))
            .finally(done);
            this.clock.tick(1000);
        });

        it('throws error if schema is invalid', function() {
            expect(function() {
                this.router.route('/invlid', {
                    type: 'object',
                    properties: 'invalid' // expecting an object
                }, {
                    get: function() {/* empty */}
                });
            }.bind(this)).to.throw();
        });

        describe('with collection', function() {
            it('merges collection of resources', function(done) {
                this.foosSchema = {
                    $schema: 'http://json-schema.org/draft-04/schema#',
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            bar: { type: 'string' },
                            baz: { type: 'string' }
                        }
                    }
                };
                this.router.route('/foos', this.foosSchema, {
                    get: [
                        {
                            props: ['bar'],
                            callback: function() {
                                var results = [];
                                for (var i = 1; i <= 3; i++) {
                                    results.push(new Resource('/foo/' + i, {
                                        bar: 'bar ' + i
                                    }));
                                }
                                return results;
                            }
                        },
                        {
                            props: ['baz'],
                            callback: function() {
                                var results = [];
                                for (var i = 1; i <= 3; i++) {
                                    results.push(new Resource('/foo/' + i, {
                                        baz: 'baz ' + i
                                    }));
                                }
                                return results;
                            }
                        }
                    ]
                });

                this.router.get('/foos')
                .then(function(foos) {

                }.bind(this))
                .catch(function(error) {
                    // console.log(JSON.stringify(error, null, 2));
                    throw new Error(error);
                })
                .finally(done);
            });
        });
    });

    describe('request', function() {
        beforeEach(function() {
            this.router = new Router();

            // Set up "/foo/:fooId/:barId" resource -- sync
            this.fooSchema = {
                type: 'object',
                properties: {
                    fooId: { type: 'integer' },
                    barId: { type: 'string' }
                }
            };
            this.getFooSpy = sinon.spy(function(request) {
                return {
                    fooId: request.getParam('fooId'),
                    barId: request.getParam('barId')
                };
            });
            this.router.route('/foo/:fooId/:barId', this.fooSchema, {
                get: this.getFooSpy
            });
        });

        it('extracts params from resourceId', function(done) {
            this.router.get('/foo/123/abc')
            .then(function(foo) {
                foo.should.deep.equal({
                    fooId: 123,
                    barId: 'abc'
                });
            }.bind(this))
            .finally(done);
        });
    });

    describe('connect middleware', function() {
        beforeEach(function() {
            this.router = new Router();

            // Configure router
            this.router.route('/foo', {
                type: 'object',
                properties: {
                    bar: { type: 'string' }
                }
            }, {
                get: function(params, req) {
                    return {
                        bar: 'test_bar'
                    };
                }
            });

            this.router.route('/derp', {
                type: 'object',
                properties: {
                    flerp: { type: 'string' }
                }
            }, {
                get: function(params, req) {
                    return {
                        flerp: 'test_flerp'
                    };
                }
            });

            // Stub request
            this.req = {
                method: 'GET',
                url: '/foo?props=bar'
            };

            // Stub response
            this.res = {
                setHeader: sinon.spy(),
                end: sinon.spy(),
                statusCode: 200 // default
            };

            // Stub next
            this.next = sinon.spy();
        });

        it('is a function', function() {
            var middleware = this.router.middleware();
            middleware.should.be.a('function');
        });

        describe('GET request matching API endpoint', function() {
            beforeEach(function() {
                this.req.method ='GET';
                this.req.url = '/foo?props=bar';
                this.middleware = this.router.middleware();
            });

            it('responds with HTTP status code 200', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.should.have.property('statusCode', 200);
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with header Content-Type: application/json', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.setHeader.calledWith('Content-Type', 'application/json').should.be.true;
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with JSON body', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.end.lastCall.args[0].should.be.ok;
                    var obj = JSON.parse(this.res.end.lastCall.args[0]);
                    obj.should.contain({
                        bar: 'test_bar'
                    });
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with HTTP status code of 500 when unable to generate JSON', function(done) {
                this.router.route('/bad-resource', {
                    type: 'object',
                    properties: {
                        bar: { type: 'object' }
                    }
                }, {
                    get: function(params, req) {
                        // Create a bad object
                        var result = {};
                        result.bar = result; // circular reference cannot be JSONified
                        return result;
                    }
                });
                this.req.url = '/bad-resource?props=bar'
                this.res.end = sinon.spy(function() {
                    this.res.should.have.property('statusCode', 500);
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });
        });

        describe('GET request not matching API endpoint', function() {
            beforeEach(function() {
                this.req.method ='GET';
                this.req.url = '/unknown?props=bar';
                this.middleware = this.router.middleware();
            });

            it('responds with HTTP status code 404', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.should.have.property('statusCode', 404);
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with header Content-Type: application/json', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.setHeader.calledWith('Content-Type', 'application/json').should.be.true;
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with JSON body', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.end.lastCall.args[0].should.be.ok;
                    var obj = JSON.parse(this.res.end.lastCall.args[0]);
                    obj.should.not.contain({
                        bar: 'test_bar'
                    });

                    // TODO: Determine standard model for error objects
                    obj.should.have.property('error');
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });
        });

        describe('OPTIONS', function() {
            beforeEach(function() {
                this.req.method = 'OPTIONS';
                this.req.url = '/foo';
                this.middleware = this.router.middleware();
            });

            it('responds with HTTP status code 200', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.should.have.property('statusCode', 200);
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with header Content-Type: application/json', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.setHeader.calledWith('Content-Type', 'application/json').should.be.true;
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with JSON body', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.end.lastCall.args[0].should.be.ok;
                    expect(function() {
                        var obj = JSON.parse(this.res.end.lastCall.args[0]);
                    }.bind(this)).to.not.throw();
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with schema', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.end.lastCall.args[0].should.be.ok;
                    var obj = JSON.parse(this.res.end.lastCall.args[0]);
                    obj.should.have.property('schema');
                    obj.schema.should.deep.equal({
                        type: 'object',
                        properties: {
                            bar: { type: 'string' }
                        }
                    });
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with available methods', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.end.lastCall.args[0].should.be.ok;
                    var obj = JSON.parse(this.res.end.lastCall.args[0]);
                    obj.should.have.property('methods');
                    obj.methods.should.contain('GET');
                    obj.methods.should.contain('OPTIONS');
                    obj.methods.should.not.contain('POST');
                    obj.methods.should.not.contain('PUT');
                    obj.methods.should.not.contain('PATCH');
                    obj.methods.should.not.contain('DELETE');
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });
        });

        describe('GET request not matching base path', function() {
            beforeEach(function() {
                this.middleware = this.router.middleware({
                    basePath: '/my-api'
                });
            });

            it('calls next', function() {
                this.req.method ='GET';
                this.req.url = '/foo?props=bar';
                this.middleware(this.req, this.res, this.next);
                this.next.called.should.be.true;
            });
        });
    });
});