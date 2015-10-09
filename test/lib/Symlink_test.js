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
            then(function(result) {
                this.connection.get.calledWith(this.id).should.be.true;
            }.bind(this));
        });
    })
});
