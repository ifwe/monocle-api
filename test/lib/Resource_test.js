var Resource = require('../../lib/Resource');

describe('Resource', function() {
    it('is a constructor', function() {
        var resource = new Resource('/foo', {
            foo: 'test foo'
        });
        resource.should.be.instanceOf(Resource);
    });

    describe('representation', function() {
        beforeEach(function() {
            this.id = '/foo';
            this.data = {
                foo: 'test foo',
                bar: 'test bar'
            };
            this.expires = 1000;
            this.resource = new Resource(this.id, this.data, this.expires);
        });

        it('contains $id', function() {
            this.resource.should.have.property('$id', this.id);
        });

        it('contains $expires', function() {
            this.resource.should.have.property('$expires', this.expires);
        });

        it('contains data', function() {
            this.resource.should.have.property('foo', this.data.foo);
            this.resource.should.have.property('bar', this.data.bar);
        });
    });
});
