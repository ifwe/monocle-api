var Request = require('./Request');
var debug = require('debug')('monocle-api:connection');
var querystring = require('querystring');

module.exports = Connection;

// A Connection object holds a Router instance, and raw HTTP request and response object.
// It can be used to initiate another request.
function Connection(router, req, res) {
    this.router = router;
    this.raw = {
        req: req,
        res: res
    };
    // TODO: promote this to an LRU cache
    this._cache = {};
}

// Support various HTTP methods by calling Router's handle method.
[
    Request.METHOD_GET,
    Request.METHOD_POST,
    Request.METHOD_PUT,
    Request.METHOD_PATCH,
    Request.METHOD_DELETE,
    Request.METHOD_OPTIONS
].forEach(function(method) {
    Connection.prototype[method.toLowerCase()] = function (resourceId, options) {
        debug('Incoming request', method, resourceId, options)
        var request = new Request(resourceId);
        request.setResourceId(resourceId);
        request.setMethod(method);

        if (options) {
            if (options.props) request.setProps(options.props);
            if (options.resource) request.setResource(options.resource);

            if (options.query) {
                request.setQueries(options.query);
            }
        }

        // Cache similar GET requests
        if (method.toLowerCase() === Request.METHOD_GET.toLowerCase()) {
            var cacheKey = Request.METHOD_GET + ':' + resourceId + '?props=' + request.getProps().join(',');
            cacheKey += '&' + querystring.stringify(request.getQueries());
            debug('GET cache key', cacheKey);
            if (this._cache.hasOwnProperty(cacheKey)) {
                debug('Found similar GET request, using cached promise')
                return this._cache[cacheKey];
            }

            this._cache[cacheKey] = this.router.handle(request, this); // pass self to router's handler
            return this._cache[cacheKey];
        }

        return this.router.handle(request, this); // pass self to router's handler
    }
});
