var Router = require('../../lib/Router');
var Request = require('../../lib/Request');
var RequestRouter = require('../../lib/RequestRouter');

var Resource = require('../../lib/Resource');
var OffsetPaginator = require('../../lib/OffsetPaginator');
var Connection = require('../../lib/Connection');
var Symlink = require('../../lib/Symlink');
var HttpStatusCodes = require('../../lib/HttpStatusCodes');
var Promise = require('bluebird');
var jsen = require('jsen');
var errorSchema = require('../../lib/schemas/error');

describe('API Router', function() {
    it('is a constructor', function() {
        var router = new Router();
        router.should.be.instanceOf(Router);
    });

    describe('simple routing', function() {
        beforeEach(function() {
            this.router = new Router();

            this.connection = new Connection(this.router, {}, {});

            this.clock = sinon.useFakeTimers(10000000);

            // Set up "/foo/:fooId" resource -- sync
            this.fooSchema = {
                type: 'object',
                properties: {
                    fooId: { type: 'integer' },
                    foo: { type: 'string' },
                    nullable: { type: ['string', 'null'] },
                    param1: { type: ['integer', 'null'] },
                    param2: { type: 'string' },
                    param3: { type: 'string', enum: ['val1', 'val2'] },
                    param4: { type: 'integer', enum: [2, 3] },
                    param5: { type: ['integer', 'null'] },
                    boolParam: { type: 'boolean' }
                }
            };
            this.getFooSpy = sinon.spy(function(request, connection) {
                return {
                    foo: 'test foo',
                    nullable: null
                };
            });
            this.router.route('/foo/:fooId', this.fooSchema, {
                get: this.getFooSpy
            });

            // Set up "/bar/:barId" resource -- async
            this.getBarSpy = sinon.spy(function(request, connection) {
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        resolve({
                            bar: 'test bar'
                        });
                    }, 1000);
                });
            });
            this.barSchema = {
                type: 'object',
                properties: {
                    barId: { type: 'integer' },
                    bar: { type: 'string' }
                }
            };
            this.router.route('/bar/:barId', this.barSchema, {
                get: this.getBarSpy
            });
        });

        afterEach(function() {
            this.clock.restore();
        });

        describe('connects to a resource with get parameters', function() {
            beforeEach(function() {
                this.getParamsFoo = sinon.spy(function(request, connection) {
                    var result =  {
                        id_query: request.getQuery('fooId'),
                        id_param: request.getQuery('fooId'),
                        param1: request.getQuery('param1'),
                        param2: request.getQuery('param2'),
                        param3: request.getQuery('param3'),
                        param4: request.getQuery('param4'),
                        param5: request.getQuery('param5'),
                        boolParam: request.getQuery('boolParam'),
                    };

                    return result;
                });
            });

            describe('optional parameter in route', function() {
                beforeEach(function() {
                    this.url = '/foo/:fooId/test/:param1?';

                    this.meeSchema = {
                        type: 'object',
                        properties: {
                            fooId: { type: 'integer' },
                            param1: { type: ['string', 'null'] }
                        }
                    };
                    this.getParamsMee = sinon.spy(function(request, connection) {
                        return {
                            fooId: request.getParam('fooId'),
                            param1: request.getParam('param1')
                        };
                    });
                })

                it('returns optional param1 as null if not passed in url', function() {
                    this.router.route([this.url, 'param1'], this.meeSchema, {
                        get: this.getParamsMee
                    });
                    return this.connection.get('/foo/123/test', {
                      query: { }
                    })
                    .then(function(foo) {
                        foo.should.deep.equal({
                            fooId: 123,
                            param1: null
                        });
                    }.bind(this));
                });

                it('returns optional param1 value', function() {
                    this.router.route([this.url, 'param1'], this.meeSchema, {
                        get: this.getParamsMee
                    });
                    return this.connection.get('/foo/123/test/33', {
                      query: { }
                    })
                    .then(function(foo) {
                        foo.should.deep.equal({
                            fooId: 123,
                            param1: '33'
                        });
                    }.bind(this));
                });
            });

            it('resolves with object from callback with route having a parameter in the middle of the url', function() {
                this.router.route(['/foo/:fooId/test', 'param1&param2&param3&param4&param5&boolParam'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/123/test', {
                  query: { param1: 1, param2: 'test', param3: 'val1', param4: 2, param5: null, boolParam: 'true' }
                })
                .then(function(foo) {
                    foo.should.deep.equal({
                        id_query: 123,
                        id_param: 123,
                        param1: 1,
                        param2: 'test',
                        param3: 'val1',
                        param4: 2,
                        param5: null,
                        boolParam: true
                    });
                }.bind(this));
            });

            it('resolves with object from callback with route having a parameter in end of the url', function() {
                this.router.route(['/foo/test/:fooId', 'param1&param2&param3&boolParam'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                  query: { param1: 1, param2: 'test', boolParam: true }
                })
                .then(function(foo) {
                    foo.should.deep.equal({
                        id_query: 123,
                        id_param: 123,
                        param1: 1,
                        param2: 'test',
                        boolParam: true
                    });
                }.bind(this));
            });

            describe('objects', function() {
                beforeEach(function() {
                    this.meeSchema = {
                        type: 'object',
                        properties: {
                            meeId: {type: 'integer'},
                            objectParam1:
                                {
                                    type: 'object',
                                    properties:
                                        {
                                            enuminteg: {type: 'integer', enum: [1, 2, 4]},
                                            integ: {type: 'integer'},
                                            str : {type: 'string'}
                                        }
                                }
                        }
                    };


                    this.getParamsMee = sinon.spy(function(request, connection) {
                        var result =  {
                            objectParam1: request.getQuery('objectParam1')
                        };

                        return result;
                    });
                });

                it('resolves with object from callback with route having parameters that are enum, integer and string', function() {
                    this.router.route(['/mee/test', 'objectParam1{}'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    var pasedObject = {enuminteg: 2, integ: '3', str: 'dsdsds'};

                    return this.connection.get('/mee/test', {
                      query: { 'objectParam1{}' : pasedObject }
                    })
                    .then(function(mee) {
                        mee.should.deep.equal({
                            objectParam1: {enuminteg: 2, integ: 3, str: 'dsdsds'}
                        });
                    }.bind(this))
                });

                it('throws an error when parameter of type enum integer items does not validate', function() {
                    this.router.route(['/mee/test', 'objectParam1{}'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    var pasedObject = {enuminteg: 22};

                    return this.connection.get('/mee/test', {
                      query: { 'objectParam1{}' : pasedObject }
                    })
                    .then(function(foo) {
                        return Promise.reject("Not expecting an error");
                    }.bind(this))
                    .catch(function(error) {
                        error.should.be.ok;
                        error.should.have.property('code', 422);
                        error.properties[0].should.have.property('code', 110);
                        error.properties[0].property.should.equal('objectParam1.enuminteg');
                    });
                });

                it('throws an error when query is not an object', function() {
                    this.router.route(['/mee/test', 'objectParam1{}'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    return this.connection.get('/mee/test', {
                      query: { 'objectParam1{}' : 1234 }
                    })
                    .then(function(foo) {
                        return Promise.reject("Not expecting an error");
                    }.bind(this))
                    .catch(function(error) {
                        error.should.be.ok;
                        error.should.have.property('code', 422);
                        error.properties[0].should.have.property('code', 105);
                        error.properties[0].property.should.equal('objectParam1');
                    });
                });

                it('throws an error when query is not a valid JSON object', function() {
                    this.router.route(['/mee/test', 'objectParam1{}'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    return this.connection.get('/mee/test', {
                      query: { 'objectParam1{}' : '{dsds: 123}' }
                    })
                    .then(function(foo) {
                        return Promise.reject("Not expecting an error");
                    }.bind(this))
                    .catch(function(error) {
                        error.should.be.ok;
                        error.should.have.property('code', 422);
                        error.properties[0].should.have.property('code', 105);
                        error.properties[0].property.should.equal('objectParam1');
                    });
                });
            });

            describe('float', function() {
                beforeEach(function() {
                    this.meeSchema = {
                        type: 'object',
                        properties: {
                            floatParam: {type: 'float'}
                        }
                    };

                    this.getParamsMee = sinon.spy(function(request, connection) {
                        var result =  {
                            floatParam: request.getQuery('floatParam')
                        };

                        return result;
                    });
                });

               [
                    ['2.3', 2.3],
                    [2.4, 2.4],
                    [1, 1],
                    ['-.3', -0.3],
                    ['.3', 0.3],
                    [-2.3, -2.3]
                ]
                .forEach(function(data) {
                    it('resolves with object from callback with route having a parameter that is valid '+data[0], function() {
                        this.router.route(['/mee/test', 'floatParam'], this.meeSchema, {
                            get: this.getParamsMee
                        });

                        return this.connection.get('/mee/test', {
                          query: { 'floatParam' : data[0] }
                        })
                        .then(function(mee) {
                            mee.should.deep.equal({
                                floatParam: data[1]
                            });
                        }.bind(this))
                    });

                });

               [
                    ['1.2.3'],
                    ['.'],
                    ['as123.3'],
                    ['12aa']
                ]
                .forEach(function(data) {
                    it('throws an error when parameter does not validate '+data[0], function() {
                            this.router.route(['/mee/test', 'floatParam'], this.meeSchema, {
                                get: this.getParamsMee
                            });

                        return this.connection.get('/mee/test', {
                          query: { 'floatParam' : data[0] }
                        })
                        .then(function(foo) {
                            return Promise.reject("Not expecting an error");
                        }.bind(this))
                        .catch(function(error) {
                            error.should.be.ok;
                            error.should.have.property('code', 422);
                            error.properties[0].should.have.property('code', 105);
                        });
                    });
                });

            });

            describe('arrays', function() {
                beforeEach(function() {
                    this.meeSchema = {
                        type: 'object',
                        properties: {
                            meeId: {type: 'integer'},
                            arrayParam1: { type: 'array', items: {type: ['string']} },
                            arrayParam2: { type: 'array', items: {type: ['integer', 'null'], enum: [1, 2, 3, 4]} }

                        }
                    };

                    this.getParamsMee = sinon.spy(function(request, connection) {
                        var result =  {
                            arrayParam1: request.getQuery('arrayParam1'),
                            arrayParam2: request.getQuery('arrayParam2')

                        };

                        return result;
                    });
                });

                it('resolves with object from callback with route having a parameter that is an array of string items', function() {
                    this.router.route(['/mee/test', 'arrayParam1[]'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    var passedArray = ['yoo', 'wassup'];

                    return this.connection.get('/mee/test', {
                      query: { 'arrayParam1[]' : passedArray }
                    })
                    .then(function(mee) {
                        mee.should.deep.equal({
                            arrayParam1: passedArray
                        });
                    }.bind(this))
                });

                it('resolves with object from callback with route having a parameter that is an array of enum integer items', function() {
                    this.router.route(['/mee/test', 'arrayParam2[]'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    var passedArray = ['1', 4];

                    return this.connection.get('/mee/test', {
                      query: { 'arrayParam2[]' : passedArray }
                    })
                    .then(function(mee) {
                        mee.should.deep.equal({
                            arrayParam2: [1, 4]
                        });
                    }.bind(this))
                });

                it('throws an error when parameter of type enum integer items does not validate', function() {
                    this.router.route(['/mee/test', 'arrayParam2[]'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    var passedArray = [1, 14];

                    return this.connection.get('/mee/test', {
                      query: { 'arrayParam2[]' : passedArray }
                    })
                    .then(function(foo) {
                        return Promise.reject("Not expecting an error");
                    }.bind(this))
                    .catch(function(error) {
                        error.should.be.ok;
                        error.should.have.property('code', 422);
                        error.properties[0].should.have.property('code', 110);
                    });
                });

                it('throws an error when query is not an array', function() {
                    this.router.route(['/mee/test', 'arrayParam2[]'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    var passedArray = 123;

                    return this.connection.get('/mee/test', {
                      query: { 'arrayParam2[]' : passedArray }
                    })
                    .then(function(foo) {
                        return Promise.reject("Not expecting an error");
                    }.bind(this))
                    .catch(function(error) {
                        error.should.be.ok;
                        error.should.have.property('code', 422);
                        error.properties[0].should.have.property('code', 105);
                    });
                });
            });

            describe('param having multiple types', function() {
                beforeEach(function() {
                    this.meeSchema = {
                        type: 'object',
                        properties: {
                            paramIntAndBool: {type: ['integer', 'boolean']},
                            paramIntAndFloat: {type: ['integer', 'float']},
                            paramStringAndBooleanAndInt: {type: ['integer', 'string', 'boolean']},
                            paramArrayAndString: {type: ['array', 'string'], items: {type: 'integer'}},
                            paramArrayAndObject: {type: ['object', 'string'], properties: { test: {type: 'integer'}}}
                        }
                    };

                    this.getParamsMee = sinon.spy(function(request, connection) {
                        var result =  {
                            paramIntAndBool: request.getQuery('paramIntAndBool'),
                            paramIntAndFloat: request.getQuery('paramIntAndFloat'),
                            paramStringAndBooleanAndInt: request.getQuery('paramStringAndBooleanAndInt'),
                            paramArrayAndString: request.getQuery('paramArrayAndString'),
                            paramArrayAndObject: request.getQuery('paramArrayAndObject')

                        };

                        return result;
                    });
                });

                it('does not throw error if param is a string with type string and array', function() {
                    this.router.route(['/mee/test', 'paramArrayAndString'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    return this.connection.get('/mee/test', {
                      query: { paramArrayAndString: 'yoo'}
                    })
                    .then(function(foo) {
                        foo.should.deep.equal({
                            paramArrayAndString: 'yoo'
                        });
                    }.bind(this));
                });

                it('does not throw error if param is an array with type string and array', function() {
                    this.router.route(['/mee/test', 'paramArrayAndString[]'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    return this.connection.get('/mee/test', {
                      query: { 'paramArrayAndString[]': ['1']}
                    })
                    .then(function(foo) {
                        foo.should.deep.equal({
                            paramArrayAndString: [1]
                        });
                    }.bind(this));
                });

                it('does not throw error if param is a string with type string and object', function() {
                    this.router.route(['/mee/test', 'paramArrayAndObject'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    return this.connection.get('/mee/test', {
                      query: { paramArrayAndObject: 'yoo'}
                    })
                    .then(function(foo) {
                        foo.should.deep.equal({
                            paramArrayAndObject: 'yoo'
                        });
                    }.bind(this));
                });

                it('does not throw error if param is an object with type string and object', function() {
                    this.router.route(['/mee/test', 'paramArrayAndObject{}'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    return this.connection.get('/mee/test', {
                      query: { 'paramArrayAndObject{}': {test: 1}}
                    })
                    .then(function(foo) {
                        foo.should.deep.equal({
                            paramArrayAndObject: {test: 1}
                        });
                    }.bind(this));
                });


                it('does not throw error if param is a boolean with type int and boolean', function() {
                    this.router.route(['/mee/test', 'paramIntAndBool'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    return this.connection.get('/mee/test', {
                      query: { paramIntAndBool: true}
                    })
                    .then(function(foo) {
                        foo.should.deep.equal({
                            paramIntAndBool: true
                        });
                    }.bind(this));
                });

                it('does not throw error if param is an integer with type int and boolean', function() {
                    this.router.route(['/mee/test', 'paramIntAndBool'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    return this.connection.get('/mee/test', {
                      query: { paramIntAndBool: '12'}
                    })
                    .then(function(foo) {
                        foo.should.deep.equal({
                            paramIntAndBool: 12
                        });
                    }.bind(this));
                });

                it('throws an error if param is a string with type int and boolean', function() {
                    this.router.route(['/mee/test', 'paramIntAndBool'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    return this.connection.get('/mee/test', {
                      query: { paramIntAndBool: '123not an integer' }
                    })
                    .then(function(foo) {
                        return Promise.reject("Not expecting an error");
                    }.bind(this))
                    .catch(function(error) {
                        error.should.be.ok;
                        error.should.have.property('code', 422);
                        error.properties[0].should.have.property('code', 105);
                    });
                });

                it('does not throw error if param is an integer with type int and float', function() {
                    this.router.route(['/mee/test', 'paramIntAndFloat'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    return this.connection.get('/mee/test', {
                      query: { paramIntAndFloat: 12}
                    })
                    .then(function(foo) {
                        foo.should.deep.equal({
                            paramIntAndFloat: 12
                        });
                    }.bind(this));
                });

                it('does not throw error if param is a float with type int and float', function() {
                    this.router.route(['/mee/test', 'paramIntAndFloat'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    return this.connection.get('/mee/test', {
                      query: { paramIntAndFloat: '12.233'}
                    })
                    .then(function(foo) {
                        foo.should.deep.equal({
                            paramIntAndFloat: 12.233
                        });
                    }.bind(this));
                });

                it('does not throw error if param is a string with type int, boolean and string', function() {
                    this.router.route(['/mee/test', 'paramStringAndBooleanAndInt'], this.meeSchema, {
                        get: this.getParamsMee
                    });

                    return this.connection.get('/mee/test', {
                      query: { paramStringAndBooleanAndInt: 'yooo'}
                    })
                    .then(function(foo) {
                        foo.should.deep.equal({
                            paramStringAndBooleanAndInt: 'yooo'
                        });
                    }.bind(this));
                });
            });

            it('excludes query string parameters that are not defined on the route', function() {
                this.router.route(['/foo/test/:fooId', 'param1'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                  query: { param1: 1, param2: 'test' }
                })
                .then(function(foo) {
                    foo.should.deep.equal({
                        id_query: 123,
                        id_param: 123,
                        param1: 1
                    });
                }.bind(this));
            });

            it('throws an error when query string parameter of type integer does not validate', function() {
                this.router.route(['/foo/test/:fooId', 'param1'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                  query: { param1: 'not an integer' }
                })
                .then(function(foo) {
                    return Promise.reject("Not expecting an error");
                }.bind(this))
                .catch(function(error) {
                    error.should.be.ok;
                    error.should.have.property('code', 422);
                    error.properties[0].should.have.property('code', 105);
                });
            });

            it('throws an error when parameter is set to null and type is not null', function() {
                this.router.route(['/foo/test/:fooId', 'param4'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                  query: { param4: null }
                })
                .then(function(foo) {
                    return Promise.reject("Not expecting an error");
                }.bind(this))
                .catch(function(error) {
                    console.log(error);
                    error.should.be.ok;
                    error.should.have.property('code', 422);
                    error.properties[0].should.have.property('code', 105);
                });
            });

            it('throws multiple errors when multiple parameters do not validate', function() {
                this.router.route(['/foo/test/:fooId', 'param1&param5'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                  query: { param1: 'not an integer', param5: 'not an integer' }
                })
                .then(function(foo) {
                    return Promise.reject("Not expecting an error");
                }.bind(this))
                .catch(function(error) {
                    error.should.be.ok;
                    error.should.have.property('code', 422);
                    error.properties[0].should.have.property('code', 105);
                    error.properties[0].should.have.property('property', 'param1');
                    error.properties[1].should.have.property('property', 'param5');
                    error.properties.length.should.equal(2);
                });
            });

            it('throws an error when query string parameter of type boolean does not validate', function() {
                this.router.route(['/foo/test/:fooId', 'boolParam'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                    query: { boolParam: 'not an boolean' }
                 })
                .then(function(foo) {
                    return Promise.reject("Not expecting an error");
                }.bind(this))
                .catch(function(error) {
                    error.should.be.ok;
                    error.should.have.property('code', 422);
                    error.properties[0].should.have.property('code', 105);
                });

            });

            it('throws an error when query string parameter does not validate against available enum values', function() {
                this.router.route(['/foo/test/:fooId', 'param3'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                        query: { param3: 'not a valid enum value' }
                    })
                    .then(function(foo) {
                        return Promise.reject("Not expecting an error");
                    }.bind(this))
                    .catch(function(error) {
                        error.should.be.ok;
                        error.should.have.property('code', 422);
                        error.properties[0].should.have.property('code', 110);
                    });
            });

            it('throws an error when query integer parameter does not validate against array value', function() {
                this.router.route(['/foo/test/:fooId', 'param4'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                        query: { param4: [44] }
                    })
                    .then(function(foo) {
                        return Promise.reject("Not expecting an error");
                    }.bind(this))
                    .catch(function(error) {
                        error.should.be.ok;
                        error.should.have.property('code', 422);
                        error.properties[0].should.have.property('code', 110);
                    });
            });

            it('throws an error when query integer parameter does not validate against object value', function() {
                this.router.route(['/foo/test/:fooId', 'param4'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                        query: { param4: {'dsds': 3} }
                    })
                    .then(function(foo) {
                        return Promise.reject("Not expecting an error");
                    }.bind(this))
                    .catch(function(error) {
                        error.should.be.ok;
                        error.should.have.property('code', 422);
                        error.properties[0].should.have.property('code', 110);
                    });
            });

            it('throws an error when query integer parameter does not validate against available enum values', function() {
                this.router.route(['/foo/test/:fooId', 'param4'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                        query: { param4: 44 }
                    })
                    .then(function(foo) {
                        return Promise.reject("Not expecting an error");
                    }.bind(this))
                    .catch(function(error) {
                        error.should.be.ok;
                        error.should.have.property('code', 422);
                        error.properties[0].should.have.property('code', 110);
                    });
            });


            it('uses default value if not provided in request for type integer only', function() {
                this.router.route(['/foo/test/:fooId', 'param1=123'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                  query: { /* empty */ }
                })
                .then(function(foo) {
                    foo.should.have.property('param1', 123);
                }.bind(this));
            });

            it('does not use default value if param passed in is set to 0', function() {
                this.router.route(['/foo/test/:fooId', 'param1=123'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                  query: { param1: 0 }
                })
                .then(function(foo) {
                    foo.should.have.property('param1', 0);
                }.bind(this));
            });

            it('uses default value if not provided in request for property having both types: integer and null', function() {
                this.router.route(['/foo/test/:fooId', 'param5=123'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                  query: { /* empty */ }
                })
                .then(function(foo) {
                    foo.should.have.property('param5', 123);
                }.bind(this));
            });

            it('uses `undefined` value if query not provided in request and no default is set in the router route', function() {
                this.router.route(['/foo/test/:fooId', 'param1&param2'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123', {
                  query: { /* empty */ }
                })
                .then(function(foo) {
                    expect(foo.param1).to.be.undefined;
                    expect(foo.param2).to.be.undefined;
                }.bind(this));
            });

            it('uses `undefined` value if no options provided in request and no default', function() {
                this.router.route(['/foo/test/:fooId', 'param1&param2'], this.fooSchema, {
                    get: this.getParamsFoo
                });

                return this.connection.get('/foo/test/123')
                .then(function(foo) {
                    expect(foo.param1).to.be.undefined;
                    expect(foo.param2).to.be.undefined;
                }.bind(this));
            });

        });

        describe('calls associated callbacks', function() {
            it(' and connection objects with get method being a function', function(done) {
                this.connection.get('/foo/123')
                .then(function(foo) {
                    this.getFooSpy.called.should.be.true;
                    var requestRouter = this.getFooSpy.lastCall.args[0];

                    requestRouter.should.be.instanceOf(RequestRouter);
                    requestRouter.getParam('fooId').should.equal(123);

                    var connection = this.getFooSpy.lastCall.args[1];
                    connection.should.be.instanceOf(Connection);
                }.bind(this))
                .finally(done);
            });

            describe('with array of handlers', function() {
                beforeEach(function() {
                    this.getTeeSpy = sinon.spy(function(request, connection) {
                        return {
                            tee: 'test tee',
                            nullable: null
                        };
                    });


                    this.patchFooSpy = sinon.spy(function(request, connection) {
                        return {
                            tee: 'test foo',
                            nullable: null
                        };
                    });


                    this.patchTeeSpy = sinon.spy(function(request, connection) {
                        return {
                            tee: 'test tee',
                            nullable: null
                        };
                    });

                    //Add property to fooSchema
                    this.fooSchema.properties.tee = { type: 'string' }
                    this.router.route('/multiple-handlers/:fooId', this.fooSchema, {
                        get: [
                            {
                                props: ['foo'],
                                callback: this.getFooSpy
                            },
                            {
                                props: ['bar'],
                                callback: this.getTeeSpy
                            }
                        ],

                        patch: [
                            {
                                props: ['foo'],
                                callback: this.patchFooSpy
                            },
                            {
                                props: ['tee'],
                                callback: this.patchTeeSpy
                            }

                        ],

                        put: [
                            {
                                props: ['foo'],
                                callback: this.patchFooSpy
                            },
                            {
                                props: ['tee'],
                                callback: this.patchTeeSpy
                            }

                        ]
                    });
                });

                describe('GET method', function() {
                    it('calls all functions if no props are requested', function() {
                        this.connection.get('/multiple-handlers/123')
                        .then(function(foo) {
                            this.getTeeSpy.called.should.be.true;
                            this.getFooSpy.called.should.be.true;
                        }.bind(this))
                    });

                    it('calls associated function with props passed in', function() {
                        this.connection.get('/multiple-handlers/123', {props: ['foo']})
                        .then(function(foo) {
                            this.getTeeSpy.called.should.be.false;
                            this.getFooSpy.called.should.be.true;
                        }.bind(this))
                    });
                });

                describe('PATCH method', function() {
                    it('calls associated function with resource passed in', function() {
                        this.resource = {
                            resource: {
                                'tee': 'yoo'
                            }
                        }
                        this.connection.patch('/multiple-handlers/123', this.resource)
                        .then(function(foo) {
                            this.patchTeeSpy.called.should.be.true;
                            this.patchFooSpy.called.should.be.false;
                        }.bind(this))
                    });
                    it('does not call any function if resource is empty', function() {
                        this.resource = {
                            resource: {

                            }
                        }
                        this.connection.patch('/multiple-handlers/123', this.resource)
                        .then(function(foo) {
                            this.patchTeeSpy.called.should.be.false;
                            this.patchFooSpy.called.should.be.false;
                        }.bind(this))
                    });
                });

                describe('PUT method', function() {
                    it('calls associated function with resource passed in', function() {
                        this.resource = {
                            resource: {
                                'tee': 'yoo'
                            }
                        }
                        this.connection.put('/multiple-handlers/123', this.resource)
                        .then(function(foo) {
                            this.patchTeeSpy.called.should.be.true;
                            this.patchFooSpy.called.should.be.false;
                        }.bind(this))
                    });
                    it('does not call any function if resource is empty', function() {
                        this.resource = {
                            resource: {

                            }
                        }
                        this.connection.put('/multiple-handlers/123', this.resource)
                        .then(function(foo) {
                            this.patchTeeSpy.called.should.be.false;
                            this.patchFooSpy.called.should.be.false;
                        }.bind(this))
                    });
                });
            });
        });

        it('resolves with object from callback', function(done) {
            this.connection.get('/foo/123')
            .then(function(foo) {
                foo.should.deep.equal({
                    foo: 'test foo',
                    nullable: null
                });
            }.bind(this))
            .finally(done);
        });

        it('supports async callbacks via promises', function(done) {
            this.connection.get('/bar/123')
            .then(function(bar) {
                bar.should.deep.equal({
                    bar: 'test bar'
                });
            }.bind(this))
            .finally(done);
            this.clock.tick(1000);
        });

        it('throws error if schema is invalid', function() {
            expect(function() {
                this.router.route('/invlid', {
                    type: 'object',
                    properties: 'invalid' // expecting an object
                }, {
                    get: function() {/* empty */}
                });
            }.bind(this)).to.throw();
        });

        describe('delete', function() {
            beforeEach(function() {
                this.deletableSchema = {
                    type: 'object',
                    properties: {
                        foo: {
                            type: 'string'
                        }
                    },
                };

                this.router.route('/deletable-fail', this.deletableSchema, {
                    delete: function() {
                        return {
                            foo: 123
                        };
                    }
                });

                this.router.route('/deletable-success', this.deletableSchema, {
                    delete: function() {
                        return {
                            foo: 'hello'
                        };
                    }
                });
            });

            it('compares response with schema and fails validation', function() {
                return this.connection.delete('/deletable-fail')
                .then(function(error) {
                    return Promise.reject('Did not expect success');
                })
                .catch(function(error) {
                    error.message.should.equal('Return value did not validate with schema');
                }.bind(this));
            });

            it('compares response with schema and passes validation', function() {
                return this.connection.delete('/deletable-success')
                .then(function(response) {
                    response.foo.should.equal('hello');
                })
            });
        });

        describe('post', function() {
            beforeEach(function() {
                this.postSchema = {
                    type: 'object',
                    properties: {
                        param2: {
                            type: 'object',
                            properties: {
                                obj1: {type: 'string'},
                                obj2: {type: 'integer'}
                            }
                        },
                        param3: {
                            type: 'array',
                            items: {
                                type: 'string',
                                enum: ['hola']
                            }
                        },
                        param4: {type: 'integer'},
                        param5: {type: 'date-time'}
                    }
                };
                this.postObjSpy = sinon.spy(function(request, connection) {
                    var resource = request.getResource();
                    return {
                        param2: resource.param2,
                        param3: resource.param3,
                        param5: resource.param5
                    };
                });
                this.router.route('/postit', this.postSchema, {
                    post: this.postObjSpy
                });
            });

            describe('to collection', function() {
                beforeEach(function() {
                    this.collectionSchema = {
                        type: 'object',
                        properties: {
                            items: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        foo: { type: 'string' },
                                        bar: { type: 'string' }
                                    }
                                }
                            }
                        }
                    };

                    this.postSpy = sinon.spy(function(request, params) {
                        return { $httpStatus: 201 };
                    });

                    this.router.route('/collection', this.collectionSchema, {
                        post: this.postSpy
                    });
                });

                it('uses item schema for validation', function() {
                    var item = {
                        foo: 'test foo',
                        bar: 'test bar'
                    };
                    return this.connection.post('/collection', {
                        resource: item
                    }).then(function(result) {
                        result.should.be.ok;
                    });
                });
            });

            describe('an object', function() {
                it('that is valid', function() {
                    var item = {
                        param2: {
                            obj1: 'hey',
                            obj2: 3232
                        }
                    };
                    return this.connection.post('/postit', {
                        resource: item
                    }).then(function(result) {
                        result.param2.should.deep.equal(item.param2);
                    });
                })

                it('throws an error if object is not valid', function() {
                    var item = {
                        param2: {
                            obj1: 'hey',
                            obj2: 'yoo this is invalid integer'
                        }
                    };
                    return this.connection.post('/postit', {
                        resource: item
                    }).catch(function(error) {
                        error.should.be.ok;
                        error.should.have.property('code', 422);
                        error.properties[0].should.have.property('code', 105);
                        error.properties[0].property.should.equal('param2.obj2');
                    });
                })
            });


            describe('a date-time', function() {
                it('that is valid', function() {
                    var date = new Date();
                    var item = {
                        param5: date
                    };
                    return this.connection.post('/postit', {
                        resource: item
                    }).then(function(result) {
                        result.param5.should.deep.equal(date);
                    });
                })
            });

            describe('an array', function() {
                it('that is valid', function() {
                    var item = {
                        param3: ['hola']
                    };
                    return this.connection.post('/postit', {
                        resource: item
                    }).then(function(result) {
                        result.param3.should.deep.equal(item.param3);
                    });
                })

                it('throws an error if array is not valid', function() {
                    var item = {
                        param3: ['hey']
                    };
                    return this.connection.post('/postit', {
                        resource: item
                    }).catch(function(error) {
                        error.should.be.ok;
                        error.should.have.property('code', 422);
                        error.properties.length.should.equal(1);
                        error.properties[0].should.have.property('code', 110);
                        error.properties[0].property.should.equal('param3');
                    })
                })
            });

            it('throws an error if integer item is an array', function() {
                var item = {
                    param4: ['hey']
                };
                return this.connection.post('/postit', {
                    resource: item
                }).catch(function(error) {
                    error.should.be.ok;
                    error.should.have.property('code', 422);
                    error.properties[0].should.have.property('code', 105);
                    error.properties[0].property.should.equal('param4');
                })
            });
            it('throws an error if integer item is an object', function() {
                var item = {
                    param4: {'hey': 123}
                };
                return this.connection.post('/postit', {
                    resource: item
                }).catch(function(error) {
                    error.should.be.ok;
                    error.should.have.property('code', 422);
                    error.properties[0].should.have.property('code', 105);
                    error.properties[0].property.should.equal('param4');
                })
            });

        })

        describe('errors', function() {
            var httpStatusCodes = new HttpStatusCodes();
            var statuses = httpStatusCodes.getAll();

            var dataAllStatusCodes = Object.keys(statuses)
            .map(function(code) {
                return {
                    code: parseInt(code, 10),
                    error: statuses[code]
                }
            });

            var dataSuccessStatusCodes = dataAllStatusCodes.filter(function(data) {
                return data.code >= 200 && data.code < 300;
            });

            var dataClientErrorStatusCodes = dataAllStatusCodes.filter(function(data) {
                return data.code >= 400 && data.code < 500;
            });

            var dataServerErrorStatusCodes = dataAllStatusCodes.filter(function(data) {
                return data.code >= 500 && data.code < 600;
            });

            describe('client errors', function() {
                describe('within collections', function() {

                    beforeEach(function() {
                        this.collectionSchema = {
                            type: 'object',
                            properties: {
                                userId: {
                                    type: 'string',
                                    errorCodes: [
                                        {
                                            code: 1000,
                                            error: 'TOO_SHORT',
                                            message: 'Property is too short'
                                        }
                                    ]
                                },
                                nested: {
                                    type: 'object',
                                    properties: {
                                        nested2: {
                                            type: 'object',
                                            properties: {
                                                items: {
                                                    type: 'array',
                                                    items: {
                                                        type: 'object',
                                                        properties: {
                                                            nestedArray2: {
                                                                type: 'string',
                                                                errorCodes: [
                                                                    {
                                                                        code: 1000,
                                                                        error: 'TOO_SHORT',
                                                                        message: 'Property is too short'
                                                                    }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                },
                                                foo2: {
                                                   type: 'string',
                                                    errorCodes: [
                                                        {
                                                            code: 1000,
                                                            error: 'TOO_SHORT',
                                                            message: 'Property is too short'
                                                        }
                                                    ]
                                                },
                                                nested3: {
                                                    type: 'object',
                                                    properties: {
                                                        foo3: {
                                                          type: 'string',
                                                            errorCodes: [
                                                                {
                                                                    code: 1000,
                                                                    error: 'TOO_SHORT',
                                                                    message: 'Property is too short'
                                                                }
                                                            ]
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                items: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            nested4: {
                                                type: 'object',
                                                properties: {
                                                    foo4: {
                                                      type: 'string',
                                                        errorCodes: [
                                                            {
                                                                code: 1000,
                                                                error: 'TOO_SHORT',
                                                                message: 'Property is too short'
                                                            }
                                                        ]
                                                    },
                                                    bar4: {
                                                        type: 'object',
                                                        properties: {
                                                            items: {
                                                                type: 'array',
                                                                items: {
                                                                    type: 'object',
                                                                    properties: {
                                                                        nestedArray4: {
                                                                            type: 'string',
                                                                            errorCodes: [
                                                                                {
                                                                                    code: 1000,
                                                                                    error: 'TOO_SHORT',
                                                                                    message: 'Property is too short'
                                                                                }
                                                                            ]
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            barNested4: {
                                                                type: 'string',
                                                                errorCodes: [
                                                                    {
                                                                        code: 1000,
                                                                        error: 'TOO_SHORT',
                                                                        message: 'Property is too short'
                                                                    }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            foo: {
                                                type: 'string',
                                                errorCodes: [
                                                    {
                                                        code: 1000,
                                                        error: 'TOO_SHORT',
                                                        message: 'Property is too short'
                                                    }
                                                ]
                                            },
                                            bar: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        };
                    });
                    [
                        ['items@foo', 'foo'],
                        ['items@nested4.foo4', 'nested4.foo4'],
                        ['items@nested4.bar4.barNested4', 'nested4.bar4.barNested4'],
                        ['items@nested4.bar4.items@nestedArray4', 'nested4.bar4.items@nestedArray4'],
                        ['nested.nested2.items@nestedArray2', 'nested.nested2.items@nestedArray2'],
                        ['userId', 'userId'],
                        ['nested.nested2.foo2', 'nested.nested2.foo2'],
                        ['nested.nested2.nested3.foo3', 'nested.nested2.nested3.foo3'],
                    ]
                    .forEach(function(data) {
                        it('returns error details for property ' + data[0] , function() {
                            this.router.route('/collection', this.collectionSchema, {
                                post: function(request, connection) {
                                    // Return a property error
                                    request.addPropertyError(data[0], 1000);
                                    return request.error(422, 'invalid');
                                }
                            });

                            return this.connection.post('/collection', { /* anything */ })
                            .then(function(error) {
                                return Promise.reject('Did not expect success');
                            })
                            .catch(function(error) {
                                error.should.be.ok;
                                error.should.have.property('properties');
                                error.properties.should.be.an('array');
                                error.properties.should.have.lengthOf(1);
                                error.properties[0].should.deep.equal({
                                    property: data[1],
                                    code: 1000,
                                    error: 'TOO_SHORT',
                                    message: 'Property is too short'
                                });
                            }.bind(this));
                        });
                    });

                    [
                        'items@notexist',
                        'items@nested4.notexist',
                        'items@nested4.bar4.notexist',
                        'items@nested4.bar4.items@notexist',
                        'nested.nested2.items@notexist',
                        'notexist',
                        'nested.nested2.notexist',
                        'nested.nested2.nested3.notexist',
                    ]
                    .forEach(function(data) {
                        it('returns empty properties array for' + data +  ' that doesn\'t exist', function() {
                            this.router.route('/collection', this.collectionSchema, {
                                post: function(request, connection) {
                                    // Return a property error
                                    request.addPropertyError(data, 1000);
                                    return request.error(422, 'invalid');
                                }
                            });

                            return this.connection.post('/collection', { /* anything */ })
                            .then(function(error) {
                                return Promise.reject('Did not expect success');
                            })
                            .catch(function(error) {
                                error.should.be.ok;
                                error.should.have.property('properties');
                                error.properties[0].code.should.equal(200);
                            }.bind(this));
                        });
                    });
                });

                dataClientErrorStatusCodes.slice(0, 1).forEach(function(data) {
                    it('returns HTTP status code ' + data.code + ' and associated error string "' + data.error + '"', function() {
                        this.router.route('/will-error', {
                            type: 'object',
                            properties: {
                                foo: { type: 'string' }
                            }
                        }, {
                            get: function(request, connection) {
                                return request.error(data.code, 'test_message');
                            }.bind(this)
                        });

                        return this.connection.get('/will-error')
                        .then(function(error) {
                            return Promise.reject('Did not expect success');
                        })
                        .catch(function(error) {
                            error.should.be.ok;
                            error.should.have.property('code', data.code);
                            error.should.have.property('error', data.error);
                        }.bind(this));
                    });

                    it('returns error message', function() {
                        this.router.route('/will-error', {
                            type: 'object',
                            properties: {
                                foo: { type: 'string' }
                            }
                        }, {
                            get: function(request, connection) {
                                return request.error(data.code, 'test_message');
                            }.bind(this)
                        });

                        return this.connection.get('/will-error')
                        .then(function(error) {
                            return Promise.reject('Did not expect success');
                        })
                        .catch(function(error) {
                            error.should.be.ok;
                            error.should.have.property('message', 'test_message');
                        }.bind(this));
                    });

                    it('returns empty array of properties by default', function() {
                        this.router.route('/will-error', {
                            type: 'object',
                            properties: {
                                foo: { type: 'string' }
                            }
                        }, {
                            get: function(request, connection) {
                                return request.error(data.code, 'test_message');
                            }.bind(this)
                        });

                        return this.connection.get('/will-error')
                        .then(function(error) {
                            return Promise.reject('Did not expect success');
                        })
                        .catch(function(error) {
                            error.should.be.ok;
                            error.should.have.property('properties');
                            error.properties.should.be.an('array');
                            error.properties.should.have.lengthOf(0);
                        }.bind(this));
                    });

                    it('returns default error message if not provided', function() {
                        this.router.route('/will-error', {
                            type: 'object',
                            properties: {
                                foo: { type: 'string' }
                            }
                        }, {
                            get: function(request, connection) {
                                return request.error(data.code);
                            }.bind(this)
                        });

                        return this.connection.get('/will-error')
                        .then(function(error) {
                            return Promise.reject('Did not expect success');
                        })
                        .catch(function(error) {
                            error.should.be.ok;
                            error.should.have.property('message', 'Unknown error');
                        }.bind(this));
                    });

                    it('returns details about properties that are in error', function() {
                        this.router.route('/will-error', {
                            type: 'object',
                            properties: {
                                displayName: {
                                    type: 'string',
                                    errorCodes: [
                                        {
                                            code: 1000,
                                            error: 'TOO_SHORT',
                                            message: 'Display name is too short'
                                        }
                                    ]
                                }
                            }
                        }, {
                            patch: function(request, connection) {
                                // Return a property error
                                request.addPropertyError('displayName', 1000);
                                return request.error(422, 'invalid');
                            }
                        });

                        return this.connection.patch('/will-error', { /* anything */ })
                        .then(function(error) {
                            return Promise.reject('Did not expect success');
                        })
                        .catch(function(error) {
                            error.should.be.ok;
                            error.should.have.property('properties');
                            error.properties.should.be.an('array');
                            error.properties.should.have.lengthOf(1);
                            error.properties[0].should.deep.equal({
                                property: 'displayName',
                                code: 1000,
                                error: 'TOO_SHORT',
                                message: 'Display name is too short'
                            });
                        }.bind(this));
                    });

                    it('is a valid error object', function() {
                        this.router.route('/will-error', {
                            type: 'object',
                            properties: {
                                displayName: {
                                    type: 'string',
                                    errorCodes: [
                                        {
                                            code: 1000,
                                            error: 'TOO_SHORT',
                                            message: 'Display name is too short'
                                        }
                                    ]
                                }
                            }
                        }, {
                            patch: function(request, connection) {
                                // Return a property error
                                request.addPropertyError('displayName', 1000);
                                return request.error(422, 'invalid');
                            }
                        });

                        return this.connection.patch('/will-error', { /* anything */ })
                        .then(function(error) {
                            return Promise.reject('Did not expect success');
                        })
                        .catch(function(error) {
                            var validate = jsen(errorSchema);
                            var valid = validate(error);
                            valid.should.be.true;
                        }.bind(this));
                    });
                });
            });
        });

        describe('with null value', function() {
            it('is returned', function() {
                return this.connection.get('/foo/123')
                .then(function(foo) {
                    foo.should.have.property('nullable', null);
                });
            });
        });

        describe('with nested resource', function() {
            beforeEach(function() {
                this.router.route('/nested', {
                    type: 'object',
                    properties: {
                        child: {
                            type: 'object',
                            properties: {
                                foo: {
                                    type: 'string'
                                }
                            }
                        }
                    }
                }, {
                    get: function() {
                        return new Resource('/nested', {
                            child: new Resource('/nested/child', {
                                foo: 'test foo'
                            }, 1000)
                        }, 2000);
                    }
                });
            });

            it('contains $id for child resource', function() {
                return this.connection.get('/nested')
                .then(function(nested) {
                    nested.child.should.have.property('$id', '/nested/child');
                });
            });

            it('contains $expires for child resource', function() {
                return this.connection.get('/nested')
                .then(function(nested) {
                    nested.child.should.have.property('$expires', 1000);
                });
            });
        });

        describe('with symlink', function() {
            beforeEach(function() {
                this.childSchema = {
                    type: 'object',
                    properties: {
                        foo: { type: 'string' },
                        bar: { type: 'string' },
                        dur: { type: 'string' }
                    }
                };

                this.parentSchema = {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        child: this.childSchema
                    }
                };

                this.router.route('/parent', this.parentSchema, {
                    get: function() {
                        return new Resource('/parent', {
                            name: 'test name',
                            child: new Symlink('/parent/child')
                        }, 1000);
                    }
                });

                this.childFooCallback = sinon.spy(function() {
                    return new Resource('/parent/child', {
                        foo: 'test child foo'
                    }, 2000);
                });

                this.childBarCallback = sinon.spy(function() {
                    return new Resource('/parent/child', {
                        bar: 'test child bar'
                    }, 2000);
                });

                this.childDurCallback = sinon.spy(function() {
                    return new Resource('/parent/child', {
                        dur: 'test child dur'
                    }, 2000);
                });

                this.router.route('/parent/child', this.childSchema, {
                    get: [
                        {
                            props: ['foo'],
                            callback: this.childFooCallback
                        },
                        {
                            props: ['bar'],
                            callback: this.childBarCallback
                        },
                        {
                            props: ['dur'],
                            callback: this.childDurCallback
                        }
                    ]
                });
            });

            it('only makes necessary calls to fullfill requested properties', function() {
                return this.connection.get('/parent', {
                    props: ['child.foo', 'child.dur']
                })
                .then(function(result) {
                    this.childFooCallback.called.should.be.true;
                    this.childBarCallback.called.should.be.false;
                    this.childDurCallback.called.should.be.true;
                }.bind(this));
            });

            it('does not invoke symlink if not requested', function() {
                return this.connection.get('/parent', {
                    props: ['name']
                })
                .then(function(result) {
                    this.childFooCallback.called.should.be.false;
                    this.childBarCallback.called.should.be.false;
                    this.childDurCallback.called.should.be.false;
                }.bind(this));
            });
        });

        describe('with collection of symlinks', function() {
            describe('nested in object', function() {
                    beforeEach(function() {
                        this.itemSchema = {
                            type: 'object',
                            properties: {
                                id: {type: 'integer'},
                                foo: { type: 'string' },
                                bar: { type: 'string' }
                            }
                        };
                        this.collectionSchema = {
                            type: 'object',
                            properties: {
                                items: {
                                    type: 'array',
                                    items: {
                                        user: this.itemSchema
                                    }
                                }
                            }
                        };

                        this.router.route('/collection', this.collectionSchema, {
                            get: function() {
                                var items = [];
                                for (var i = 1; i <= 1; i++) {
                                    items.push({ user: new Symlink('/collection/' + i) });
                                }
                                return new OffsetPaginator('/collection')
                                .setTotal(100)
                                .setExpires(1000)
                                .setItems(items);
                            }
                        });

                        this.itemFooCallback = sinon.spy(function(request) {
                            var id = request.getParam('id');
                            return new Resource('/collection/' + id, {
                                foo: 'foo ' + id
                            });
                        });

                        this.itemBarCallback = sinon.spy(function(request) {
                            var id = request.getParam('id');
                            return new Resource('/collection/' + id, {
                                bar: 'bar ' + id
                            });
                        });

                        this.router.route('/collection/:id', this.itemSchema, {
                            get: [
                                {
                                    props: ['foo'],
                                    callback: this.itemFooCallback
                                },
                                {
                                    props: ['bar'],
                                    callback: this.itemBarCallback
                                }
                            ]
                        });
                    });

                    it('calls all symlink callbacks if no props specified', function() {
                        return this.connection.get('/collection')
                        .then(function(result) {
                            this.itemFooCallback.called.should.be.true;
                            this.itemBarCallback.called.should.be.true;
                        }.bind(this));
                    });

                    it('calls only required symlink callback based on props specified', function() {
                        return this.connection.get('/collection', {
                            props: ['items@user.foo']
                        })
                        .then(function(result) {
                            this.itemFooCallback.called.should.be.true;
                            this.itemBarCallback.called.should.be.false;
                        }.bind(this));
                    });

                    it('can get just total from a cacheable collection', function() {
                        return this.connection.get('/collection', {
                            props: ['total']
                        })
                        .then(function(result) {
                            result.should.have.property('total', 100);
                        }.bind(this));
                    });
                });

                describe('not nested', function() {
                    beforeEach(function() {
                        this.itemSchema = {
                            type: 'object',
                            properties: {
                                id: {type: 'integer'},
                                foo: { type: 'string' },
                                bar: { type: 'string' }
                            }
                        };
                        this.collectionSchema = {
                            type: 'object',
                            properties: {
                                items: {
                                    type: 'array',
                                    items: this.itemSchema
                                }
                            }
                        };

                        this.router.route('/collection', this.collectionSchema, {
                            get: function() {
                                var items = [];
                                for (var i = 1; i <= 1; i++) {
                                    items.push(new Symlink('/collection/' + i));
                                }
                                return new OffsetPaginator('/collection')
                                .setTotal(100)
                                .setExpires(1000)
                                .setItems(items);
                            }
                        });

                        this.itemFooCallback = sinon.spy(function(request) {
                            var id = request.getParam('id');
                            return new Resource('/collection/' + id, {
                                foo: 'foo ' + id
                            });
                        });

                        this.itemBarCallback = sinon.spy(function(request) {
                            var id = request.getParam('id');
                            return new Resource('/collection/' + id, {
                                bar: 'bar ' + id
                            });
                        });

                        this.router.route('/collection/:id', this.itemSchema, {
                            get: [
                                {
                                    props: ['foo'],
                                    callback: this.itemFooCallback
                                },
                                {
                                    props: ['bar'],
                                    callback: this.itemBarCallback
                                }
                            ]
                        });
                    });

                    it('calls all symlink callbacks if no props specified', function() {
                        return this.connection.get('/collection')
                        .then(function(result) {
                            this.itemFooCallback.called.should.be.true;
                            this.itemBarCallback.called.should.be.true;
                        }.bind(this));
                    });

                    it('calls only required symlink callback based on props specified', function() {
                        return this.connection.get('/collection', {
                            props: ['items@foo']
                        })
                        .then(function(result) {
                            this.itemFooCallback.called.should.be.true;
                            this.itemBarCallback.called.should.be.false;
                        }.bind(this));
                    });

                    it('can get just total from a cacheable collection', function() {
                        return this.connection.get('/collection', {
                            props: ['total']
                        })
                        .then(function(result) {
                            result.should.have.property('total', 100);
                        }.bind(this));
                    });
                });
        })


        describe('with deeply nested collections of symlinks', function() {
            beforeEach(function() {
                this.grandchildSchema = {
                    type: 'object',
                    properties: {
                        childId : {type: 'integer'},
                        grandchildId : {type: 'integer'},
                        foo: { type: 'string' },
                        bar: { type: 'string' }
                    }
                };

                this.childSchema = {
                    type: 'object',
                    properties: {
                        childId : {type: 'integer'},
                        children: { type: 'array', items: this.grandchildSchema },
                    }
                };

                this.childrenSchema = {
                    type: 'object',
                    properties: {
                        items: {
                            type: 'array',
                            items: this.childSchema
                        }
                    }
                };

                this.router.route('/children', this.childrenSchema, {
                    get: function() {
                        var children = [];
                        for (var i = 1; i <= 3; i++) {
                            children.push(new Symlink('/children/' + i));
                        }
                        return new OffsetPaginator('/children')
                        .setItems(children);
                    }
                });

                this.router.route('/children/:childId', this.childSchema, {
                    get: function(request) {
                        var childId = request.getParam('childId');
                        var grandchildren = [];
                        for (var i = 1; i <= 3; i++) {
                            grandchildren.push(new Symlink('/children/' + childId + '/' + i));
                        }
                        return new OffsetPaginator('/children/' + childId)
                        .setItems(grandchildren);
                    }
                });

                this.grandchildFooCallback = sinon.spy(function(request) {
                    var childId = request.getParam('childId');
                    var grandchildId = request.getParam('grandchildId');
                    return new Resource('/children/' + childId + '/' + grandchildId, {
                        foo: 'foo ' + childId + ' ' + grandchildId
                    });
                });

                this.grandchildBarCallback = sinon.spy(function(request) {
                    var childId = request.getParam('childId');
                    var grandchildId = request.getParam('grandchildId');
                    return new Resource('/children/' + childId + '/' + grandchildId, {
                        bar: 'bar ' + childId + ' ' + grandchildId
                    });
                });

                this.router.route('/children/:childId/:grandchildId', this.grandchildSchema, {
                    get: [
                        {
                            props: ['foo'],
                            callback: this.grandchildFooCallback
                        },
                        {
                            props: ['bar'],
                            callback: this.grandchildBarCallback
                        }
                    ]
                });
            });

            it('calls all symlink callbacks if no props specified', function() {
                return this.connection.get('/children')
                .then(function(result) {
                    this.grandchildFooCallback.called.should.be.true;
                    this.grandchildBarCallback.called.should.be.true;
                }.bind(this));
            });

            it('calls only required symlink callback based on props specified', function() {
                return this.connection.get('/children', {
                    props: ['items@items@foo']
                })
                .then(function(result) {
                    this.grandchildFooCallback.called.should.be.true;
                    this.grandchildBarCallback.called.should.be.false;
                }.bind(this));
            });
        });

        describe('with array', function() {
            it('merges arrays of resources', function() {
                this.foosSchema = {
                    $schema: 'http://json-schema.org/draft-04/schema#',
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            bar: { type: 'string' },
                            baz: { type: 'string' }
                        }
                    }
                };

                this.router.route('/foos', this.foosSchema, {
                    get: [
                        {
                            props: ['bar'],
                            callback: function() {
                                var results = [];
                                for (var i = 1; i <= 3; i++) {
                                    results.push(new Resource('/foo/' + i, {
                                        bar: 'bar ' + i
                                    }));
                                }
                                return results;
                            }
                        },
                        {
                            props: ['baz'],
                            callback: function() {
                                var results = [];
                                for (var i = 1; i <= 3; i++) {
                                    results.push(new Resource('/foo/' + i, {
                                        baz: 'baz ' + i
                                    }));
                                }
                                return results;
                            }
                        }
                    ]
                });

                return this.connection.get('/foos')
                .then(function(foos) {
                    foos.should.have.lengthOf(3);
                    foos[0].should.have.property('bar', 'bar 1');
                    foos[0].should.have.property('baz', 'baz 1');
                    foos[1].should.have.property('bar', 'bar 2');
                    foos[1].should.have.property('baz', 'baz 2');
                    foos[2].should.have.property('bar', 'bar 3');
                    foos[2].should.have.property('baz', 'baz 3');
                });
            });
        });

        describe('with collection', function() {
            it('merges collections of resources', function() {
                this.foosSchema = {
                    $schema: 'http://json-schema.org/draft-04/schema#',
                    type: 'object',
                    properties: {
                        items: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    bar: { type: 'string' },
                                    baz: { type: 'string' }
                                }
                            }
                        }
                    }
                };

                this.router.route('/foos', this.foosSchema, {
                    get: [
                        {
                            props: ['bar'],
                            callback: function() {
                                var items = [];
                                for (var i = 1; i <= 3; i++) {
                                    items.push(new Resource('/foo/' + i, {
                                        bar: 'bar ' + i
                                    }));
                                }
                                return new OffsetPaginator('/foos', items);
                            }
                        },
                        {
                            props: ['baz'],
                            callback: function() {
                                var items = [];
                                for (var i = 1; i <= 3; i++) {
                                    items.push(new Resource('/foo/' + i, {
                                        baz: 'baz ' + i
                                    }));
                                }
                                return new OffsetPaginator('/foos', items);
                            }
                        }
                    ]
                });

                return this.connection.get('/foos')
                .then(function(result) {
                    result.should.have.property('items');
                    result.items.should.have.lengthOf(3);
                    result.items[0].should.have.property('bar', 'bar 1');
                    result.items[0].should.have.property('baz', 'baz 1');
                    result.items[1].should.have.property('bar', 'bar 2');
                    result.items[1].should.have.property('baz', 'baz 2');
                    result.items[2].should.have.property('bar', 'bar 3');
                    result.items[2].should.have.property('baz', 'baz 3');
                });
            });
        });
    });

    describe.skip('filters', function() {
        beforeEach(function() {
            this.router = new Router();

            this.filterA = sinon.spy(function(input) {
                return input + ' A';
            });

            this.filterB = sinon.spy(function(input) {
                return input + ' B';
            });

            this.filterC = sinon.spy(function(input) {
                return input + ' C';
            });

            this.filterAsync = sinon.spy(function(input) {
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        resolve(input + ' ASYNC');
                    });
                });
            });

            this.router.filter('filterA', this.filterA);
            this.router.filter('filterB', this.filterB);
            this.router.filter('filterC', this.filterC);
            this.router.filter('filterAsync', this.filterAsync);
        });

        it('invokes filter on input param', function(done) {
            this.router.route('/example/:foo/:bar/:baz', {
                type: 'object',
                properties: {
                    foo: {
                        type: 'string',
                        filters: 'filterA'
                    }
                }
            }, {
                get: function(request) {
                    return {
                        foo: request.getParam('foo')
                    }
                }
            });
            this.router.get('/example/foo/bar/baz')
            .then(function(result) {
                result.should.have.property('foo', 'foo A');
                this.filterA.called.should.be.true;
                this.filterB.called.should.be.false;
                this.filterC.called.should.be.false;
                done();
            }.bind(this))
            .catch(done);
        });

        it('invokes each filter on input params in FIFO order', function(done) {
            this.router.route('/example/:foo/:bar/:baz', {
                type: 'object',
                properties: {
                    foo: {
                        type: 'string',
                        filters: ['filterA', 'filterB', 'filterC']
                    }
                }
            }, {
                get: function(request) {
                    return {
                        foo: request.getParam('foo')
                    }
                }
            });
            this.router.get('/example/foo/bar/baz')
            .then(function(result) {
                result.should.have.property('foo', 'foo A B C');
                done();
            })
            .catch(done);
        });

        it('rejects if filter is undefined', function(done) {
            this.router.route('/example/:foo/:bar/:baz', {
                type: 'object',
                properties: {
                    foo: {
                        type: 'string',
                        filters: ['unknownFilter']
                    }
                }
            }, {
                get: function(request) {
                    return {
                        foo: request.getParam('foo')
                    }
                }
            });
            this.router.get('/example/foo/bar/baz')
            .then(function(result) {
                done('did not expect promise to resolve because `unknownFilter` is invalid');
            })
            .catch(function(error) {
                error.should.be.ok;
                error.error.should.contain("unknownFilter");
                done();
            });
        });

        it('supports async filters if filter returns a promise', function(done) {
            this.router.route('/example/:foo/:bar/:baz', {
                type: 'object',
                properties: {
                    foo: {
                        type: 'string',
                        filters: ['filterA', 'filterAsync', 'filterB']
                    }
                }
            }, {
                get: function(request) {
                    return {
                        foo: request.getParam('foo')
                    }
                }
            });
            this.router.get('/example/foo/bar/baz')
            .then(function(result) {
                result.should.have.property('foo', 'foo A ASYNC B');
                done();
            })
            .catch(done);
        });
    });

    describe('custom HTTP status response', function() {
        beforeEach(function() {
            this.router = new Router();
            this.router.route('/foo', {
                type: 'array',
                items: {
                    anything: { type: 'string' }
                }
            }, {
                post: function(request, connection) {
                    return request.status(201);
                }.bind(this)
            });
            this.connection = new Connection(this.router, {}, {});
        });

        it('provide status as $httpStatus property', function() {
            return this.connection.post('/foo')
            .then(function(result) {
                result.should.be.ok;
                result.$httpStatus.should.equal(201);
            });
        });

        it('does not validate with resource schema when status is < 200', function() {
            this.router.route('/failure', {
                type: 'object',
                properties: {
                    foo: { type: 'string' }
                }
            }, {
                get: [
                    {
                        props: ['foo'],
                        callback: function(request, connection) {
                            return request.status(199, {
                                code: 199,
                                error: 'test_error',
                                message: 'test_message',
                                properties: []
                            });
                        }.bind(this)
                    }
                ]
            });

            return this.connection.get('/failure', {
                props: ['foo']
            })
            .then(function(result) {
                result.should.not.be.ok;
            }).catch(function(error) {
                error.should.be.ok;
                error.$httpStatus.should.equal(199);
                error.should.have.property('error', 'test_error');
            });
        });

        it('does not validate response when status is >= 300', function() {
            this.router.route('/failure', {
                type: 'object',
                properties: {
                    foo: { type: 'string' }
                }
            }, {
                get: [
                    {
                        props: ['foo'],
                        callback: function(request, connection) {
                            return request.status(300, {
                                code: 300,
                                error: 'test_error',
                                message: 'test_message',
                                properties: []
                            });
                        }.bind(this)
                    }
                ]
            });

            return this.connection.get('/failure', {
                props: ['foo']
            })
            .then(function(result) {
                result.should.not.be.ok;
            }).catch(function(error) {
                error.should.be.ok;
                error.$httpStatus.should.equal(300);
                error.should.have.property('error', 'test_error');
            });
        });
    });

    describe('symlinks', function() {
        beforeEach(function() {
            this.router = new Router();

           this.router.route('/bar', {
                type: 'object',
                properties: {
                    baz: { type: 'string' }
                }
            }, {
                get: function(request) {
                    return {
                        baz: 'test baz'
                    }
                }
            });

            this.router.route('/coffee', {
                type: 'object',
                properties: {
                    baz: { type: 'string' }
                }
            }, {
                get: function(request) {
                    return {
                        baz: 'test baz232'
                    }
                }
            });

            this.connection = new Connection(this.router, {}, {});
        });

        describe('non nested', function() {
            beforeEach(function() {
                this.router.route('/foo', {
                    type: 'object',
                    properties: {
                        bar: { type: 'object' },
                        derp: { type: 'string' }
                    }
                }, {
                    get: function(request) {
                        return {
                            bar: new Symlink('/bar'),
                            derp: 'test derp'
                        }
                    }
                });
            });

            it('resolves value when particular props is requested', function() {
                return this.connection.get('/foo', { props: ['bar'] })
                .then(function(result) {
                    result.should.have.property('bar');
                    result.bar.should.have.property('baz', 'test baz');
                    result.should.not.have.property('derp');
                });
            });

            it('resolves value for all props', function() {
                return this.connection.get('/foo')
                .then(function(result) {
                    result.should.have.property('bar');
                    result.bar.should.have.property('baz', 'test baz');
                    result.should.have.property('derp', 'test derp');
                });
            });
        });

        describe('nested', function() {
            beforeEach(function() {
                this.router.route('/foo-nested', {
                    type: 'object',
                    properties: {
                        bar: { type: 'array' },
                        derp: { type: 'string' }
                    }
                }, {
                    get: function(request) {
                        return {
                            bar: [{user: new Symlink('/bar'), offset:1}, {user: new Symlink('/coffee'), offset:2}],
                            derp: 'test derp'
                        }
                    }
                });
            });

            it('resolves value when particular props is requested', function() {
                return this.connection.get('/foo-nested', { props: ['bar'] })
                .then(function(result) {
                    result.should.have.property('bar');
                    result.bar.should.deep.equal([{user: {baz:'test baz'}, offset:1}, {user: {baz:'test baz232'}, offset:2}]);
                    result.should.not.have.property('derp');
                });
            });

            it('resolves value for all props', function() {
                return this.connection.get('/foo-nested')
                .then(function(result) {
                    result.should.have.property('bar');
                    result.bar.should.deep.equal([{user: {baz:'test baz'}, offset:1}, {user: {baz:'test baz232'}, offset:2}]);
                    result.should.have.property('derp', 'test derp');
                });
            });
        });

        describe('complex nesting', function() {
            beforeEach(function() {
                this.grandChildSchema = {
                    type: 'object',
                    properties: {
                        childId: {type: 'integer'},
                        grandChildId: {type: 'integer'},
                        derp: { type: 'string' },
                        flerp: { type: 'string' },
                        obj: {
                            type: 'object',
                            properties: {
                                subDerp: { type: 'string' },
                                subFlerp: { type: 'string' }
                            }
                        },
                    }
                };

                this.childSchema = {
                    type: 'object',
                    properties: {
                        childId: {type: 'integer'},
                        foo: { type: 'string' },
                        bar: { type: 'string' },
                        obj: {
                            type: 'object',
                            properties: {
                                subFoo: { type: 'string' },
                                subBar: { type: 'string' }
                            }
                        },
                        grandChildren: {
                            type: 'array',
                            items: this.grandChildSchema
                        }
                    }
                };

                this.childrenSchema = {
                    type: 'array',
                    items: this.childSchema
                };

                this.parentSchema = {
                    type: 'object',
                    properties: {
                        childId: {type: 'integer'},
                        grandChildId: {type: 'integer'},
                        children: this.childrenSchema
                    }
                };

                this.router.route('/parent', this.parentSchema, {
                    get: function() {
                        return new Resource('/parent', {
                            children: [
                                new Symlink('/parent/child/1'),
                                new Symlink('/parent/child/2'),
                                new Symlink('/parent/child/3')
                            ]
                        });
                    }
                });

                this.router.route('/parent/child/:childId', this.parentSchema, {
                    get: function(request) {
                        var childId = request.getParam('childId');
                        return new Resource('/parent/child/' + childId, {
                            foo: 'test foo ' + childId,
                            bar: 'test bar ' + childId,
                            obj: {
                                subFoo: 'test subFoo ' + childId,
                                subBar: 'test subBar ' + childId,
                            },
                            grandChildren: [
                                new Symlink('/parent/child/' + childId + '/1'),
                                new Symlink('/parent/child/' + childId + '/2'),
                                new Symlink('/parent/child/' + childId + '/3')
                            ]
                        });
                    }.bind(this)
                });

                this.router.route('/parent/child/:childId/:grandChildId', this.parentSchema, {
                    get: function(request) {
                        var childId = request.getParam('childId');
                        var grandChildId = request.getParam('grandChildId');
                        return new Resource('/parent/child/' + childId + '/' + grandChildId, {
                            derp: 'test derp ' + childId + ' ' + grandChildId,
                            flerp: 'test flerp ' + childId + ' ' + grandChildId,
                            obj: {
                                subDerp: 'test subDerp ' + childId + ' ' + grandChildId,
                                subFlerp: 'test subFlerp ' + childId + ' ' + grandChildId
                            }
                        });
                    }.bind(this)
                });
            });

            it('gets all children details', function() {
                return this.connection.get('/parent', {
                    props: ['children']
                }).then(function(parent) {
                    parent.should.have.property('children');
                    parent.children.should.be.an('array');

                    parent.children[0].should.have.property('foo', 'test foo 1');
                    parent.children[0].should.have.property('bar', 'test bar 1');
                    parent.children[0].should.have.property('grandChildren');
                    parent.children[0].grandChildren.should.be.an('array');
                    parent.children[0].grandChildren[0].should.have.property('derp', 'test derp 1 1');
                    parent.children[0].grandChildren[0].should.have.property('flerp', 'test flerp 1 1');

                    parent.children[1].should.have.property('foo', 'test foo 2');
                    parent.children[1].should.have.property('bar', 'test bar 2');
                    parent.children[1].should.have.property('grandChildren');
                    parent.children[1].grandChildren.should.be.an('array');
                    parent.children[1].grandChildren[0].should.have.property('derp', 'test derp 2 1');
                    parent.children[1].grandChildren[0].should.have.property('flerp', 'test flerp 2 1');

                    parent.children[2].should.have.property('foo', 'test foo 3');
                    parent.children[2].should.have.property('bar', 'test bar 3');
                    parent.children[2].should.have.property('grandChildren');
                    parent.children[2].grandChildren.should.be.an('array');
                    parent.children[2].grandChildren[0].should.have.property('derp', 'test derp 3 1');
                    parent.children[2].grandChildren[0].should.have.property('flerp', 'test flerp 3 1');
                });
            });

            it('gets selective children details', function() {
                return this.connection.get('/parent', {
                    props: ['children@foo']
                }).then(function(parent) {
                    parent.should.have.property('children');
                    parent.children.should.be.an('array');

                    parent.children[0].should.have.property('foo', 'test foo 1');
                    parent.children[0].should.not.have.property('bar');
                    parent.children[0].should.not.have.property('grandChildren');

                    parent.children[1].should.have.property('foo', 'test foo 2');
                    parent.children[1].should.not.have.property('bar');
                    parent.children[1].should.not.have.property('grandChildren');

                    parent.children[2].should.have.property('foo', 'test foo 3');
                    parent.children[2].should.not.have.property('bar');
                    parent.children[2].should.not.have.property('grandChildren');
                });
            });

            it('gets selective nested children details', function() {
                return this.connection.get('/parent', {
                    props: ['children@obj.subFoo']
                }).then(function(parent) {
                    parent.should.have.property('children');
                    parent.children.should.be.an('array');

                    parent.children[0].should.not.have.property('foo');
                    parent.children[0].should.not.have.property('bar');
                    parent.children[0].should.not.have.property('grandChildren');
                    parent.children[0].should.have.property('obj');
                    parent.children[0].obj.should.have.property('subFoo', 'test subFoo 1');
                    parent.children[0].obj.should.not.have.property('subBar');

                    parent.children[1].should.not.have.property('foo');
                    parent.children[1].should.not.have.property('bar');
                    parent.children[1].should.not.have.property('grandChildren');
                    parent.children[1].should.have.property('obj');
                    parent.children[1].obj.should.have.property('subFoo', 'test subFoo 2');
                    parent.children[1].obj.should.not.have.property('subBar');

                    parent.children[2].should.not.have.property('foo');
                    parent.children[2].should.not.have.property('bar');
                    parent.children[2].should.not.have.property('grandChildren');
                    parent.children[2].should.have.property('obj');
                    parent.children[2].obj.should.have.property('subFoo', 'test subFoo 3');
                    parent.children[2].obj.should.not.have.property('subBar');
                });
            });

            it('gets selective deeply nested children details', function() {
                return this.connection.get('/parent', {
                    props: ['children@grandChildren@obj.subFlerp']
                }).then(function(parent) {
                    parent.should.have.property('children');
                    parent.children.should.be.an('array');

                    parent.children[0].should.not.have.property('foo');
                    parent.children[0].should.not.have.property('bar');
                    parent.children[0].should.not.have.property('obj');
                    parent.children[0].should.have.property('grandChildren');
                    parent.children[0].grandChildren.should.be.an('array');
                    parent.children[0].grandChildren[0].should.not.have.property('derp');
                    parent.children[0].grandChildren[0].should.not.have.property('flerp');
                    parent.children[0].grandChildren[0].should.have.property('obj');
                    parent.children[0].grandChildren[0].obj.should.have.property('subFlerp', 'test subFlerp 1 1');
                    parent.children[0].grandChildren[0].obj.should.not.have.property('subDerp');
                    parent.children[0].grandChildren[1].should.not.have.property('derp');
                    parent.children[0].grandChildren[1].should.not.have.property('flerp');
                    parent.children[0].grandChildren[1].should.have.property('obj');
                    parent.children[0].grandChildren[1].obj.should.have.property('subFlerp', 'test subFlerp 1 2');
                    parent.children[0].grandChildren[1].obj.should.not.have.property('subDerp');
                    parent.children[0].grandChildren[2].should.not.have.property('derp');
                    parent.children[0].grandChildren[2].should.not.have.property('flerp');
                    parent.children[0].grandChildren[2].should.have.property('obj');
                    parent.children[0].grandChildren[2].obj.should.have.property('subFlerp', 'test subFlerp 1 3');
                    parent.children[0].grandChildren[2].obj.should.not.have.property('subDerp');

                    parent.children[1].should.not.have.property('foo');
                    parent.children[1].should.not.have.property('bar');
                    parent.children[1].should.not.have.property('obj');
                    parent.children[1].should.have.property('grandChildren');
                    parent.children[1].grandChildren.should.be.an('array');
                    parent.children[1].grandChildren[0].should.not.have.property('derp');
                    parent.children[1].grandChildren[0].should.not.have.property('flerp');
                    parent.children[1].grandChildren[0].should.have.property('obj');
                    parent.children[1].grandChildren[0].obj.should.have.property('subFlerp', 'test subFlerp 2 1');
                    parent.children[1].grandChildren[0].obj.should.not.have.property('subDerp');
                    parent.children[1].grandChildren[1].should.not.have.property('derp');
                    parent.children[1].grandChildren[1].should.not.have.property('flerp');
                    parent.children[1].grandChildren[1].should.have.property('obj');
                    parent.children[1].grandChildren[1].obj.should.have.property('subFlerp', 'test subFlerp 2 2');
                    parent.children[1].grandChildren[1].obj.should.not.have.property('subDerp');
                    parent.children[1].grandChildren[2].should.not.have.property('derp');
                    parent.children[1].grandChildren[2].should.not.have.property('flerp');
                    parent.children[1].grandChildren[2].should.have.property('obj');
                    parent.children[1].grandChildren[2].obj.should.have.property('subFlerp', 'test subFlerp 2 3');
                    parent.children[1].grandChildren[2].obj.should.not.have.property('subDerp');

                    parent.children[2].should.not.have.property('foo');
                    parent.children[2].should.not.have.property('bar');
                    parent.children[2].should.not.have.property('obj');
                    parent.children[2].should.have.property('grandChildren');
                    parent.children[2].grandChildren.should.be.an('array');
                    parent.children[2].grandChildren[0].should.not.have.property('derp');
                    parent.children[2].grandChildren[0].should.not.have.property('flerp');
                    parent.children[2].grandChildren[0].should.have.property('obj');
                    parent.children[2].grandChildren[0].obj.should.have.property('subFlerp', 'test subFlerp 3 1');
                    parent.children[2].grandChildren[0].obj.should.not.have.property('subDerp');
                    parent.children[2].grandChildren[1].should.not.have.property('derp');
                    parent.children[2].grandChildren[1].should.not.have.property('flerp');
                    parent.children[2].grandChildren[1].should.have.property('obj');
                    parent.children[2].grandChildren[1].obj.should.have.property('subFlerp', 'test subFlerp 3 2');
                    parent.children[2].grandChildren[1].obj.should.not.have.property('subDerp');
                    parent.children[2].grandChildren[2].should.not.have.property('derp');
                    parent.children[2].grandChildren[2].should.not.have.property('flerp');
                    parent.children[2].grandChildren[2].should.have.property('obj');
                    parent.children[2].grandChildren[2].obj.should.have.property('subFlerp', 'test subFlerp 3 3');
                    parent.children[2].grandChildren[2].obj.should.not.have.property('subDerp');
                });
            });
        });

        describe('props with multi-callback collection', function() {
            beforeEach(function() {
                this.router.route('/foo', {
                    type: 'object',
                    properties: {
                        total: { type: 'integer' },
                        items: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    foo: { type: 'string' },
                                    bar: { type: 'string' }
                                }
                            }
                        }
                    }
                }, {
                    get: [
                        {
                            props: ['total'],
                            callback: function(request, connection) {
                                return {
                                    total: 7
                                };
                            }
                        },
                        {
                            props: ['items'],
                            callback: function(request, connection) {
                                var items = [];
                                for (var i = 0; i < 7; i++) {
                                    items.push({
                                        foo: 'test foo ' + i,
                                        bar: 'test bar ' + i
                                    })
                                }
                                return new OffsetPaginator('/foo')
                                .setItems(items);
                            }
                        }
                    ]
                });
            });

            it('can access separate prop `total` independently', function() {
                return this.connection.get('/foo', {
                    props: ['total']
                })
                .then(function(result) {
                    result.should.have.property('total', 7);
                });
            });

            it('can access separate prop `items` independently', function() {
                return this.connection.get('/foo', {
                    props: ['items']
                })
                .then(function(result) {
                    result.should.have.property('items');
                });
            });

            it('can access separate nested prop `items@foo` independently', function() {
                return this.connection.get('/foo', {
                    props: ['items@foo']
                })
                .then(function(result) {
                    result.should.have.property('items');
                });
            });
        });
    });

    describe('method OPTIONS /', function() {
        beforeEach(function() {
            var noop = function() {};
            this.router = new Router();

            this.fooSchema = {
                type: 'object',
                properties: {
                    foo: { type: 'string' }
                }
            };

            this.barSchema = {
                type: 'object',
                properties: {
                    bar: { type: 'integer' }
                }
            };

            this.bazSchema = {
                type: 'object',
                properties: {
                    baz: { type: 'string' },
                    bat: { type: 'integer' }
                }
            }

            this.router
            .route('/foo', this.fooSchema, { get: noop })
            .route('/bar', this.barSchema, { post: noop, get: noop, patch: noop, delete: noop, put: noop })
            .route('/baz', this.bazSchema, { get: [
                { props: ['baz'], callback: noop },
                { props: ['bat'], callback: noop }
            ]});
            this.connection = new Connection(this.router, {}, {});
        });

        it('returns details about all routes', function() {
            return this.connection.options('/')
            .then(function(result) {
                result.should.be.an('array');
                result.should.have.lengthOf(3); // three routes were defined

                result.forEach(function(data) {
                    switch (data.pattern) {
                        case '/foo':
                            data.should.have.property('schema', this.fooSchema);
                            data.should.have.property('methods');
                            data.methods.should.contain('GET');
                            data.methods.should.contain('OPTIONS');
                            data.methods.should.not.contain('POST');
                            data.methods.should.not.contain('PUT');
                            data.methods.should.not.contain('PATCH');
                            data.methods.should.not.contain('DELETE');
                            break;

                        case '/bar':
                            data.should.have.property('schema', this.barSchema);
                            data.should.have.property('methods');
                            data.methods.should.contain('GET');
                            data.methods.should.contain('OPTIONS');
                            data.methods.should.contain('POST');
                            data.methods.should.contain('PUT');
                            data.methods.should.contain('PATCH');
                            data.methods.should.contain('DELETE');
                            break;

                        case '/baz':
                            data.should.have.property('pattern', '/baz');
                            data.should.have.property('schema', this.bazSchema);
                            data.should.have.property('methods');
                            data.methods.should.contain('GET');
                            data.methods.should.contain('OPTIONS');
                            data.methods.should.not.contain('POST');
                            data.methods.should.not.contain('PUT');
                            data.methods.should.not.contain('PATCH');
                            data.methods.should.not.contain('DELETE');
                            break;

                        default:
                            throw new Error("Unexpected pattern " + data.pattern);
                    }
                });
            }.bind(this));
        });

        it('sorts methods humanly', function() {
            return this.connection.options('/')
            .then(function(result) {
                result.should.be.an('array');
                result.should.have.lengthOf(3); // three routes were defined

                var bar = result.filter(function(data) {
                    return data.pattern == '/bar';
                })[0];
                bar.methods[0].should.equal('GET');
                bar.methods[1].should.equal('POST');
                bar.methods[2].should.equal('PUT');
                bar.methods[3].should.equal('PATCH');
                bar.methods[4].should.equal('DELETE');
                bar.methods[5].should.equal('OPTIONS');
            });
        });
    });

    describe('request', function() {
        beforeEach(function() {
            this.router = new Router();

            // Set up "/foo/:fooId/:barId" resource -- sync
            this.fooSchema = {
                type: 'object',
                properties: {
                    fooId: { type: 'integer' },
                    barId: { type: 'string' }
                }
            };
            this.getFooSpy = sinon.spy(function(request) {
                return {
                    fooId: request.getParam('fooId'),
                    barId: request.getParam('barId')
                };
            });
            this.router.route('/foo/:fooId/:barId', this.fooSchema, {
                get: this.getFooSpy
            });

            this.connection = new Connection(this.router, {}, {});
        });

        it('extracts params from resourceId', function(done) {
            this.connection.get('/foo/123/abc')
            .then(function(foo) {
                foo.should.deep.equal({
                    fooId: 123,
                    barId: 'abc'
                });
            }.bind(this))
            .finally(done);
        });
    });

    describe('events', function() {
        describe('api:success', function() {
            beforeEach(function() {
                this.eventSpy = sinon.spy();
                this.router = new Router();
                this.resourcePattern = '/foo/:fooId';
                this.resourceId = '/foo/123';
                this.schema = {
                    type: 'object',
                    properties: {
                        fooId: {type: 'integer'},
                        bar: { type: 'string' }
                    }
                };

                // Configure router
                this.router.route(this.resourcePattern, this.schema, {
                    get: function(request, connection) {
                        return {
                            bar: 'test_bar'
                        };
                    }
                });
                this.connection = new Connection(this.router, {}, {});
                this.router.on('api:success', this.eventSpy);
            });

            it('calls event callback on success', function(done) {
                this.connection.get(this.resourceId)
                .finally(function() {
                    this.eventSpy.called.should.be.true;
                    this.eventSpy.lastCall.args[0].should.have.property('resourceId', this.resourceId);
                    this.eventSpy.lastCall.args[0].should.have.property('schema', this.schema);
                    this.eventSpy.lastCall.args[0].should.have.property('request');
                    this.eventSpy.lastCall.args[0].request.should.be.instanceOf(RequestRouter);
                    done();
                }.bind(this));
            });

            it('provides API timing to callback', function(done) {
                this.connection.get(this.resourceId)
                .finally(function() {
                    this.eventSpy.called.should.be.true;
                    this.eventSpy.lastCall.args[0].should.have.property('duration');
                    this.eventSpy.lastCall.args[0].should.have.property('timeStart');
                    this.eventSpy.lastCall.args[0].should.have.property('timeEnd');
                    done();
                }.bind(this));
            });

            it('does not call event callback on failure', function(done) {
                this.connection.get('/bad-resource')
                .catch(function(result) {
                    // continue
                })
                .finally(function() {
                    this.eventSpy.called.should.be.false;
                    done();
                }.bind(this));
            });
        });

        describe('api:error', function() {
            beforeEach(function() {
                this.eventSpy = sinon.spy();
                this.router = new Router();
                this.resourcePattern = '/foo/:fooId';
                this.resourceId = '/foo/123';
                this.schema = {
                    type: 'object',
                    properties: {
                        fooId: {type: 'integer'},
                        bar: { type: 'string' }
                    }
                };

                // Configure router
                this.router.route(this.resourcePattern, this.schema, {
                    get: function(request, connection) {
                        return {
                            bar: 'test_bar'
                        };
                    }
                });

                this.connection = new Connection(this.router, {}, {});
                this.router.on('api:error', this.eventSpy);
            });

            it('calls event callback on error', function(done) {
                this.connection.get('/bad-resource')
                .catch(function(result) {
                    // continue
                })
                .finally(function() {
                    this.eventSpy.called.should.be.true;
                    this.eventSpy.lastCall.args[0].should.have.property('resourceId', '/bad-resource');
                    this.eventSpy.lastCall.args[0].should.have.property('request');
                    this.eventSpy.lastCall.args[0].should.have.property('schema', null);
                    done();
                }.bind(this));
            });

            it('provides API timing to callback', function(done) {
                this.connection.get('/bad-resource')
                .catch(function(result) {
                    // continue
                })
                .finally(function() {
                    this.eventSpy.called.should.be.true;
                    this.eventSpy.lastCall.args[0].should.have.property('duration');
                    this.eventSpy.lastCall.args[0].should.have.property('timeStart');
                    this.eventSpy.lastCall.args[0].should.have.property('timeEnd');
                    done();
                }.bind(this));
            });

            it('does not call event callback on success', function(done) {
                this.connection.get(this.resourceId)
                .finally(function() {
                    this.eventSpy.called.should.be.false;
                    done();
                }.bind(this));
            });
        });
    });

    describe('connect middleware', function() {
        beforeEach(function() {
            this.router = new Router();

            this.fooGetSpy = sinon.spy(function(request) {
                return {
                    test1: request.getQuery('test1'),
                    bar: 'test_bar',
                    test2: request.getQuery('test2'),
                    test3: request.getQuery('test3')
                };
            });
            this.fooPostSpy = sinon.spy(function(request) {
                return request.getResource();
            });
            this.derpGetSpy = sinon.spy(function() {
                return {
                    flerp: 'test_flerp'
                };
            });
            this.derpPatchSpy = sinon.spy(function(request) {
                return request.getResource();
            });
            this.derpPostSpy = sinon.spy(function(request) {
                return request.getResource();
            });
            this.derpPutSpy = sinon.spy(function(request) {
                return request.getResource();
            });

            this.enumTestGetSpy = sinon.spy(function() {
                return {
                    foo: 'bar'
                };
            });
            this.enumTestPatchSpy = sinon.spy(function(request) {
                return request.getResource();
            });
            this.enumTestPostSpy = sinon.spy(function(request) {
                return request.getResource();
            });
            this.enumTestPutSpy = sinon.spy(function(request) {
                return request.getResource();
            });

            // Configure router
            this.router.route(['/foo', 'test1=hi&test2[]&test3{}'], {
                type: 'object',
                properties: {
                    bar: { type: 'string' },
                    test1: { type: 'string' },
                    test2: {
                        type: 'array',
                        items : {
                           type: 'integer'
                        }
                    },
                    test3: {
                        type: 'object',
                        properties: {
                            object1: {type: 'integer'}
                        }
                    }
                }
            }, {
                get: this.fooGetSpy,
                post: this.fooPostSpy
            });

            this.router.route(['/derp', 'test2'], {
                type: 'object',
                properties: {
                    flerp: { type: 'string' },
                    fleep: { type: 'string' },
                    test2: { type: 'string' }
                }
            }, {
                get: this.derpGetSpy,
                patch: this.derpPatchSpy,
                post: this.derpPostSpy,
                put: this.derpPutSpy
            });

            this.router.route('/enumtest', {
                type: 'object',
                properties: {
                    foo: {
                        type: 'string',
                        enum: ['bar', 'baz']
                    }
                }
            }, {
                get: this.enumTestGetSpy,
                patch: this.enumTestPatchSpy,
                post: this.enumTestPostSpy,
                put: this.enumTestPutSpy
            });

            // Stub request
            this.req = {
                method: 'GET',
                url: '/foo?props=bar',
                headers: {}
            };

            // Stub response
            this.res = {
                setHeader: sinon.spy(),
                end: sinon.spy(),
                statusCode: 200 // default
            };

            // Stub next
            this.next = sinon.spy();
        });

        it('is a function', function() {
            var middleware = this.router.middleware();
            middleware.should.be.a('function');
        });

        describe('GET request matching API endpoint', function() {
            beforeEach(function() {
                this.req.method ='GET';
                this.req.url = '/foo?props=bar,test1';
                this.middleware = this.router.middleware();
            });

            it('responds with HTTP status code 200', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.should.have.property('statusCode', 200);
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with header Content-Type: application/json', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.setHeader.calledWith('Content-Type', 'application/json').should.be.true;
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            describe('if speficied in url returns default get parameter', function() {
                it('which is a string', function(done) {
                    this.req.url = '/foo?props=bar,test1&test1=hello';
                    this.middleware = this.router.middleware();
                    this.res.end = sinon.spy(function() {
                        this.res.end.lastCall.args[0].should.be.ok;
                        var obj = JSON.parse(this.res.end.lastCall.args[0]);

                        obj.should.contain({
                            test1: 'hello'
                        });

                        done();
                    }.bind(this));

                    this.middleware(this.req, this.res, this.next);
                });

                it('which is an array', function(done) {
                    this.req.url = '/foo?props=test2&test2[]=[1, 2]';
                    this.middleware = this.router.middleware();
                    this.res.end = sinon.spy(function() {
                        this.res.end.lastCall.args[0].should.be.ok;
                        var obj = JSON.parse(this.res.end.lastCall.args[0]);
                        obj.test2.should.deep.equal([1, 2]);

                        done();
                    }.bind(this));

                    this.middleware(this.req, this.res, this.next);
                });

                it('get parameter is an object', function(done) {
                    this.req.url = '/foo?test3{}={"object1": 23}';
                    this.middleware = this.router.middleware();
                    this.res.end = sinon.spy(function() {
                        this.res.end.lastCall.args[0].should.be.ok;
                        var obj = JSON.parse(this.res.end.lastCall.args[0]);
                        obj.test3.should.deep.equal({object1: 23});

                        done();
                    }.bind(this));

                    this.middleware(this.req, this.res, this.next);
                });
            });

            it('returns default get parameter if not speficied in url', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.end.lastCall.args[0].should.be.ok;
                    var obj = JSON.parse(this.res.end.lastCall.args[0]);

                    obj.should.contain({
                        test1: 'hi'
                    });

                    done();
                }.bind(this));

                this.middleware(this.req, this.res, this.next);
            });

            it('responds with JSON body', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.end.lastCall.args[0].should.be.ok;
                    var obj = JSON.parse(this.res.end.lastCall.args[0]);
                    obj.should.contain({
                        bar: 'test_bar'
                    });
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            describe('unserializable result', function() {
                beforeEach(function() {
                    this.badResource = { bar: 'test bar' };
                    // Force serialization to fail
                    sinon.stub(JSON, 'stringify')
                    .returns('{}') // return plain JSON by defailt
                    .withArgs(this.badResource, null, 2).throws(new Error("Unable to serialize object"));
                });

                afterEach(function() {
                    JSON.stringify.restore();
                });

                it('responds with HTTP status code of 500 when unable to generate JSON', function(done) {
                    this.router.route('/bad-resource', {
                        type: 'object',
                        properties: {
                            bar: { type: 'string' }
                        }
                    }, {
                        get: function(params, req) {
                            return this.badResource
                        }.bind(this)
                    });
                    this.req.url = '/bad-resource?props=bar'
                    this.res.end = sinon.spy(function() {
                        this.res.should.have.property('statusCode', 500);
                        done();
                    }.bind(this));
                    this.middleware(this.req, this.res, this.next);
                });
            });
        });

        describe('GET request not matching API endpoint', function() {
            beforeEach(function() {
                this.req.method ='GET';
                this.req.url = '/unknown?props=bar';
                this.middleware = this.router.middleware();
            });

            it('responds with HTTP status code 404', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.should.have.property('statusCode', 404);
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with header Content-Type: application/json', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.setHeader.calledWith('Content-Type', 'application/json').should.be.true;
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with JSON body', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.end.lastCall.args[0].should.be.ok;
                    var obj = JSON.parse(this.res.end.lastCall.args[0]);
                    obj.should.not.contain({
                        bar: 'test_bar'
                    });

                    // TODO: Determine standard model for error objects
                    obj.should.have.property('error');
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });
        });

        describe('custom HTTP status response with no body', function() {
            beforeEach(function() {
                this.router = new Router();
                this.router.route('/foo', {
                    type: 'array',
                    items: {
                        anything: { type: 'string' }
                    }
                }, {
                    post: function(request) {
                        return request.status(201);
                    }.bind(this)
                });
                this.middleware = this.router.middleware();
                this.req.method = 'POST';
                this.req.url = '/foo';
            });

            it('provide status as httpStatus property', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.should.have.property('statusCode', 201);
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });
        });

        describe('custom HTTP status response with body', function() {
            beforeEach(function() {
                this.router = new Router();
                this.router.route('/foo', {
                    type: 'array',
                    items: {
                        anything: { type: 'string' }
                    }
                }, {
                    post: function(request) {
                        return request.status(201, {
                            anything: 'canary'
                        });
                    }.bind(this)
                });
                this.middleware = this.router.middleware();
                this.req.method = 'POST';
                this.req.url = '/foo';
            });

            it('provide status as httpStatus property', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.should.have.property('statusCode', 201);
                    var obj = JSON.parse(this.res.end.lastCall.args[0]);
                    obj.should.have.property('anything', 'canary');
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });
        });

        describe('OPTIONS', function() {
            beforeEach(function() {
                this.req.method = 'OPTIONS';
                this.req.url = '/foo';
                this.middleware = this.router.middleware();
            });

            it('responds with HTTP status code 200', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.should.have.property('statusCode', 200);
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with header Content-Type: application/json', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.setHeader.calledWith('Content-Type', 'application/json').should.be.true;
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with JSON body', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.end.lastCall.args[0].should.be.ok;
                    expect(function() {
                        var obj = JSON.parse(this.res.end.lastCall.args[0]);
                    }.bind(this)).to.not.throw();
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with schema', function(done) {
                this.res.end = sinon.spy(function() {
                    this.res.end.lastCall.args[0].should.be.ok;
                    var obj = JSON.parse(this.res.end.lastCall.args[0]);
                    obj.should.have.property('schema');
                    obj.schema.should.deep.equal({
                        type: 'object',
                        properties: {
                            bar: { type: 'string' },
                            test1: { type: 'string' },
                            test2: {type: 'array', items: {type: 'integer'}},
                            test3: {type: 'object', properties: {object1: {type: 'integer'}}}
                        }
                    });
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });

            it('responds with available methods', function(done) {
                this.res.end = sinon.spy(function(response) {
                    this.res.end.lastCall.args[0].should.be.ok;
                    var obj = JSON.parse(this.res.end.lastCall.args[0]);
                    obj.should.have.property('methods');
                    obj.methods.should.contain('GET');
                    obj.methods.should.contain('OPTIONS');
                    obj.methods.should.contain('POST');
                    obj.methods.should.not.contain('PUT');
                    obj.methods.should.not.contain('PATCH');
                    obj.methods.should.not.contain('DELETE');
                    done();
                }.bind(this));
                this.middleware(this.req, this.res, this.next);
            });
        });

        describe('request resource validation', function () {
            beforeEach(function () {
                this.middleware = this.router.middleware();
            });

            [Request.METHOD_PATCH, Request.METHOD_POST, Request.METHOD_PUT].forEach(function (method) {
                it('returns 422 HTTP code when ' + method + ' request\'s body fails schema validation because it only receives invalid property names', function (done) {
                    this.res.end = sinon.spy(function() {
                        this.res.should.have.property('statusCode', 422);
                        done();
                    }.bind(this));
                    this.req.method = method;
                    this.req.url = '/derp';
                    this.req.body = {
                        invalidPropertyName: 'lala'
                    };
                    this.middleware(this.req, this.res, this.next);
                });

                it('returns 422 HTTP code when ' + method + ' request\'s body fails schema validation because it receives invalid property names along with valid property names', function (done) {
                    this.res.end = sinon.spy(function() {
                        this.res.should.have.property('statusCode', 422);
                        done();
                    }.bind(this));
                    this.req.method = method;
                    this.req.url = '/derp';
                    this.req.body = {
                        invalidPropertyName: 'lala',
                        flerp: 'woo'
                    };
                    this.middleware(this.req, this.res, this.next);
                });

                it('returns 200 HTTP code when ' + method + ' request\'s body passes schema validation', function (done) {
                    this.res.end = sinon.spy(function() {
                        this.res.should.have.property('statusCode', 200);
                        done();
                    }.bind(this));
                    this.req.method = method;
                    this.req.url = '/derp';
                    this.req.body = {
                        flerp: 'woo'
                    };
                    this.middleware(this.req, this.res, this.next);
                });

                it('ignores $id and $expires properties and returns 200 HTTP code when ' + method + ' request\'s body passes schema validation', function (done) {
                    this.res.end = sinon.spy(function() {
                        this.res.should.have.property('statusCode', 200);
                        done();
                    }.bind(this));
                    this.req.method = method;
                    this.req.url = '/derp';
                    this.req.body = {
                        flerp: 'woo',
                        $id: 12,
                        $expires: new Date()
                    };
                    this.middleware(this.req, this.res, this.next);
                });

                it('returns 422 HTTP code when ' + method + ' request\'s body fails schema validation because the property contains a value not in the enum', function (done) {
                    this.res.end = sinon.spy(function() {
                        this.res.should.have.property('statusCode', 422);
                        done();
                    }.bind(this));
                    this.req.method = method;
                    this.req.url = '/enumtest';
                    this.req.body = {
                        foo: 'lala'
                    };
                    this.middleware(this.req, this.res, this.next);
                });

                it('returns 200 HTTP code when ' + method + ' request\'s body passes schema validation', function (done) {
                    this.res.end = sinon.spy(function() {
                        this.res.should.have.property('statusCode', 200);
                        done();
                    }.bind(this));
                    this.req.method = method;
                    this.req.url = '/enumtest';
                    this.req.body = {
                        foo: 'bar'
                    };
                    this.middleware(this.req, this.res, this.next);
                });
            });
        });

        describe('GET request not matching base path', function() {
            beforeEach(function() {
                this.middleware = this.router.middleware({
                    basePath: '/my-api'
                });
            });

            it('calls next', function() {
                this.req.method ='GET';
                this.req.url = '/foo?props=bar';
                this.middleware(this.req, this.res, this.next);
                this.next.called.should.be.true;
            });
        });

        describe('POST to batch endpoint', function() {
            beforeEach(function() {
                this.middleware = this.router.middleware({
                    basePath: '/my-api'
                });
            });

            it('processes each batched GET request', function(done) {
                this.req.method ='POST';
                this.req.url = '/my-api/_batch';
                this.req.body = [
                    {
                        method: 'GET',
                        url: '/foo'
                    },
                    {
                        method: 'GET',
                        url: '/derp'
                    }
                ];

                this.res.end = function(response) {
                    var results = JSON.parse(response);
                    results.should.have.lengthOf(2);

                    results[0].should.have.property('status', 200);
                    results[0].should.have.property('body');
                    results[0].body.should.contain({ bar: 'test_bar' });

                    results[1].should.have.property('status', 200);
                    results[1].should.have.property('body');
                    results[1].body.should.contain({ flerp: 'test_flerp' });

                    done();
                }.bind(this);

                this.middleware(this.req, this.res, this.next);
            });

            it('processes each batched POST request', function(done) {
                this.req.method ='POST';
                this.req.url = '/my-api/_batch';
                this.req.body = [
                    {
                        method: 'POST',
                        url: '/foo',
                        body: { bar: 'updated_bar' }
                    },
                    {
                        method: 'POST',
                        url: '/derp',
                        body: { flerp: 'updated_flerp' }
                    }
                ];

                this.res.end = function(response) {
                    var results = JSON.parse(response);
                    results.should.have.lengthOf(2);

                    results[0].should.have.property('status', 200);
                    results[0].should.have.property('body');
                    results[0].body.should.contain({ bar: 'updated_bar' });

                    results[1].should.have.property('status', 200);
                    results[1].should.have.property('body');
                    results[1].body.should.contain({ flerp: 'updated_flerp' });

                    done();
                }.bind(this);

                this.middleware(this.req, this.res, this.next);
            });

            it('processes mixed batched requests', function(done) {
                this.req.method ='POST';
                this.req.url = '/my-api/_batch';
                this.req.body = [
                    {
                        method: 'GET',
                        url: '/foo',
                        body: { bar: 'updated_bar' }
                    },
                    {
                        method: 'POST',
                        url: '/derp',
                        body: { flerp: 'updated_flerp' }
                    }
                ];

                this.res.end = function(response) {
                    this.fooGetSpy.called.should.be.true;
                    this.fooPostSpy.called.should.be.false;
                    this.derpGetSpy.called.should.be.false;
                    this.derpPostSpy.called.should.be.true;
                    done();
                }.bind(this);

                this.middleware(this.req, this.res, this.next);
            });

            it('passes query to appropriate request', function(done) {
                this.req.method ='POST';
                this.req.url = '/my-api/_batch';
                this.req.body = [
                    {
                        method: 'GET',
                        url: '/foo?test1=canary%20foo'
                    },
                    {
                        method: 'GET',
                        url: '/derp?test2=canary%20derp'
                    }
                ];

                this.res.end = function(response) {
                    this.fooGetSpy.called.should.be.true;
                    var fooRequest = this.fooGetSpy.lastCall.args[0];
                    fooRequest.getUrl().query.should.contain({
                        test1: 'canary foo'
                    });

                    this.derpGetSpy.called.should.be.true;
                    var derpRequest = this.derpGetSpy.lastCall.args[0];
                    derpRequest.getUrl().query.should.contain({
                        test2: 'canary derp'
                    });

                    done();
                }.bind(this);

                this.middleware(this.req, this.res, this.next);
            });
        });
    });

    describe('post-route hook', function() {
        beforeEach(function() {
            this.router = new Router();
            this.connection = new Connection(this.router, {}, {});
            this.clock = sinon.useFakeTimers(10000000);

            this.schema = {
                type: 'object',
                properties: {
                    foo: { type: 'string' },
                    bar: { type: 'string' }
                }
            };

            this.route = this.router.route('/foo', this.schema, {
                get: function() {
                    return new Resource('/foo', {
                        foo: 'test_foo',
                        bar: 'test_bar'
                    }, 1000);
                }
            });
        });

        afterEach(function() {
            this.clock.restore();
        });

        it('can modify the resource', function() {
            this.router.postRoute(function(resource) {
                resource.foo = 'modified_foo';
                return resource;
            });

            return this.connection.get('/foo')
            .then(function(resource) {
                resource.foo.should.equal('modified_foo');
            });
        });

        it('can modify the resource by returning a promise', function() {
            this.router.postRoute(function(resource) {
                return new Promise(function(resolve, reject) {
                    resource.foo = 'modified_foo';
                    resolve(resource);
                });
            });

            return this.connection.get('/foo')
            .then(function(resource) {
                resource.foo.should.equal('modified_foo');
            });
        });

        it('can register multiple modifiers', function() {
            this.router.postRoute(function(resource) {
                resource.foo = 'modified_foo';
                return resource;
            });

            this.router.postRoute(function(resource) {
                resource.bar = 'modified_bar';
                return resource;
            });

            return this.connection.get('/foo')
            .then(function(resource) {
                resource.foo.should.equal('modified_foo');
                resource.bar.should.equal('modified_bar');
            });
        });

        it('runs multiple handlers in FIFO order', function() {
            this.router.postRoute(function(resource) {
                resource.foo = 'modified_foo_1';
                return resource;
            });

            this.router.postRoute(function(resource) {
                resource.foo = 'modified_foo_2';
                return resource;
            });

            return this.connection.get('/foo')
            .then(function(resource) {
                resource.foo.should.equal('modified_foo_2');
            });
        });
    });

    describe('alias', function() {
        beforeEach(function() {
            this.router = new Router();
            this.connection = new Connection(this.router, {}, {});
            this.fooSchema = {
                type: 'object',
                properties: {
                    name: {
                        type: 'string'
                    }
                }
            };
            this.getFoo = sinon.stub()
            .returns({ name: 'test name' });
        });

        it('exposes an endpoint under a simple string aliased path', function() {
            this.router.route('/foo', this.fooSchema, {
                get: this.getFoo
            });
            this.router.alias('/bar', '/foo');

            return this.connection.get('/bar')
            .then(function(resource) {
                resource.should.have.property('name', 'test name');
            });
        });

        it('exposes a dynamic endpoint under a simple string aliased path', function() {
            this.router.route('/foo', this.fooSchema, {
                get: this.getFoo
            });
            this.router.alias('/bar', function(request, connection) {
                request.setResourceId('/foo');
                return request;
            });

            return this.connection.get('/bar')
            .then(function(resource) {
                resource.should.have.property('name', 'test name');
            });
        });

        it('exposes a dynamic endpoint asynchronously under a simple string aliased path', function() {
            this.router.route('/foo', this.fooSchema, {
                get: this.getFoo
            });
            this.router.alias('/bar', function(request, connection) {
                return new Promise(function(resolve, reject) {
                    request.setResourceId('/foo');
                    resolve(request);
                });
            });

            return this.connection.get('/bar')
            .then(function(resource) {
                resource.should.have.property('name', 'test name');
            });
        });

        it('throws an error if target resource id matches aliased resource id', function() {
            this.router.route('/foo', this.fooSchema, {
                get: this.getFoo
            });
            this.router.alias('/bar', function(request, connection) {
                return new Promise(function(resolve, reject) {
                    request.setResourceId('/bar'); // Same as alias
                    resolve(request);
                });
            });

            return this.connection.get('/bar')
            .then(function(resource) {
                throw new Error('Did not expect promise to resolve');
            })
            .catch(function(error) {
                error.should.have.property('code', 508); // 508: LOOP DETECTED
                error.should.have.property('message', 'Alias pointed back to itself');
            });
        });

        [
            'string',
            123,
            1.23,
            -1,
            0,
            true,
            false,
            [],
            {},
            undefined,
            null,
            function() {}
        ].forEach(function(invalidRequest) {
            it('throws an error if function returns a non-request instance, ' + JSON.stringify(invalidRequest), function() {
                this.router.route('/foo', this.fooSchema, {
                    get: this.getFoo
                });
                this.router.alias('/bar', function(request, connection) {
                    return invalidRequest;
                });

                return this.connection.get('/bar')
                .then(function(resource) {
                    throw new Error('Did not expect promise to resolve');
                })
                .catch(function(error) {
                    error.should.have.property('code', 500);
                    error.should.have.property('message', 'Alias did not resolve to a Request instance');
                });
            });

            it('throws an error if function returns a promise that resolves with a non-request instance, ' + JSON.stringify(invalidRequest), function() {
                this.router.route('/foo', this.fooSchema, {
                    get: this.getFoo
                });
                this.router.alias('/bar', function(request, connection) {
                    return Promise.resolve(invalidRequest);
                });

                return this.connection.get('/bar')
                .then(function(resource) {
                    throw new Error('Did not expect promise to resolve');
                })
                .catch(function(error) {
                    error.should.have.property('code', 500);
                    error.should.have.property('message', 'Alias did not resolve to a Request instance');
                });
            });
        });

        it('supports patterns', function() {
            this.router.route('/users/:userId', {
                type: 'object',
                properties: {
                    userId: {
                        type: 'integer'
                    }
                }
            }, {
                get: function(request, connection) {
                    return {
                        userId: request.getParam('userId')
                    };
                }
            });

            this.router.alias('/users/u/:username', function(request, connection) {
                request.setResourceId('/users/123');
                return request;
            });

            return this.connection.get('/users/u/john')
            .then(function(user) {
                user.should.have.property('userId', 123);
            });
        });

        it('does not leak alias param to aliased callback handler', function() {
            var getSpy = sinon.spy(function(request, connection) {
                expect(request.getParam('username')).to.be.undefined;
                return {
                    userId: request.getParam('userId')
                };
            });

            this.router.route('/users/:userId', {
                type: 'object',
                properties: {
                    userId: {
                        type: 'integer'
                    }
                }
            }, {
                get: getSpy
            });

            this.router.alias('/users/u/:username', function(request, connection) {
                request.setResourceId('/users/123');
                return request;
            });

            return this.connection.get('/users/u/john')
            .then(function(result) {
                getSpy.called.should.be.true;
            })
        });


        // Skipping for now, solving this isn't particularly easy due to batching and persistent connections.
        it.skip('throws an error if circular aliases are detected', function() {
            this.router.alias('/foo', '/bar');
            this.router.alias('/bar', '/foo');

            return this.connection.get('/foo')
            .then(function(resource) {
                throw new Error('Did not expect promise to resolve');
            })
            .catch(function(error) {
                error.should.have.property('code', 508); // 508: LOOP DETECTED
                error.should.have.property('message', 'Circular aliases cannot be resolved');
            });
        });
    });
});
