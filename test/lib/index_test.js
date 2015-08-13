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

    describe('getting a resource', function() {
        beforeEach(function() {
            this.router.get('/foo', {
                props: {
                    bar: 'string',
                    derp: 'number'
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
                props: {
                    bat: 'string'
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
                props: {
                    bar: 'string'
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
                props: {
                    bar: 'string',
                    derp: 'string'
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
                props: {
                    bar: 'string'
                }
            }, function() {});

            this.barSpy = sinon.spy();

            this.router.get('/foo', {
                props: {
                    bar: 'string',
                    derp: 'number'
                }
            }, function() {});
        });

        it('is returned based on defined routes', function() {
            this.router.getSchema('/foo').should.deep.equal({
                bar: 'string',
                derp: 'number'
            });
        });
    });

    describe('return value validation', function() {
        it('fails when callback does not return proper type', function(done) {
            this.router.get('/foo', {
                props: {
                    bar: 'string'
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
                error.should.contain('Expected bar to be a string');
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
                        props: { bar: 'string' }
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
        });

        afterEach(function() {
            process.hrtime.restore();
            this.clock.restore();
        });

        describe('api:handler', function() {
            it('is emitted with details about the handler that will fulfill the request', function(done) {
                var resource = '/foo';
                var options = { props: { bar: 'string' } };

                this.router.get(resource, options, function() {
                    return {
                        bar: 'test_bar'
                    };
                });
                var spy = sinon.spy();
                this.router.on('api:handler', spy);
                this.router.handleGet(resource, { props: ['bar'] })
                .finally(function() {
                    spy.calledOnce.should.be.true;
                    var callArgs = spy.lastCall.args[0];
                    callArgs.should.contain({ method: 'GET' });
                    callArgs.should.contain({ resource: '/foo' });
                    callArgs.should.have.property('options', options);
                    callArgs.should.have.property('args');
                    callArgs.args.should.be.an('array');
                    done();
                });
            });

            it('is emitted for each handler that is called to fulfill the request', function(done) {
                var resource = '/foo';
                var options = [
                    { props: { bar: 'string' } },
                    { props: { baz: 'string' } },
                    { props: { bat: 'string' } }
                ];

                options.forEach(function(_options) {
                    this.router.get(resource, _options, function() {
                        var result = {};
                        for (var i in _options.props) {
                            if (!_options.props.hasOwnProperty(i)) continue;
                            result[i] = 'test_' + i;
                        };
                        return result;
                    });
                }.bind(this));

                var spy = sinon.spy();
                this.router.on('api:handler', spy);

                this.router.handleGet(resource, { props: ['bar', 'baz', 'bat'] })
                .finally(function() {
                    spy.calledThrice.should.be.true;
                    options.forEach(function(_options, i) {
                        var callArgs = spy.getCall(i).args[0];
                        callArgs.should.contain({ method: 'GET' });
                        callArgs.should.contain({ resource: '/foo' });
                        callArgs.should.have.property('options', _options);
                        callArgs.should.have.property('args');
                        callArgs.args.should.be.an('array');
                    });
                    done();
                });
            });

            it('is not emitted if request cannot be fulfilled', function(done) {
                var resource = '/foo';
                var options = { props: { bar: 'string' } };

                this.router.get(resource, options, function() {
                    return {
                        bar: 'test_bar'
                    };
                });
                var spy = sinon.spy();
                this.router.on('api:handler', spy);
                this.router.handleGet(resource, { props: ['unknown'] })
                .catch(function(error) {
                    error.should.be.ok;
                })
                .finally(function() {
                    spy.called.should.be.false;
                    done();
                });
            });
        });

        describe('api:success', function() {
            it('is emitted if request is fulfilled', function(done) {
                var resource = '/foo';
                var options = { props: { bar: 'string' } };

                this.router.get(resource, options, function() {
                    this.clock.tick(500);
                    return {
                        bar: 'test_bar'
                    };
                }.bind(this));
                var spy = sinon.spy();
                this.router.on('api:success', spy);
                this.router.handleGet(resource, { props: ['bar'] })
                .finally(function() {
                    spy.called.should.be.true;
                    var data = spy.lastCall.args[0];
                    data.should.have.property('duration', 500);
                    done();
                });
            });

            it('is not emitted if request is not fulfilled', function(done) {
                var resource = '/foo';
                var options = { props: { bar: 'string' } };

                this.router.get(resource, options, function() {
                    return {
                        bar: 'test_bar'
                    };
                });
                var spy = sinon.spy();
                this.router.on('api:success', spy);
                this.router.handleGet(resource, { props: ['unknown'] })
                .catch(function(error) {
                    error.should.be.ok;
                })
                .finally(function() {
                    spy.called.should.be.false;
                    done();
                });
            });
        });

        describe('api:error', function() {
            it('is emitted if request cannot be fulfilled', function(done) {
                var resource = '/foo';
                var options = { props: { bar: 'string' } };

                this.router.get(resource, options, function() {
                    return {
                        bar: 'test_bar'
                    };
                });
                var spy = sinon.spy();
                this.router.on('api:error', spy);
                this.router.handleGet(resource, { props: ['unkown'] })
                .catch(function(error) {
                    error.should.be.ok;
                })
                .finally(function() {
                    spy.called.should.be.true;
                    done();
                });
            });

            it('is not emitted if request is fulfilled', function(done) {
                var resource = '/foo';
                var options = { props: { bar: 'string' } };

                this.router.get(resource, options, function() {
                    return {
                        bar: 'test_bar'
                    };
                });
                var spy = sinon.spy();
                this.router.on('api:error', spy);
                this.router.handleGet(resource, { props: ['bar'] })
                .finally(function() {
                    spy.called.should.be.false;
                    done();
                });
            });
        });
    });

    describe('connect middleware', function() {
        beforeEach(function() {
            // Configure router
            this.router.get('/foo', {
                props: {
                    bar: 'string'
                }
            }, function(params, req) {
                return {
                    bar: 'test_bar'
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
                    props: {
                        bar: 'object'
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
                    obj.should.contain({
                        bar: 'string'
                    });
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });
        });
    });
});
