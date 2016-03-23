var Symlink = require('../../lib/Symlink');
var Promise = require('bluebird');

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
});
