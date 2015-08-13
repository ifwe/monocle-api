/*jshint expr: true*/
var Promise = require('bluebird');

// Your npm package is accessible by requiring `LIB_DIR`.
var ApiRouter = require(LIB_DIR);

describe('ApiRouter', function() {
    beforeEach(function() {
        this.router = new ApiRouter();
    });

    it('exists', function() {
        this.router.should.exist;
    });

    ['get', 'post', 'put', 'delete', 'patch', 'options'].forEach(function(method) {
        describe('convenience method .' + method, function() {
            it('is a function', function() {
                this.router[method].should.be.a('function');
            });
        });
    });

    describe('registering a resource', function() {
        [
            'get',
            'GET',
            'Get'
        ].forEach(function(method) {
            it('supports mixed case for method: ' + method, function() {
                expect(function() {
                    this.router.register(method, '/anything', {}, sinon.spy());
                }.bind(this)).to.not.throw();
            });
        });

        [
            'invalid',                              // schema can't be a string
            { properties: ['string', 'integer'] }   // properties in incorrect format
        ].forEach(function(invalidSchema) {
            it('throws exception when schema is invalid: ' + JSON.stringify(invalidSchema), function() {
                expect(function() {
                    this.router.register('GET', '/anything', invalidSchema, sinon.spy());
                }.bind(this)).to.throw('Invalid schema');
            });
        });

        it('throws exception for invalid method', function() {
            expect(function() {
                this.router.register('DERP', '/anything', {}, sinon.spy());
            }.bind(this)).to.throw('Invalid method');
        });
    });

    describe('getting a resource', function() {
        beforeEach(function() {
            this.router.get('/foo', {
                type: 'object',
                properties: {
                    bar: { type: 'string' },
                    derp: { type: 'integer' }
                }
            }, function(params) {
                return {
                    bar: 'test_bar',
                    derp: 123
                };
            });

            this.batSpy = sinon.spy(function(params) {
                return {
                    bat: 'test_bat'
                };
            });

            this.router.get('/foo', {
                type: 'object',
                properties: {
                    bat: { type: 'string' }
                }
            }, this.batSpy);
        });

        it('returns data from callback', function(done) {
            this.router.handleGet('/foo', {
                props: ['bar', 'derp']
            }).then(function(result) {
                result.should.deep.equal({
                    bar: 'test_bar',
                    derp: 123
                });
            }).catch(function(error) {
                error.should.not.be.ok;
            }).finally(done);
        });

        it('rejects promise when cannot fulfill request', function(done) {
            this.router.handleGet('/foo', {
                props: ['bar', 'derp', 'baz']
            }).then(function(result) {
                result.should.not.be.ok;
            }).catch(function(error) {
                error.should.contain('Unable to resolve props');
            }).finally(done);
        });

        it('returns data from additional callback', function(done) {
            this.router.handleGet('/foo', {
                props: ['bar', 'derp', 'bat']
            }).then(function(result) {
                result.should.deep.equal({
                    bar: 'test_bar',
                    derp: 123,
                    bat: 'test_bat'
                });
            }).finally(done);
        });

        it('does not call useless callbacks', function(done) {
            this.router.handleGet('/foo', {
                props: ['bar', 'derp']
            }).then(function(result) {
                this.batSpy.called.should.be.false;
            }.bind(this)).finally(done);
        });

        it('returns a rejected promise if resource cannot be found', function(done) {
            this.router.handleGet('/unknown', {
                props: ['foo']
            }).then(function(result) {
                result.should.not.be.ok;
            }).catch(function(error) {
                error.should.contain('Unable to resolve props');
            }).finally(done);
        });
    });

    describe('duplicate props', function() {
        beforeEach(function() {
            this.router.get('/foo', {
                type: 'object',
                properties: {
                    bar: { type: 'string' }
                }
            }, function(params) {
                return {
                    bar: 'test_bar',
                };
            });

            this.barSpy = sinon.spy(function(params) {
                return {
                    bar: 'test_bar_2',
                    derp: 'test_derp'
                };
            });

            this.router.get('/foo', {
                type: 'object',
                properties: {
                    bar: { type: 'string' },
                    derp: { type: 'string' }
                }
            }, this.barSpy);
        });

        it('returns data from both callbacks', function(done) {
            this.router.handleGet('/foo', {
                props: ['bar', 'derp']
            }).then(function(result) {
                result.should.deep.equal({
                    bar: 'test_bar_2',
                    derp: 'test_derp'
                });
            }).finally(done);
        });
    });

    describe('schema', function() {
        beforeEach(function() {
            this.router.get('/foo', {
                type: 'object',
                properties: {
                    bar: { type: 'string' }
                }
            }, function() {});

            this.router.get('/foo', {
                type: 'object',
                properties: {
                    derp: { type: 'integer' }
                }
            }, function() {});

            this.router.get('/bad-schema', {
                type: 'huh',
                properties: {
                    thingy: { type: 'invalid' }
                }
            }, function() {});
        });

        it('is returned based on defined routes', function() {
            this.router.getSchema(ApiRouter.METHOD_GET, '/foo').should.deep.equal({
                type: 'object',
                properties: {
                    bar: { type: 'string' },
                    derp: { type: 'integer' }
                }
            });
        });
    });

    describe('return value validation', function() {
        it('fails when callback does not return proper type', function(done) {
            this.router.get('/foo', {
                type: 'object',
                properties: {
                    bar: { type: 'string' }
                }
            }, function() {
                return {
                    bar: 123 // not a string
                }
            });
            this.router.handleGet('/foo', {
                props: ['bar']
            }).then(function(result) {
                result.should.not.be.ok;
            }).catch(function(error) {
                error.should.contain('did not validate');
            }).finally(done);
        });

        it('fails when callback returns an object with a missing key', function(done) {
            this.router.get('/foo', {
                properties: {
                    bar: { type: 'string' },
                    baz: { type: 'string' }
                }
            }, function() {
                return {
                    bar: 'test_bar'
                    // intentionally missing `baz` property
                }
            });
            this.router.handleGet('/foo', {
                props: ['bar', 'baz']
            }).then(function(result) {
                result.should.not.be.ok;
            }).catch(function(error) {
                error.should.contain('Missing property');
            }).finally(done);
        });
    });

    describe('parameters', function() {
        [
            [ '/foo/:fooId', '/foo/abc', { fooId: 'abc' } ],
            [ '/foo/:fooId?', '/foo', { fooId: null } ],
            [ '/foo/:fooId?/bar/:barId', '/foo/bar/456', { fooId: null, barId: '456' } ],
            [ '/foo/:fooId?/bar/:barId', '/foo/123/bar/456', { fooId: '123', barId: '456' } ]
        ].forEach(function(data) {
            var route = data[0];
            var path = data[1];
            var expectedParams = data[2];

            describe('path ' + path, function() {
                it('calls ' + route + ' callback with extracted params ' + JSON.stringify(expectedParams), function(done) {
                    var callback = sinon.spy(function(params) {
                        return { bar: 'test_bar' };
                    });

                    this.router.get(route, {
                        type: 'object',
                        properties: {
                            bar: { type: 'string' }
                        }
                    }, callback);

                    this.router.handleGet(path, {
                        props: ['bar']
                    }).finally(function() {
                        callback.called.should.be.true;
                        callback.lastCall.args[0].should.contain(expectedParams);
                        done();
                    });
                });
            });
        });
    });

    describe('events', function() {
        beforeEach(function() {
            sinon.stub(process, 'hrtime', function() {
                // Sinon is stubbing the clock, so we can use that to generate the high resolution time.
                return [new Date().getTime() / 1000, 0];
            });
            this.clock = sinon.useFakeTimers();

            this.resource = '/foo';
            this.schemas = [
                { type: 'object', properties: { bar: { type: 'string' } } },
                { type: 'object', properties: { baz: { type: 'string' } } },
                { type: 'object', properties: { bat: { type: 'string' } } }
            ];

            this.schemas.forEach(function(schema) {
                this.router.get(this.resource, schema, function() {
                    this.clock.tick(500);
                    var result = {};
                    for (var i in schema.properties) {
                        if (!schema.properties.hasOwnProperty(i)) continue;
                        result[i] = 'test_' + i;
                    };
                    return result;
                }.bind(this));
            }.bind(this));
            this.eventSpy = sinon.spy();
        });

        afterEach(function() {
            process.hrtime.restore();
            this.clock.restore();
        });

        describe('api:handler', function() {
            beforeEach(function() {
                this.router.on('api:handler', this.eventSpy);
            });

            it('is emitted with details about the handler that will fulfill the request', function(done) {
                this.router.handleGet(this.resource, { props: ['bar'] })
                .finally(function() {
                    this.eventSpy.calledOnce.should.be.true;
                    var callArgs = this.eventSpy.lastCall.args[0];
                    callArgs.should.contain({ method: 'GET' });
                    callArgs.should.contain({ resource: '/foo' });
                    callArgs.should.have.property('schema', this.schemas[0]);
                    callArgs.should.have.property('args');
                    callArgs.args.should.be.an('array');
                    done();
                }.bind(this));
            });

            it('is emitted for each handler that is called to fulfill the request', function(done) {
                this.router.handleGet(this.resource, { props: ['bar', 'baz', 'bat'] })
                .finally(function() {
                    this.eventSpy.calledThrice.should.be.true;
                    this.schemas.forEach(function(schema, i) {
                        var callArgs = this.eventSpy.getCall(i).args[0];
                        callArgs.should.contain({ method: 'GET' });
                        callArgs.should.contain({ resource: '/foo' });
                        callArgs.should.have.property('schema', schema);
                        callArgs.should.have.property('args');
                        callArgs.args.should.be.an('array');
                    }.bind(this));
                    done();
                }.bind(this));
            });

            it('is not emitted if request cannot be fulfilled', function(done) {
                this.router.handleGet(this.resource, { props: ['unknown'] })
                .catch(function(error) {
                    error.should.be.ok;
                })
                .finally(function() {
                    this.eventSpy.called.should.be.false;
                    done();
                }.bind(this));
            });
        });

        describe('api:success', function() {
            beforeEach(function() {
                this.router.on('api:success', this.eventSpy);
            });

            it('is emitted if request is fulfilled', function(done) {
                this.router.handleGet(this.resource, { props: ['bar'] })
                .finally(function() {
                    this.eventSpy.called.should.be.true;
                    var data = this.eventSpy.lastCall.args[0];
                    data.should.have.property('duration', 500);
                    done();
                }.bind(this));
            });

            it('is not emitted if request is not fulfilled', function(done) {
                this.router.handleGet(this.resource, { props: ['unknown'] })
                .catch(function(error) {
                    error.should.be.ok;
                })
                .finally(function() {
                    this.eventSpy.called.should.be.false;
                    done();
                }.bind(this));
            });
        });

        describe('api:error', function() {
            beforeEach(function() {
                this.router.on('api:error', this.eventSpy);
            });

            it('is emitted if request cannot be fulfilled', function(done) {
                this.router.handleGet(this.resource, { props: ['unkown'] })
                .catch(function(error) {
                    error.should.be.ok;
                })
                .finally(function() {
                    this.eventSpy.called.should.be.true;
                    done();
                }.bind(this));
            });

            it('is not emitted if request is fulfilled', function(done) {
                this.router.handleGet(this.resource, { props: ['bar'] })
                .finally(function() {
                    this.eventSpy.called.should.be.false;
                    done();
                }.bind(this));
            });
        });
    });

    describe('connect middleware', function() {
        beforeEach(function() {
            // Configure router
            this.router.get('/foo', {
                type: 'object',
                properties: {
                    bar: { type: 'string' }
                }
            }, function(params, req) {
                return {
                    bar: 'test_bar'
                };
            });

            this.router.get('/derp', {
                type: 'object',
                properties: {
                    flerp: { type: 'string' }
                }
            }, function(params, req) {
                return {
                    flerp: 'test_flerp'
                };
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
                this.router.get('/bad-resource', {
                    type: 'object',
                    properties: {
                        bar: { type: 'object' }
                    }
                }, function(params, req) {
                    // Create a bad object
                    var result = {};
                    result.bar = result; // circular reference cannot be JSONified
                    return result;
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

        describe('GET valid schema', function() {
            beforeEach(function() {
                this.req.method ='GET';
                this.req.url = '/foo?schema';
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
                    obj.should.deep.equal({
                        type: 'object',
                        properties: {
                            bar: { type: 'string' }
                        }
                    });
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
