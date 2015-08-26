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
            var representation = this.resource.toRepresentation();
            representation.should.have.property('$id', this.id);
        });

        it('contains $expires', function() {
            var representation = this.resource.toRepresentation();
            representation.should.have.property('$expires', this.expires);
        });

        it('contains data', function() {
            var representation = this.resource.toRepresentation();
            representation.should.have.property('foo', this.data.foo);
            representation.should.have.property('bar', this.data.bar);
        });
    });
});
