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
        describe('.' + method, function() {
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
});
