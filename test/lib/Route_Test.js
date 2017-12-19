var Route = require('../../lib/Route');
var Request = require("../../lib/Request");

var fooSchema = {
    type: 'object',
    properties: {
        fooId: {type: 'integer'}
    }
};

describe("Route", () => {
    describe("getting supported props", () => {
        it("handles functions", () => {
            var route = Route.createRoute("/", fooSchema, {
                post: function () {}
            });

            route.getSupportedProps(Request.METHOD_POST).should.eql([])
        });

        it('handles an array of prop handlers', () => {
            var route = Route.createRoute("/", fooSchema, {
                post: [
                    {
                        props: ['cats', 'dogs'],
                        handler: function () {}
                    }
                ]
            });
            route.getSupportedProps(Request.METHOD_POST).should.eql(['cats', 'dogs'])
        });

        it('handles unsupported methods', () => {
            var route = Route.createRoute("/", fooSchema, {});
            route.getSupportedProps(Request.METHOD_POST).should.eql([])
        })
    });
    describe("Open Api Documentation", () => {
        it("has a route", () => {
            var route = Route.createRoute('/foo/:fooId', fooSchema, {
                get: [{
                    'props': ['cat'],
                    'handler': function () {}
                }],
                post: function () {}
            });

            return route.getOpenApiDocumentation().then((data) => {
                var fooData = data['/foo/{fooId}'];
                Object.keys(fooData).should.eql(['get', 'post']);
                fooData.get.parameters.length.should.be.equal(2);
                fooData.post.parameters.length.should.be.equal(1)
            });
        });

        it("can handle aliases", () => {
            var route = Route.createAlias('/bar', '/foo/123');

            return route.getOpenApiDocumentation().then((data) => {
                data.should.eql({
                    "/bar" : {}
                });
            });
        });

        it("can handle dynamic aliases", () => {
            var route = Route.createAlias('/me', function(request, connection) {
                request.setResourceId('/foo/456');
                return request;
            });

            return route.getOpenApiDocumentation().then((data) => {
                data.should.eql({
                    "/me": {}
                });
            });
        });

        it('handles all methods', () => {
            var route = Route.createRoute('/all-methods', fooSchema, {
                get: function() {},
                post: function() {},
                patch: function() {},
                put: function() {},
                delete: function() {}
            });

            return route.getOpenApiDocumentation().then((data) => {
                Object.keys(data['/all-methods']).should.eql(['get', 'post', 'patch', 'put', 'delete']);
            });
        });
    });
});
