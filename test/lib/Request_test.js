var Request = require('../../lib/Request');
var Resource = require('../../lib/Resource');
var Busboy = require('busboy');
var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');

describe('Request', function() {
    it('is a constructor', function() {
        var request = new Request('/foo');
        request.should.be.instanceOf(Request);
    });

    describe('url', function() {
        describe('http://www.example.com/foo/bar?derp=doo', function() {
            beforeEach(function() {
                this.request = new Request('http://www.example.com/foo/bar?derp=doo');
            });

            [
                [ 'protocol', 'http:' ],
                [ 'slashes', true ],
                [ 'auth', null ],
                [ 'host', 'www.example.com' ],
                [ 'port', null ],
                [ 'hostname', 'www.example.com' ],
                [ 'hash', null ],
                [ 'search', '?derp=doo' ],
                [ 'query', { derp: 'doo' } ],
                [ 'pathname', '/foo/bar' ],
                [ 'path', '/foo/bar?derp=doo' ],
                [ 'href', 'http://www.example.com/foo/bar?derp=doo' ]
            ].forEach(function(data) {
                var expectedPropertyName = data[0];
                var expectedPropertyValue = data[1];

                it('parses url and extracts `' + expectedPropertyName + '` as ' + JSON.stringify(expectedPropertyValue), function() {
                    var url = this.request.getUrl();
                    url.should.be.an('object');

                    if (null === expectedPropertyValue) {
                        expect(url[expectedPropertyName]).to.be.null;
                    } else if (typeof expectedPropertyValue === 'object') {
                        url[expectedPropertyName].should.deep.equal(expectedPropertyValue);
                    } else {
                        url.should.have.property(expectedPropertyName, expectedPropertyValue);
                    }
                });
            });
        });
    });

    describe('method', function() {
        beforeEach(function() {
            this.request = new Request('/foo');
        });

        [
            'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS',
            'get', 'post', 'put', 'patch', 'delete', 'options'
        ].forEach(function(method) {
            it('can be set to ' + JSON.stringify(method), function() {
                this.request.setMethod(method);
                this.request.getMethod().should.equal(method.toUpperCase());
            });
        });

        ['INVALID', '', true, false, null, undefined, [], {}, 123, 1.23].forEach(function(method) {
            it('cannot be set to ' + JSON.stringify(method), function() {
                expect(function() {
                    this.request.setMethod(method);
                }.bind(this)).to.throw('Invalid method');
            });
        });
    });

    describe('params', function() {
        beforeEach(function() {
            this.request = new Request('/foo');
        });

        it('can be set and retrieved', function() {
            this.request.setParams({ foo: 'bar' });
            this.request.getParams().should.deep.equal({ foo: 'bar' });
        });

        it('can retrieve individual param', function() {
            this.request.setParams({ foo: 'bar' });
            this.request.getParam('foo').should.equal('bar');
        });

        it('returns undefined if param is not defined', function() {
            expect(this.request.getParam('derp')).to.be.undefined;
        });
    });

    describe('resourceId', function() {
        beforeEach(function() {
            this.request = new Request('/foo');
        });

        [123, 1.23, null, true, false, {}, []].forEach(function(badResourceId) {
            it('throws exception with invalid value ' + JSON.stringify(badResourceId), function() {
                expect(function() {
                    this.request.setResourceId(badResourceId);
                }.bind(this)).to.throw("Invalid resource id");
            });
        });

        it('can be set and retrieved', function() {
            this.request.setResourceId('/foo');
            this.request.getResourceId().should.equal('/foo');
        });

        it('is undefined by default', function() {
            expect(this.request.getResourceId()).to.be.undefined;
        });
    });

    describe('resource', function() {
        beforeEach(function() {
            this.request = new Request('/foo');
        });

        it('can be set and retrieved', function() {
            var resource = {
                foo: 'bar'
            };
            this.request.setResource(resource);
            this.request.getResource().should.equal(resource);
        });

        it('is undefined by default', function() {
            expect(this.request.getResourceId()).to.be.undefined;
        });
    });
});
