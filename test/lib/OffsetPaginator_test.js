var OffsetPaginator = require('../../lib/OffsetPaginator');

describe('OffsetPaginator', function() {
    beforeEach(function() {
        this.id = '/my-resources';
        this.items = [0, 1, 2];
        this.expires = 1000;
        this.paginator = new OffsetPaginator(this.id, this.items, this.expires);
    });

    describe('resource id', function() {
        it('can be retrieved', function() {
            this.paginator.getId().should.equal(this.id);
        });

        [
            '/anything',
            undefined
        ].forEach(function(validId) {
            it('can be set to ' + JSON.stringify(validId), function() {
                this.paginator.setId(validId);
                expect(this.paginator.getId()).to.equal(validId);
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
                    this.paginator.setId(invalidId);
                }.bind(this)).to.throw();
            });
        });
    });

    describe('items', function() {
        it('can be retrieved', function() {
            this.paginator.getItems().should.deep.equal(this.items);
        });

        it('can be replaced', function() {
            var updatedItems = [7, 8, 9];
            this.paginator.setItems(updatedItems);
            this.paginator.getItems().should.deep.equal(updatedItems);
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
                    this.paginator.setItems(invalidItems);
                }.bind(this)).to.throw();
            });
        });
    });

    describe('individual item', function() {
        it('can be retrieved', function() {
            this.paginator.getItem(0).should.equal(0);
            this.paginator.getItem(1).should.equal(1);
            this.paginator.getItem(2).should.equal(2);
        });

        it('can be replaced', function() {
            this.paginator.setItem(0, 'foo');
            this.paginator.getItem(0).should.equal('foo');
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
                    this.paginator.setItem(invalidPosition, 'anything');
                }.bind(this)).to.throw();
            });
        });
    });

    describe('expiration', function() {
        it('can be retrieved', function() {
            this.paginator.getExpires().should.equal(this.expires);
        });

        it('can be set', function() {
            this.paginator.setExpires(5000);
            this.paginator.getExpires().should.equal(5000);
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
                    this.paginator.setExpires(invalidExpires);
                }.bind(this)).to.throw();
            });
        });
    });

    describe('total', function() {
        it('can be retreived', function() {
            expect(this.paginator.getTotal()).to.be.undefined;
        });

        it('can be overwritten', function() {
            this.paginator.setTotal(100);
            this.paginator.getTotal().should.equal(100);
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
                    this.paginator.setTotal(invalidTotal);
                }.bind(this)).to.throw();
            });
        });
    });

    describe('limit', function() {
        it('can be retreived', function() {
            expect(this.paginator.getLimit()).to.be.undefined;
        });

        it('can be overwritten', function() {
            this.paginator.setLimit(10);
            this.paginator.getLimit().should.equal(10);
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
                    this.paginator.setLimit(invalidLimit);
                }.bind(this)).to.throw();
            });
        });
    });

    describe('offset', function() {
        it('can be retreived', function() {
            expect(this.paginator.getOffset()).to.be.undefined;
        });

        it('can be overwritten', function() {
            this.paginator.setOffset(10);
            this.paginator.getOffset().should.equal(10);
        });

        [
            {},
            [],
            -1,
            function() {},
            null,
            true,
            false
        ].forEach(function(invalidOffset) {
            it('throws an error if set to ' + JSON.stringify(invalidOffset), function() {
                expect(function() {
                    this.paginator.setOffset(invalidOffset);
                }.bind(this)).to.throw();
            });
        });
    });

    describe('.pop()', function() {
        it('returns the last item', function() {
            this.paginator.pop().should.equal(2);
        });

        it('removes the last item', function() {
            this.paginator.pop();
            this.paginator.getItems().should.deep.equal([0, 1]);
        });
    });

    describe('.push()', function() {
        it('adds the item to the end of the collection', function() {
            this.paginator.push('foo');
            this.paginator.getItems().should.deep.equal([0, 1, 2, 'foo']);
        });

        it('returns this', function() {
            this.paginator.push('anything').should.equal(this.paginator);
        });
    });

    describe('.shift()', function() {
        it('returns the last item', function() {
            this.paginator.shift().should.equal(0);
        });

        it('removes the first item', function() {
            this.paginator.shift();
            this.paginator.getItems().should.deep.equal([1, 2]);
        });
    });

    describe('.unshift()', function() {
        it('adds the item to the beginning of the collection', function() {
            this.paginator.unshift('foo');
            this.paginator.getItems().should.deep.equal(['foo', 0, 1, 2]);
        });

        it('returns this', function() {
            this.paginator.unshift('anything').should.equal(this.paginator);
        });
    });

    describe('stringification', function() {
        beforeEach(function() {
            this.paginator = new OffsetPaginator();
            this.objectify = function() {
                this.stringified = JSON.stringify(this.paginator);
                return JSON.parse(this.stringified);
            }.bind(this);
        });

        it('does not contain $id property if not set', function() {
            this.objectify().should.not.have.property('$id');
        });

        it('contains $id property if set', function() {
            this.paginator.setId('/foos')
            this.objectify().should.have.property('$id', '/foos');
        });

        it('does not contain $expires property if not set', function() {
            this.objectify().should.not.have.property('$expires');
        });

        it('contains $expires property', function() {
            this.paginator.setExpires(1000);
            this.objectify().should.have.property('$expires', 1000);
        });

        it('does not contain $total property if not specified', function() {
            this.objectify().should.not.have.property('total');
        });

        it('contains $total property if set', function() {
            this.paginator.setTotal(100);
            this.objectify().should.have.property('total', 100);
        });

        it('does not contain $limit property if not specified', function() {
            this.objectify().should.not.have.property('limit');
        });

        it('contains $limit property if set', function() {
            this.paginator.setLimit(10);
            this.objectify().should.have.property('limit', 10);
        });

        it('contains items property', function() {
            var objectified = this.objectify();
            objectified.should.have.property('items');
            objectified.items.should.be.an('array');
        });

        it('contains items specified in collection', function() {
            var items = [0, 1, 2];
            this.paginator.setItems(items);
            this.objectify().items.should.deep.equal(items);
        });
    });
});
