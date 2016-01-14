var Collection = require('../../lib/Collection');

describe('Collection', function() {
    beforeEach(function() {
        this.id = '/my-resources';
        this.items = [0, 1, 2];
        this.expires = 1000;
        this.collection = new Collection(this.id, this.items, this.expires);
    });

    describe('resource id', function() {
        it('can be retrieved', function() {
            this.collection.getId().should.equal(this.id);
        });

        [
            '/anything',
            undefined
        ].forEach(function(validId) {
            it('can be set to ' + JSON.stringify(validId), function() {
                this.collection.setId(validId);
                expect(this.collection.getId()).to.equal(validId);
            });
        });

        [
            {},
            [],
            123,
            1.23,
            function() {},
            null,
            true,
            false
        ].forEach(function(invalidId) {
            it('throws an error if set to ' + JSON.stringify(invalidId), function() {
                expect(function() {
                    this.collection.setId(invalidId);
                }.bind(this)).to.throw();
            });
        });
    });

    describe('items', function() {
        it('can be retrieved', function() {
            this.collection.getItems().should.deep.equal(this.items);
        });

        it('can be replaced', function() {
            var updatedItems = [7, 8, 9];
            this.collection.setItems(updatedItems);
            this.collection.getItems().should.deep.equal(updatedItems);
        });

        [
            {},
            123,
            1.23,
            function() {},
            null,
            true,
            false
        ].forEach(function(invalidItems) {
            it('throws an error if set to ' + JSON.stringify(invalidItems), function() {
                expect(function() {
                    this.collection.setItems(invalidItems);
                }.bind(this)).to.throw();
            });
        });
    });

    describe('individual item', function() {
        it('can be retrieved', function() {
            this.collection.getItem(0).should.equal(0);
            this.collection.getItem(1).should.equal(1);
            this.collection.getItem(2).should.equal(2);
        });

        it('can be replaced', function() {
            this.collection.setItem(0, 'foo');
            this.collection.getItem(0).should.equal('foo');
        });

        [
            {},
            [],
            -1,
            function() {},
            null,
            true,
            false
        ].forEach(function(invalidPosition) {
            it('throws an error if position set ' + JSON.stringify(invalidPosition), function() {
                expect(function() {
                    this.collection.setItem(invalidPosition, 'anything');
                }.bind(this)).to.throw();
            });
        });
    });

    describe('expiration', function() {
        it('can be retrieved', function() {
            this.collection.getExpires().should.equal(this.expires);
        });

        it('can be set', function() {
            this.collection.setExpires(5000);
            this.collection.getExpires().should.equal(5000);
        });

        [
            {},
            [],
            -1,
            function() {},
            null,
            true,
            false
        ].forEach(function(invalidExpires) {
            it('throws an error if set to ' + JSON.stringify(invalidExpires), function() {
                expect(function() {
                    this.collection.setExpires(invalidExpires);
                }.bind(this)).to.throw();
            });
        });
    });

    describe('total', function() {
        it('can be retreived', function() {
            expect(this.collection.getTotal()).to.be.undefined;
        });

        it('can be overwritten', function() {
            this.collection.setTotal(100);
            this.collection.getTotal().should.equal(100);
        });

        [
            {},
            [],
            -1,
            function() {},
            null,
            true,
            false
        ].forEach(function(invalidTotal) {
            it('throws an error if set to ' + JSON.stringify(invalidTotal), function() {
                expect(function() {
                    this.collection.setTotal(invalidTotal);
                }.bind(this)).to.throw();
            });
        });
    });

    describe('limit', function() {
        it('can be retreived', function() {
            expect(this.collection.getLimit()).to.be.undefined;
        });

        it('can be overwritten', function() {
            this.collection.setLimit(10);
            this.collection.getLimit().should.equal(10);
        });

        [
            {},
            [],
            -1,
            function() {},
            null,
            true,
            false
        ].forEach(function(invalidLimit) {
            it('throws an error if set to ' + JSON.stringify(invalidLimit), function() {
                expect(function() {
                    this.collection.setLimit(invalidLimit);
                }.bind(this)).to.throw();
            });
        });
    });

    describe('.pop()', function() {
        it('returns the last item', function() {
            this.collection.pop().should.equal(2);
        });

        it('removes the last item', function() {
            this.collection.pop();
            this.collection.getItems().should.deep.equal([0, 1]);
        });
    });

    describe('.push()', function() {
        it('adds the item to the end of the collection', function() {
            this.collection.push('foo');
            this.collection.getItems().should.deep.equal([0, 1, 2, 'foo']);
        });

        it('returns this', function() {
            this.collection.push('anything').should.equal(this.collection);
        });
    });

    describe('.shift()', function() {
        it('returns the last item', function() {
            this.collection.shift().should.equal(0);
        });

        it('removes the first item', function() {
            this.collection.shift();
            this.collection.getItems().should.deep.equal([1, 2]);
        });
    });

    describe('.unshift()', function() {
        it('adds the item to the beginning of the collection', function() {
            this.collection.unshift('foo');
            this.collection.getItems().should.deep.equal(['foo', 0, 1, 2]);
        });

        it('returns this', function() {
            this.collection.unshift('anything').should.equal(this.collection);
        });
    });

    describe('stringification', function() {
        beforeEach(function() {
            this.collection = new Collection();
            this.objectify = function() {
                this.stringified = JSON.stringify(this.collection);
                return JSON.parse(this.stringified);
            }.bind(this);
        });

        it('does not contain $id property if not set', function() {
            this.objectify().should.not.have.property('$id');
        });

        it('contains $id property if set', function() {
            this.collection.setId('/foos')
            this.objectify().should.have.property('$id', '/foos');
        });

        it('does not contain $expires property if not set', function() {
            this.objectify().should.not.have.property('$expires');
        });

        it('contains $expires property', function() {
            this.collection.setExpires(1000);
            this.objectify().should.have.property('$expires', 1000);
        });

        it('does not contain $total property if not specified', function() {
            this.objectify().should.not.have.property('total');
        });

        it('contains $total property if set', function() {
            this.collection.setTotal(100);
            this.objectify().should.have.property('total', 100);
        });

        it('does not contain $limit property if not specified', function() {
            this.objectify().should.not.have.property('limit');
        });

        it('contains $limit property if set', function() {
            this.collection.setLimit(10);
            this.objectify().should.have.property('limit', 10);
        });

        it('contains items property', function() {
            var objectified = this.objectify();
            objectified.should.have.property('items');
            objectified.items.should.be.an('array');
        });

        it('contains items specified in collection', function() {
            var items = [0, 1, 2];
            this.collection.setItems(items);
            this.objectify().items.should.deep.equal(items);
        });
    });
});
