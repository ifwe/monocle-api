var Symlink = require('../../lib/Symlink');
var Promise = require('bluebird');
var Resource = require('../../lib/Resource');

describe('Symlink', function() {
    it('is a constructor', function() {
        var symlink = new Symlink('/foo/123');
        symlink.should.be.instanceOf(Symlink);
    });

    describe('resolve', function() {
        beforeEach(function() {
            this.id = '/foo/123';
            this.symlink = new Symlink(this.id);
            this.connection = {
                get: sinon.spy(function() {
                    return Promise.resolve('anything')
                })
            };
        })

        it('returns a promise', function() {
            this.symlink.resolve(this.connection).should.have.property('then');
        });

        it('makes GET request with connection', function() {
            return this.symlink.resolve(this.connection)
            .then(function(result) {
                this.connection.get.calledWith(this.id).should.be.true;
            }.bind(this));
        });
    });

    describe('post resolve mutator', function() {
        beforeEach(function() {
            this.id = '/foo/123';
            this.symlink = new Symlink(this.id);
            this.connection = {
                get: sinon.stub().returns(Promise.resolve({
                    foo: 'test foo'
                }))
            };
        });

        it('can mutate resource via .then()', function() {
            this.symlink.then(function(result) {
                result.foo = 'updated';
                return result;
            });

            return this.symlink.resolve(this.connection)
            .then(function(result) {
                result.foo.should.equal('updated');
            }.bind(this));
        });

        it('can recover from errors via .catch()', function(done) {
            this.connection.get.returns(Promise.reject('some error'));

            this.symlink.catch(function(error) {
                return {
                    foo: 'sensible default'
                };
            });

            this.symlink.resolve(this.connection)
            .then(function(result) {
                result.foo.should.equal('sensible default');
                done();
            }.bind(this));
        });

        it('can run code regardless of result', function(done) {
            this.symlink.finally(function(error) {
                done();
            });

            this.symlink.resolve(this.connection);
        });
    });

    describe('pre-hydration', function() {
        describe('with simple prehydrated data', function() {
            beforeEach(function() {
                this.id = '/foo/123';
                this.data = {
                    id: 123,
                    bar: 'test bar',
                    derp: true
                };
                this.symlink = new Symlink(this.id, this.data);
                this.connection = {
                    get: sinon.stub()
                        .withArgs('/foo/123')
                        .returns(Promise.resolve({
                            flerp: 'test flerp'
                        }))
                };
            });

            describe('all requested props prehydrated', function() {
                beforeEach(function() {
                    this.props = ['id', 'bar', 'derp'];
                });

                it('skips internal API call', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        this.connection.get.called.should.be.false;
                    }.bind(this));
                });

                it('resolves with resource', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        result.should.have.property('id', 123);
                        result.should.have.property('bar', 'test bar');
                        result.should.have.property('derp', true);
                    }.bind(this));
                });
            });

            describe('some requested props prehydrated', function() {
                beforeEach(function() {
                    this.props = ['id', 'bar', 'derp', 'flerp'];
                });

                it('makes internal API call with missing props', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        this.connection.get.called.should.be.true;
                        this.connection.get.lastCall.args[0].should.equal(this.symlink.$link);
                        this.connection.get.lastCall.args[1].should.have.property('props');
                        this.connection.get.lastCall.args[1].props.should.contain('flerp');
                    }.bind(this));
                });

                it('makes internal API call without prehydrated props', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        this.connection.get.lastCall.args[1].props.should.not.contain('id');
                        this.connection.get.lastCall.args[1].props.should.not.contain('bar');
                        this.connection.get.lastCall.args[1].props.should.not.contain('derp');
                    }.bind(this));
                });

                it('resolves with merged resource', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        result.should.have.property('id', 123);
                        result.should.have.property('bar', 'test bar');
                        result.should.have.property('derp', true);
                        result.should.have.property('flerp', 'test flerp');
                    }.bind(this));
                });
            });

            describe('with no specified props', function() {
                it('makes internal API call', function() {
                    return this.symlink.resolve(this.connection)
                    .then(function(result) {
                        this.connection.get.called.should.be.true;
                        this.connection.get.lastCall.args[0].should.equal(this.symlink.$link);
                    }.bind(this));
                });
            });
        });

        describe('with nested prehydrated data', function() {
            beforeEach(function() {
                this.id = '/foo/123';
                this.data = {
                    foo: {
                        bar: {
                            derp: 123
                        }
                    }
                };
                this.symlink = new Symlink(this.id, this.data);
                this.connection = {
                    get: sinon.stub().returns('Unexpected connetction.get')
                };
            });

            describe('all requested props prehydrated', function() {
                beforeEach(function() {
                    this.props = ['foo.bar.derp'];
                });

                it('skips internal API call', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        this.connection.get.called.should.be.false;
                    }.bind(this));
                });

                it('resolves with resource', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        result.should.have.property('foo');
                        result.foo.should.have.property('bar');
                        result.foo.bar.should.have.property('derp', 123);
                    }.bind(this));
                });
            });

            describe('some requested props prehydrated', function() {
                beforeEach(function() {
                    this.props = ['foo.bar.derp', 'foo.flerp.herp'];
                    this.connection.get.returns(Promise.resolve({
                        foo: {
                            flerp: {
                                herp: 'test herp'
                            }
                        }
                    }));
                });

                it('makes internal API call with missing props', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        this.connection.get.called.should.be.true;
                        this.connection.get.lastCall.args[0].should.equal(this.symlink.$link);
                        this.connection.get.lastCall.args[1].should.have.property('props');
                        this.connection.get.lastCall.args[1].props.should.contain('foo.flerp.herp');
                    }.bind(this));
                });

                it('makes internal API call without prehydrated props', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        this.connection.get.lastCall.args[1].props.should.not.contain('foo.bar.derp');
                    }.bind(this));
                });

                it('merges internal call data with prehydrated data', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        result.should.have.property('foo');
                        result.foo.should.have.property('bar');
                        result.foo.bar.should.have.property('derp', 123);
                        result.foo.should.have.property('flerp');
                        result.foo.flerp.should.have.property('herp', 'test herp');
                    }.bind(this));
                });
            });
        });

        describe('with complex prehydrated data including arrays', function() {
            beforeEach(function() {
                this.id = '/foo/123';
                this.data = {
                    foos: [
                        {
                            bar: 'test bar 1',
                            derp: {
                                flerp: 'test derp 1 flerp',
                                herp: 'test derp 1 herp'
                            }
                        },
                        {
                            bar: 'test bar 2',
                            derp: {
                                flerp: 'test derp 2 flerp',
                                herp: 'test derp 2 herp'
                            }
                        },
                        {
                            bar: 'test bar 3',
                            derp: {
                                flerp: 'test derp 3 flerp'
                                // herp is itentionally missing from this object
                            }
                        }
                    ]
                };
                this.symlink = new Symlink(this.id, this.data);
                this.connection = {
                    get: sinon.stub().returns('Unexpected connetction.get')
                };
            });

            describe('all requested props prehydrated', function() {
                beforeEach(function() {
                    this.props = ['foos@bar', 'foos@derp.flerp'];
                });

                it('skips internal API call', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        this.connection.get.called.should.be.false;
                    }.bind(this));
                });

                it('resolves with resource', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        result.should.have.property('foos');
                        result.foos.should.be.an('array');
                        result.foos.should.have.lengthOf(3);
                        result.foos[0].should.have.property('bar', 'test bar 1');
                        result.foos[0].should.have.property('derp');
                        result.foos[0].derp.should.have.property('flerp', 'test derp 1 flerp');
                        result.foos[1].should.have.property('bar', 'test bar 2');
                        result.foos[1].should.have.property('derp');
                        result.foos[1].derp.should.have.property('flerp', 'test derp 2 flerp');
                        result.foos[2].should.have.property('bar', 'test bar 3');
                        result.foos[2].should.have.property('derp');
                        result.foos[2].derp.should.have.property('flerp', 'test derp 3 flerp');
                    }.bind(this));
                });
            });

            describe('some requested props prehydrated', function() {
                beforeEach(function() {
                    this.props = ['foos@bar', 'foos@derp.flerp', 'foos@derp.herp', 'foos@derp.meep'];
                    this.connection.get.returns(Promise.resolve({
                        foos: [
                            {
                                derp: {
                                    herp: 'test derp 1 herp',
                                    meep: 'test derp 1 meep'
                                }
                            },
                            {
                                derp: {
                                    herp: 'test derp 2 herp',
                                    meep: 'test derp 2 meep'
                                }
                            },
                            {
                                derp: {
                                    herp: 'test derp 3 herp',
                                    meep: 'test derp 3 meep'
                                }
                            }
                        ]
                    }));
                });

                it('makes internal API call with missing props', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        this.connection.get.called.should.be.true;
                        this.connection.get.lastCall.args[0].should.equal(this.symlink.$link);
                        this.connection.get.lastCall.args[1].should.have.property('props');
                        this.connection.get.lastCall.args[1].props.should.contain('foos@derp.meep');
                    }.bind(this));
                });

                it('fetches missing prop if at least one item in the array is missing the prop', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        this.connection.get.called.should.be.true;
                        this.connection.get.lastCall.args[0].should.equal(this.symlink.$link);
                        this.connection.get.lastCall.args[1].should.have.property('props');
                        this.connection.get.lastCall.args[1].props.should.contain('foos@derp.herp');
                    }.bind(this));
                });

                it('makes internal API call without prehydrated props', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        this.connection.get.lastCall.args[1].props.should.not.contain('foos@bar');
                        this.connection.get.lastCall.args[1].props.should.not.contain('foos@derp.flerp');
                    }.bind(this));
                });

                it('merges internal call data with prehydrated data', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        result.should.have.property('foos');
                        result.foos.should.be.an('array');
                        result.foos.should.have.lengthOf(3);
                        result.foos[0].should.have.property('bar', 'test bar 1');
                        result.foos[0].should.have.property('derp');
                        result.foos[0].derp.should.have.property('flerp', 'test derp 1 flerp');
                        result.foos[0].derp.should.have.property('herp', 'test derp 1 herp');
                        result.foos[0].derp.should.have.property('meep', 'test derp 1 meep');
                        result.foos[1].should.have.property('bar', 'test bar 2');
                        result.foos[1].should.have.property('derp');
                        result.foos[1].derp.should.have.property('flerp', 'test derp 2 flerp');
                        result.foos[1].derp.should.have.property('herp', 'test derp 2 herp');
                        result.foos[1].derp.should.have.property('meep', 'test derp 2 meep');
                        result.foos[2].should.have.property('bar', 'test bar 3');
                        result.foos[2].should.have.property('derp');
                        result.foos[2].derp.should.have.property('flerp', 'test derp 3 flerp');
                        result.foos[2].derp.should.have.property('herp', 'test derp 3 herp');
                        result.foos[2].derp.should.have.property('meep', 'test derp 3 meep');
                    }.bind(this));
                });
            });
        });

        describe('with prehydrated Resource instance', function() {
            beforeEach(function() {
                this.id = '/foo/123';
                this.data = new Resource('/foo/123', {
                    foo: {
                        bar: {
                            derp: 123
                        }
                    }
                }, 1000);
                this.symlink = new Symlink(this.id, this.data);
                this.connection = {
                    get: sinon.stub().returns('Unexpected connetction.get')
                };
            });

            describe('all requested props prehydrated', function() {
                beforeEach(function() {
                    this.props = ['foo.bar.derp'];
                });

                it('skips internal API call', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        this.connection.get.called.should.be.false;
                    }.bind(this));
                });

                it('resolves with resource', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        result.should.have.property('foo');
                        result.foo.should.have.property('bar');
                        result.foo.bar.should.have.property('derp', 123);
                        result.should.have.property('$type', 'resource');
                        result.should.have.property('$id', '/foo/123');
                        result.should.have.property('$expires', 1000);
                    }.bind(this));
                });
            });

            describe('some requested props prehydrated', function() {
                beforeEach(function() {
                    this.props = ['foo.bar.derp', 'foo.flerp.herp'];
                    this.connection.get.returns(Promise.resolve({
                        foo: {
                            flerp: {
                                herp: 'test herp'
                            }
                        }
                    }));
                });

                it('makes internal API call with missing props', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        this.connection.get.called.should.be.true;
                        this.connection.get.lastCall.args[0].should.equal(this.symlink.$link);
                        this.connection.get.lastCall.args[1].should.have.property('props');
                        this.connection.get.lastCall.args[1].props.should.contain('foo.flerp.herp');
                    }.bind(this));
                });

                it('makes internal API call without prehydrated props', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        this.connection.get.lastCall.args[1].props.should.not.contain('foo.bar.derp');
                    }.bind(this));
                });

                it('merges internal call data with prehydrated data', function() {
                    return this.symlink.resolve(this.connection, { props: this.props })
                    .then(function(result) {
                        result.should.have.property('foo');
                        result.foo.should.have.property('bar');
                        result.foo.bar.should.have.property('derp', 123);
                        result.foo.should.have.property('flerp');
                        result.foo.flerp.should.have.property('herp', 'test herp');
                        result.should.have.property('$type', 'resource');
                        result.should.have.property('$id', '/foo/123');
                        result.should.have.property('$expires', 1000);
                    }.bind(this));
                });
            });
        });
    });
});
