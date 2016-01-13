var CollectionCache = require('../../lib/CollectionCache');
var Collection = require('../../lib/Collection');
var Request = require('../../lib/Request');
var Resource = require('../../lib/Resource');
var Symlink = require('../../lib/Symlink');

describe('CollectionCache', function() {
    it('is a function', function() {
        CollectionCache.should.be.a('function');
    });

    function suiteWeakEtagTests() {
        describe('id()', function() {
            it('returns a weak etag', function() {
                var etag = this.collectionCache.id();
                etag.should.match(/W\/"[0-9a-f]+"/);
            });

            it('generates the same etag on multiple calls', function() {
                var etag1 = this.collectionCache.id();
                var etag2 = this.collectionCache.id();
                etag1.should.equal(etag2);
            });

            it('generates a new etag if the order of items changes', function() {
                var etag1 = this.collectionCache.id();
                this.collection.push(this.collection.shift());
                var etag2 = this.collectionCache.id();
                etag1.should.not.equal(etag2);
            });

            it('generates a new etag if a new item is added to the collection', function() {
                var etag1 = this.collectionCache.id();
                this.collection.push({ $id: '/users/4' });
                var etag2 = this.collectionCache.id();
                etag1.should.not.equal(etag2);
            });

            it('generates a new etag if an item is removed from the collection', function() {
                var etag1 = this.collectionCache.id();
                this.collection.pop();
                var etag2 = this.collectionCache.id();
                etag1.should.not.equal(etag2);
            });

            it('generates the same etag if the props are specified in a different order', function() {
                var etag1 = this.collectionCache.id();
                var request2 = new Request('/users?props=@age,@name&offset=0&limit=10');
                var collectionCache2 = new CollectionCache(this.collection, request2);
                var etag2 = this.collectionCache.id();
                etag1.should.equal(etag2);
            });

            it('generates a new etag if different props are requested', function() {
                var etag1 = this.collectionCache.id();
                var request2 = new Request('/users?props=@photo,@location&offset=0&limit=10');
                var collectionCache2 = new CollectionCache(this.collection, request2);
                var etag2 = this.collectionCache.id();
                etag1.should.equal(etag2);
            });

            it('generates the same etag if the the query string parameters are specified in a different order', function() {
                var etag1 = this.collectionCache.id();
                var request2 = new Request('/users?props=@name,@age&limit=10&offset=0');
                var collectionCache2 = new CollectionCache(this.collection, request2);
                var etag2 = this.collectionCache.id();
                etag1.should.equal(etag2);
            });

            it('generates a new etag if different query string parameters are requested', function() {
                var etag1 = this.collectionCache.id();
                var request2 = new Request('/users?props=@name,@age&offset=10&limit=10');
                var collectionCache2 = new CollectionCache(this.collection, request2);
                var etag2 = this.collectionCache.id();
                etag1.should.equal(etag2);
            });

            it('generates the same weak etag if the data of an item changes', function() {
                var etag1 = this.collectionCache.id();
                this.collection.getItem(0).anything = 'test anything';
                var etag2 = this.collectionCache.id();
                etag1.should.equal(etag2);
            });
        });
    }

    function suiteIsValidTests() {
        describe('isValid()', function() {
            it('is true for matching etag', function() {
                var etag = this.collectionCache.id();
                this.collectionCache.isValid(etag).should.be.true;
            });

            it('is false for none-matching etag', function() {
                var etag = 'W/"anything"';
                this.collectionCache.isValid(etag).should.be.false;
            });

            it('is false for falsy values', function() {
                var etag = false;
                this.collectionCache.isValid(etag).should.be.false;
            });

            it('is false for non-weak etag', function() {
                var etag = '"anything"';
                this.collectionCache.isValid(etag).should.be.false;
            });
        });
    }

    describe('with collection of resources', function() {
        beforeEach(function() {
            this.collection = new Collection('/users', [
                // items are intentionally not in order
                new Resource('/users/2', {}, 60000),
                new Resource('/users/3', {}, 60000),
                new Resource('/users/1', {}, 60000)
            ], 1000);

            this.request = new Request('/users?props=@name,@age&offset=0&limit=10');
            this.collectionCache = new CollectionCache(this.collection, this.request);
        });

        suiteWeakEtagTests();
        suiteIsValidTests();
    });

    describe('with collection of symlinks', function() {
        beforeEach(function() {
            this.collection = new Collection('/users', [
                // items are intentionally not in order
                new Symlink('/users/2'),
                new Symlink('/users/3'),
                new Symlink('/users/1')
            ], 1000);

            this.request = new Request('/users?props=@name,@age&offset=0&limit=10');
            this.collectionCache = new CollectionCache(this.collection, this.request);
        });

        suiteWeakEtagTests();
        suiteIsValidTests();
    });

    describe('with collection of objects that have no identity', function() {
        beforeEach(function() {
            this.collection = new Collection('/users', [
                // items are intentionally not in order
                {foo: 'test foo 2'},
                {foo: 'test foo 3'},
                {foo: 'test foo 1'}
            ], 1000);

            this.request = new Request('/users?props=@name,@age&offset=0&limit=10');
            this.collectionCache = new CollectionCache(this.collection, this.request);
        });

        describe('id()', function() {
            it('returns false', function() {
                this.collectionCache.id().should.be.false;
            });
        });

        describe('isValid()', function() {
            it('returns false', function() {
                var etag = 'W/"anything"';
                this.collectionCache.isValid(etag).should.be.false;
            });
        });
    });
});
