function HttpStatusCodes() {
    this._statuses = {
        // 1xx
        '100': 'CONTINUE',
        '101': 'SWITCHING PROTOCOLS',
        '102': 'PROCESSING',

        // 2xx
        '200': 'OK',
        '201': 'CREATED',
        '202': 'ACCEPTED',
        '203': 'NON-AUTHORITATIVE INFORMATION',
        '204': 'NO CONTENT',
        '205': 'RESET CONTENT',
        '206': 'PARTIAL CONTENT',
        '207': 'MULTI-STATUS',

        // 3xx
        '300': 'MULTIPLE CHOICES',
        '301': 'MOVED PERMANENTLY',
        '302': 'FOUND',
        '303': 'SEE OTHER',
        '304': 'NOT MODIFIED',
        '305': 'USE PROXY',
        '306': 'SWITCH PROXY',
        '307': 'TEMPORARY REDIRECT',
        '308': 'PERMANENT REDIRECT',

        // 4xx
        '400': 'BAD REQUEST',
        '401': 'UNAUTHORIZED',
        '402': 'PAYMENT REQUIRED',
        '403': 'FORBIDDEN',
        '404': 'NOT FOUND',
        '405': 'METHOD NOT ALLOWED',
        '406': 'NOT ACCEPTABLE',
        '407': 'PROXY AUTHENTICATION REQUIRED',
        '408': 'REQUEST TIMEOUT',
        '409': 'CONFLICT',
        '410': 'GONE',
        '411': 'LENGTH REQUIRED',
        '412': 'PRECONDITION FAILED',
        '413': 'PAYLOAD TOO LARGE',
        '414': 'URI TOO LONG',
        '415': 'UNSUPPORTED MEDIA TYPE',
        '416': 'RANGE NOT SATISFIABLE',
        '417': 'EXPECTATION FAILED',
        '418': 'I\'M A TEAPOT',
        '419': 'AUTHENTICATION TIMEOUT',
        '421': 'MISDIRECTED REQUEST',
        '422': 'UNPROCESSABLE ENTITY',
        '423': 'LOCKED',
        '424': 'FAILED DEPENDENCY',
        '426': 'UPGRADE REQUIRED',
        '428': 'PRECONDITION REQUIRED',
        '429': 'TOO MANY REQUESTS',
        '431': 'REQUEST HEADER FIELDS TOO LARGE',

        // 5xx
        '500': 'INTERNAL SERVER ERROR',
        '501': 'NOT IMPLEMENTED',
        '502': 'BAD GATEWAY',
        '503': 'SERVICE UNAVAILABLE',
        '504': 'GATEWAY TIMEOUT',
        '505': 'HTTP VERSION NOT SUPPORTED',
        '506': 'VARIANT ALSO NEGOTIATES',
        '507': 'INSUFFICIENT STORAGE',
        '508': 'LOOP DETECTED',
        '510': 'NOT EXTENDED',
        '511': 'NETWORK AUTHENTICATION REQUIRED',
        '520': 'UNKNOWN ERROR',
        '522': 'ORIGIN CONNECTION TIME-OUT'
    };
}

HttpStatusCodes.prototype.lookupByCode = function(code) {
    var strCode = (code || '').toString();

    return this._statuses.hasOwnProperty(strCode) ? this._statuses[strCode] : null;
};

HttpStatusCodes.prototype.getAll = function() {
    return this._statuses;
};

module.exports = HttpStatusCodes;
