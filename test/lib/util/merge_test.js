var merge = require(LIB_DIR + '/util/merge');

describe('util: merge', function() {
    describe('with no arguments', function() {
        it('returns `undefined`', function() {
            expect(merge()).to.be.undefined;
        });
    });

    describe('with 1 argument', function() {
        [
            { foo: 'test foo', bar: 'test bar' },
            [ 'foo', 'bar' ],
            'foobar'
        ].forEach(function(value) {
            it('returns argument unchanged with value ' + JSON.stringify(value), function() {
                merge(value).should.equal(value);
            });
        });
    });

    describe('with 2 arguments', function() {
        describe('simple objects', function() {
            it('merges properties from b into a', function() {
                var a = { foo: 'test foo' };
                var b = { bar: 'test bar' };
                var result = merge(a, b);
                result.should.have.property('foo', 'test foo');
                result.should.have.property('bar', 'test bar');
            });

            it('overwrites existing key in a with value from b', function() {
                var a = { foo: 'test foo' };
                var b = { foo: 'different foo' };
                var result = merge(a, b);
                result.should.have.property('foo', 'different foo');
            });
        });

        describe('object instances', function() {
            beforeEach(function() {
                this.Thing = function(name) {
                    this.name = name;
                };
                this.Thing.prototype.say = function(message) {
                    return this.name + ' says ' + message;
                };
            });

            it('keeps prototype methods', function() {
                var a = new this.Thing('a');
                var b = new this.Thing('b');
                var result = merge(a, b);
                result.say.should.be.a('function');
                result.say('hi').should.equal('b says hi');
            });

            it('keeps class type', function() {
                var a = new this.Thing('a');
                var b = new this.Thing('b');
                var result = merge(a, b);
                result.should.be.instanceOf(this.Thing);
            });
        });

        describe('deep objects', function() {
            it('merges deep properties', function() {
                var a = {
                    foo: {
                        bar: {
                            derp: 'test derp'
                        }
                    }
                };
                var b = {
                    foo: {
                        bar: {
                            flerp: 'test flerp'
                        }
                    }
                };
                var result = merge(a, b);
                result.should.deep.equal({
                    foo: {
                        bar: {
                            derp: 'test derp',
                            flerp: 'test flerp'
                        }
                    }
                });
            });
        });

        describe('arrays', function() {
            it('merges values by index', function() {
                var a = [
                    { foo: 'a foo 1', bar: 'a bar 1' },
                    { foo: 'a foo 2' },
                    { foo: 'a foo 3' }
                ];
                var b = [
                    { foo: 'b foo 1', bar: 'b bar 1' },
                    { foo: 'b foo 2' },
                    { bar: 'b bar 3' }
                ];
                var result = merge(a, b);
                result.should.have.lengthOf(3);
                result.should.be.an('array');
                result[0].should.deep.equal({ foo: 'b foo 1', bar: 'b bar 1' });
                result[1].should.deep.equal({ foo: 'b foo 2' });
                result[2].should.deep.equal({ foo: 'a foo 3', bar: 'b bar 3' });
            });
        });

        describe('complex objects', function() {
            it('merges objects deeply including arrays', function() {
                var usersA = {
                    total: 20,
                    items: [
                        {
                            displayName: 'Alice',
                            age: 30,
                            lastOnline: new Date(1000),
                            favoriteColors: [ 'red', 'pink' ]
                        },
                        {
                            displayName: 'Jane',
                            age: 23,
                            lastOnline: new Date(2000),
                            favoriteColors: [ 'blue' ]
                        }
                    ]
                };

                var usersB = {
                    userId: 1,
                    items: [
                        {
                            email: 'alice@example.com',
                            emailValidated: true,
                            photo: {
                                url: '/alice.jpg'
                            }
                        },
                        {
                            email: 'jane@example.com',
                            emailValidated: false,
                            photo: {
                                url: '/jane.jpg'
                            }
                        },
                        {
                            email: 'test@test.com'
                        }
                    ],
                    luv : {
                        points: 1
                    }
                };

                var usersC = {
                    page: 3,
                    items: [
                        {
                            music: 'rap',
                            photo: {
                                image: 'alice'
                            }
                        },
                        {
                            book: 'vampire',
                            photo: {
                                image: 'jane'
                            }
                        },
                        {
                            photo: {
                                image: 'test'
                            }
                        }
                    ],
                    luv: {
                        balance: 3
                    }
                };

                var result = merge(usersA, usersB, usersC);


                result.should.have.property('total', 20);
                result.should.have.property('page', 3);
                result.should.have.property('userId', 1);
                result.items.should.have.lengthOf(3);

                // Validate first user merged properly
                result.luv.should.deep.equal({balance: 3, points: 1})
                result.items[0].should.have.property('displayName', 'Alice');
                result.items[0].should.have.property('age', 30);
                result.items[0].should.have.property('music', 'rap');
                result.items[0].should.have.property('lastOnline');
                result.items[0].lastOnline.getTime().should.equal(new Date(1000).getTime());
                result.items[0].should.have.property('favoriteColors');
                result.items[0].favoriteColors.should.have.lengthOf(2);
                result.items[0].favoriteColors.should.contain('red');
                result.items[0].favoriteColors.should.contain('pink');
                result.items[0].should.have.property('emailValidated', true);
                result.items[0].should.have.property('email', 'alice@example.com');
                result.items[0].should.have.property('photo');
                result.items[0].photo.should.deep.equal({ url: '/alice.jpg', image: 'alice' });


                // Validate second user merged properly
                result.items[1].should.have.property('displayName', 'Jane');
                result.items[1].should.have.property('age', 23);
                result.items[1].should.have.property('book', 'vampire');
                result.items[1].should.have.property('lastOnline');
                result.items[1].lastOnline.getTime().should.equal(new Date(2000).getTime());
                result.items[1].should.have.property('favoriteColors');
                result.items[1].favoriteColors.should.have.lengthOf(1);
                result.items[1].favoriteColors.should.contain('blue');
                result.items[1].should.have.property('emailValidated', false);
                result.items[1].should.have.property('email', 'jane@example.com');
                result.items[1].should.have.property('photo');
                result.items[1].photo.should.deep.equal({ url: '/jane.jpg', image: 'jane' });


                result.items[2].email.should.equal('test@test.com')
                result.items[2].photo.should.deep.equal({image: 'test'})
            });
        });
    });

    describe('with many arguments', function() {
        it('merges all of them, with last value overriding previous ones', function() {
            var result = merge(
                { foo: 'foo 0', bar: 'bar 0', derp: 'derp 0' },
                { foo: 'foo 1' },
                { bar: 'bar 2', derp: 'derp 2' },
                { haz: 'haz 3', derp: 'derp 3' }
            );
            result.should.deep.equal({
                foo: 'foo 1',
                bar: 'bar 2',
                derp: 'derp 3',
                haz: 'haz 3'
            });
        });
    });

    describe('with non-objects', function() {
        [
            [ 'foo' ],
            [ 'foo', 'bar' ],
            [ true, false ],
            [ 'a', 'b', 'c', 'd', 'e'],
            [ { foo: 'foo' }, null ],
            [ 1, NaN, 2, undefined, 0.4, true, 'foo', Infinity ]
        ].forEach(function(args) {
            var expectedResult = args[args.length - 1];
            it('returns ' + JSON.stringify(expectedResult) + ' from arguments ' + JSON.stringify(args), function() {
                expect(merge.apply(this, args)).to.equal(expectedResult);
            });
        });
    });
});
