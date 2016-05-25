var PropertyFilter = require('../../lib/PropertyFilter');

describe('PropertyFilter', function() {
    describe('with simple, one-dimensional object', function() {
        beforeEach(function() {
            this.data = {
                foo: 'test foo',
                bar: 'test bar',
                dur: 'test dur',
                $internal: 'test $internal',
                $other_internal: 'test $other_internal'
            };
            this.filter = new PropertyFilter(this.data);
        });

        describe('.props()', function() {
            beforeEach(function() {
                this.filtered = this.filter.props(['foo', 'bar']);
            });

            it('returns an object', function() {
                this.filtered.should.be.an('object');
            });

            it('keeps specified properties', function() {
                this.filtered.should.have.property('foo', 'test foo');
                this.filtered.should.have.property('bar', 'test bar');
            });

            it('keeps internal properties that start with `$`', function() {
                this.filtered.should.have.property('$internal', 'test $internal');
                this.filtered.should.have.property('$other_internal', 'test $other_internal');
            });

            it('discards unspecified properties', function() {
                this.filtered.should.not.have.property('dur');
            });

            it('returns data unchanged if no properties are specified', function() {
                this.filter.props().should.deep.equal(this.data); // no argument
                this.filter.props([]).should.deep.equal(this.data); // empty array
            });
        });
    });

    describe('with multi-dimensional object', function() {
        beforeEach(function() {
            this.data = {
                $id: 1,
                foo: 'test foo',
                bar: 'test bar',
                dur: 'test dur',
                child: {
                    $id: 2,
                    foo: 'test child foo',
                    bar: 'test child bar',
                    dur: 'test child dur',
                    grandchild: {
                        $id: 3,
                        foo: 'test grandchild foo',
                        bar: 'test grandchild bar',
                        dur: 'test grandchild dur'
                    }
                }
            };
            this.filter = new PropertyFilter(this.data);
        });

        describe('.props()', function() {
            describe('top-level props', function() {
                beforeEach(function() {
                    this.filtered = this.filter.props(['foo', 'bar', 'child']);
                });

                it('returns an object', function() {
                    this.filtered.should.be.an('object');
                });

                it('keeps specified properties', function() {
                    this.filtered.should.have.property('foo', 'test foo');
                    this.filtered.should.have.property('bar', 'test bar');
                    this.filtered.should.have.property('child');
                });

                it('does not clobber child objects', function() {
                    this.filtered.child.should.deep.equal(this.data.child);
                });

                it('keeps internal properties that start with `$`', function() {
                    this.filtered.should.have.property('$id', 1);
                    this.filtered.child.should.have.property('$id', 2);
                    this.filtered.child.grandchild.should.have.property('$id', 3);
                });

                it('discards unspecified properties', function() {
                    this.filtered.should.not.have.property('dur');
                });
            });

            describe('nested props', function() {
                beforeEach(function() {
                    this.filtered = this.filter.props([
                        'foo',
                        'child.foo',
                        'child.bar',
                        'child.grandchild.bar',
                        'child.grandchild.dur'
                    ]);
                });

                it('returns an object', function() {
                    this.filtered.should.be.an('object');
                });

                it('keeps specified properties', function() {
                    this.filtered.should.have.property('foo', 'test foo');
                    this.filtered.should.have.property('child');
                    this.filtered.child.should.have.property('foo');
                    this.filtered.child.should.have.property('bar');
                    this.filtered.child.should.have.property('grandchild');
                    this.filtered.child.grandchild.should.have.property('dur', 'test grandchild dur');
                });

                it('keeps nested internal properties that start with `$`', function() {
                    this.filtered.should.have.property('$id', 1);
                    this.filtered.child.should.have.property('$id', 2);
                    this.filtered.child.grandchild.should.have.property('$id', 3);
                });

                it('discards unspecified properties', function() {
                    this.filtered.should.not.have.property('bar');
                    this.filtered.should.not.have.property('dur');
                    this.filtered.child.should.not.have.property('dur');
                    this.filtered.child.grandchild.should.not.have.property('foo');
                });
            });
        });
    });

    describe('with multi-dimensional object containing symlinks', function() {
        beforeEach(function() {
            this.data = {
                $id: 1,
                foo: 'test foo',
                bar: 'test bar',
                dur: 'test dur',
                child1: { $link: '/parent/child1' },
                child2: { $link: '/parent/child2' },
            };
            this.filter = new PropertyFilter(this.data);
        });

        describe('.props()', function() {
            describe('top-level props', function() {
                beforeEach(function() {
                    this.filtered = this.filter.props(['foo', 'bar', 'child1']);
                });

                it('returns an object', function() {
                    this.filtered.should.be.an('object');
                });

                it('keeps specified properties', function() {
                    this.filtered.should.have.property('foo', 'test foo');
                    this.filtered.should.have.property('bar', 'test bar');
                    this.filtered.should.have.property('child1');
                });

                it('does not clobber symlink', function() {
                    this.filtered.child1.should.deep.equal(this.data.child1);
                });

                it('keeps internal properties that start with `$`', function() {
                    this.filtered.should.have.property('$id', 1);
                    this.filtered.child1.should.have.property('$link', '/parent/child1');
                });

                it('discards unspecified properties', function() {
                    this.filtered.should.not.have.property('dur');
                    this.filtered.should.not.have.property('child2');
                });
            });

            describe('nested props', function() {
                beforeEach(function() {
                    this.filtered = this.filter.props([
                        'foo',
                        'child1.foo',
                        'child1.bar',
                        'child1.grandchild.bar',
                        'child1.grandchild.dur'
                    ]);
                });

                it('returns an object', function() {
                    this.filtered.should.be.an('object');
                });

                it('keeps specified properties that are not symlinked', function() {
                    this.filtered.should.have.property('foo', 'test foo');
                    this.filtered.should.have.property('child1');
                });

                it('keeps nested internal properties that start with `$`', function() {
                    this.filtered.should.have.property('$id', 1);
                    this.filtered.child1.should.have.property('$link', '/parent/child1');
                });

                it('discards unspecified properties', function() {
                    this.filtered.should.not.have.property('bar');
                    this.filtered.should.not.have.property('dur');
                    this.filtered.should.not.have.property('child2');
                });
            });
        });
    });

    describe('with array of simple, one-dimensional objects', function() {
        beforeEach(function() {
            this.data = [
                {
                    foo: 'test foo 1',
                    bar: 'test bar 1',
                    dur: 'test dur 1',
                    $internal: 'test $internal 1',
                    $other_internal: 'test $other_internal 1'
                },
                {
                    foo: 'test foo 2',
                    bar: 'test bar 2',
                    dur: 'test dur 2',
                    $internal: 'test $internal 2',
                    $other_internal: 'test $other_internal 2'
                },
                {
                    foo: 'test foo 3',
                    bar: 'test bar 3',
                    dur: 'test dur 3',
                    $internal: 'test $internal 3',
                    $other_internal: 'test $other_internal 3'
                }
            ];
            this.filter = new PropertyFilter(this.data);
        });

        describe('.props()', function() {
            beforeEach(function() {
                this.filtered = this.filter.props(['@foo', '@bar']);
            });

            it('returns an array', function() {
                this.filtered.should.be.an('array');
            });

            it('keeps specified properties', function() {
                this.filtered[0].should.have.property('foo', 'test foo 1');
                this.filtered[0].should.have.property('bar', 'test bar 1');
                this.filtered[1].should.have.property('foo', 'test foo 2');
                this.filtered[1].should.have.property('bar', 'test bar 2');
                this.filtered[2].should.have.property('foo', 'test foo 3');
                this.filtered[2].should.have.property('bar', 'test bar 3');
            });

            it('keeps internal properties that start with `$`', function() {
                this.filtered[0].should.have.property('$internal', 'test $internal 1');
                this.filtered[0].should.have.property('$other_internal', 'test $other_internal 1');
                this.filtered[1].should.have.property('$internal', 'test $internal 2');
                this.filtered[1].should.have.property('$other_internal', 'test $other_internal 2');
                this.filtered[2].should.have.property('$internal', 'test $internal 3');
                this.filtered[2].should.have.property('$other_internal', 'test $other_internal 3');
            });

            it('discards unspecified properties', function() {
                this.filtered[0].should.not.have.property('dur');
                this.filtered[1].should.not.have.property('dur');
                this.filtered[1].should.not.have.property('dur');
            });
        });
    });

    describe('with array of multi-dimensional object', function() {
        beforeEach(function() {
            function createObject(id) {
                return {
                    $id: 'test id ' + id,
                    foo: 'test foo ' + id,
                    bar: 'test bar ' + id,
                    dur: 'test dur ' + id,
                    child: {
                        $id: 'test child id ' + id,
                        foo: 'test child foo ' + id,
                        bar: 'test child bar ' + id,
                        dur: 'test child dur ' + id,
                        grandchild: {
                            $id: 'test grandchild id ' + id,
                            foo: 'test grandchild foo ' + id,
                            bar: 'test grandchild bar ' + id,
                            dur: 'test grandchild dur ' + id
                        }
                    }
                };
            };

            this.data = [
                createObject(1),
                createObject(2),
                createObject(3)
            ];

            this.filter = new PropertyFilter(this.data);
        });

        describe('.props()', function() {
            describe('top-level props', function() {
                beforeEach(function() {
                    this.filtered = this.filter.props(['@foo', '@bar', '@child']);
                });

                it('returns an array', function() {
                    this.filtered.should.be.an('array');
                });

                it('keeps specified properties', function() {
                    this.filtered[0].should.have.property('foo', 'test foo 1');
                    this.filtered[0].should.have.property('bar', 'test bar 1');
                    this.filtered[0].should.have.property('child');

                    this.filtered[1].should.have.property('foo', 'test foo 2');
                    this.filtered[1].should.have.property('bar', 'test bar 2');
                    this.filtered[1].should.have.property('child');

                    this.filtered[2].should.have.property('foo', 'test foo 3');
                    this.filtered[2].should.have.property('bar', 'test bar 3');
                    this.filtered[2].should.have.property('child');
                });

                it('does not clobber child objects', function() {
                    this.filtered[0].child.should.deep.equal(this.data[0].child);
                    this.filtered[1].child.should.deep.equal(this.data[1].child);
                    this.filtered[2].child.should.deep.equal(this.data[2].child);
                });

                it('keeps internal properties that start with `$`', function() {
                    this.filtered[0].should.have.property('$id', 'test id 1');
                    this.filtered[0].child.should.have.property('$id', 'test child id 1');
                    this.filtered[0].child.grandchild.should.have.property('$id', 'test grandchild id 1');
                });

                it('discards unspecified properties', function() {
                    this.filtered[0].should.not.have.property('dur');
                    this.filtered[1].should.not.have.property('dur');
                    this.filtered[2].should.not.have.property('dur');
                });
            });

            describe('nested props', function() {
                beforeEach(function() {
                    this.filtered = this.filter.props([
                        '@foo',
                        '@child.foo',
                        '@child.bar',
                        '@child.grandchild.bar',
                        '@child.grandchild.dur'
                    ]);
                });

                it('returns an array', function() {
                    this.filtered.should.be.an('array');
                });

                it('keeps specified properties on all items', function() {
                    this.filtered[0].should.have.property('foo', 'test foo 1');
                    this.filtered[0].should.have.property('child');
                    this.filtered[0].child.should.have.property('foo', 'test child foo 1');
                    this.filtered[0].child.should.have.property('bar', 'test child bar 1');
                    this.filtered[0].child.should.have.property('grandchild');
                    this.filtered[0].child.grandchild.should.have.property('dur', 'test grandchild dur 1');

                    this.filtered[1].should.have.property('foo', 'test foo 2');
                    this.filtered[1].should.have.property('child');
                    this.filtered[1].child.should.have.property('foo', 'test child foo 2');
                    this.filtered[1].child.should.have.property('bar', 'test child bar 2');
                    this.filtered[1].child.should.have.property('grandchild');
                    this.filtered[1].child.grandchild.should.have.property('dur', 'test grandchild dur 2');

                    this.filtered[2].should.have.property('foo', 'test foo 3');
                    this.filtered[2].should.have.property('child');
                    this.filtered[2].child.should.have.property('foo', 'test child foo 3');
                    this.filtered[2].child.should.have.property('bar', 'test child bar 3');
                    this.filtered[2].child.should.have.property('grandchild');
                    this.filtered[2].child.grandchild.should.have.property('dur', 'test grandchild dur 3');
                });

                it('keeps nested internal properties that start with `$` on all items', function() {
                    this.filtered[0].should.have.property('$id', 'test id 1');
                    this.filtered[0].child.should.have.property('$id', 'test child id 1');
                    this.filtered[0].child.grandchild.should.have.property('$id', 'test grandchild id 1');

                    this.filtered[1].should.have.property('$id', 'test id 2');
                    this.filtered[1].child.should.have.property('$id', 'test child id 2');
                    this.filtered[1].child.grandchild.should.have.property('$id', 'test grandchild id 2');

                    this.filtered[2].should.have.property('$id', 'test id 3');
                    this.filtered[2].child.should.have.property('$id', 'test child id 3');
                    this.filtered[2].child.grandchild.should.have.property('$id', 'test grandchild id 3');
                });

                it('discards unspecified properties on all items', function() {
                    this.filtered[0].should.not.have.property('bar');
                    this.filtered[0].should.not.have.property('dur');
                    this.filtered[0].child.should.not.have.property('dur');
                    this.filtered[0].child.grandchild.should.not.have.property('foo');

                    this.filtered[1].should.not.have.property('bar');
                    this.filtered[1].should.not.have.property('dur');
                    this.filtered[1].child.should.not.have.property('dur');
                    this.filtered[1].child.grandchild.should.not.have.property('foo');

                    this.filtered[2].should.not.have.property('bar');
                    this.filtered[2].should.not.have.property('dur');
                    this.filtered[2].child.should.not.have.property('dur');
                    this.filtered[2].child.grandchild.should.not.have.property('foo');
                });
            });
        });
    });

    describe('object that contains array of objects', function() {
        beforeEach(function() {
            function createObject(id) {
                return {
                    $id: 'test id ' + id,
                    foo: 'test foo ' + id,
                    bar: 'test bar ' + id,
                    dur: 'test dur ' + id,
                };
            };

            this.data = {
                items: [
                    createObject(1),
                    createObject(2),
                    createObject(3)
                ]
            };

            this.filter = new PropertyFilter(this.data);
        });

        describe('.props()', function() {
            describe('top-level props from each item', function() {
                beforeEach(function() {
                    this.filtered = this.filter.props(['items@foo', 'items@bar']);
                });

                it('returns an object', function() {
                    this.filtered.should.be.an('object');
                });

                it('keeps specified properties on all items', function() {
                    this.filtered.items[0].should.have.property('foo', 'test foo 1');
                    this.filtered.items[0].should.have.property('bar', 'test bar 1');

                    this.filtered.items[1].should.have.property('foo', 'test foo 2');
                    this.filtered.items[1].should.have.property('bar', 'test bar 2');

                    this.filtered.items[2].should.have.property('foo', 'test foo 3');
                    this.filtered.items[2].should.have.property('bar', 'test bar 3');
                });

                it('keeps nested internal properties that start with `$` on all items', function() {
                    this.filtered.items[0].should.have.property('$id', 'test id 1');
                    this.filtered.items[1].should.have.property('$id', 'test id 2');
                    this.filtered.items[2].should.have.property('$id', 'test id 3');
                });

                it('discards unspecified properties on all items', function() {
                    this.filtered.items[0].should.not.have.property('dur');
                    this.filtered.items[1].should.not.have.property('dur');
                    this.filtered.items[2].should.not.have.property('dur');
                });
            });
        });
    });

    describe('array of objects that contains arrays of objects', function() {
        beforeEach(function() {
            function createObject(id) {
                return {
                    $id: 'test id ' + id,
                    foo: 'test foo ' + id,
                    bar: 'test bar ' + id,
                    dur: 'test dur ' + id,
                };
            };

            this.data = [
                {
                    items: [
                        createObject(1),
                        createObject(2),
                        createObject(3)
                    ]
                },
                {
                    items: [
                        createObject(4),
                        createObject(5),
                        createObject(6)
                    ]
                },
                {
                    items: [
                        createObject(7),
                        createObject(8),
                        createObject(9)
                    ]
                }
            ];

            this.filter = new PropertyFilter(this.data);
        });

        describe('.props()', function() {
            describe('top-level props from each item', function() {
                beforeEach(function() {
                    this.filtered = this.filter.props(['@items@foo', '@items@bar']);
                });

                it('returns an array', function() {
                    this.filtered.should.be.an('array');
                });

                it('returns missing error if requesting a non existent property', function() {
                     this.filtered = this.filter.props(['@items@foo2', '@items@foo.test', '@item2', 'foo', '@items']);
                     this.filtered.missing.should.deep.equal(['@items@foo2', '@items@foo.test' , '@item2', 'foo']);
                })

                it('keeps specified properties on all items', function() {
                    this.filtered[0].items[0].should.have.property('foo', 'test foo 1');
                    this.filtered[0].items[0].should.have.property('bar', 'test bar 1');
                    this.filtered[0].items[1].should.have.property('foo', 'test foo 2');
                    this.filtered[0].items[1].should.have.property('bar', 'test bar 2');
                    this.filtered[0].items[2].should.have.property('foo', 'test foo 3');
                    this.filtered[0].items[2].should.have.property('bar', 'test bar 3');

                    this.filtered[1].items[0].should.have.property('foo', 'test foo 4');
                    this.filtered[1].items[0].should.have.property('bar', 'test bar 4');
                    this.filtered[1].items[1].should.have.property('foo', 'test foo 5');
                    this.filtered[1].items[1].should.have.property('bar', 'test bar 5');
                    this.filtered[1].items[2].should.have.property('foo', 'test foo 6');
                    this.filtered[1].items[2].should.have.property('bar', 'test bar 6');

                    this.filtered[2].items[0].should.have.property('foo', 'test foo 7');
                    this.filtered[2].items[0].should.have.property('bar', 'test bar 7');
                    this.filtered[2].items[1].should.have.property('foo', 'test foo 8');
                    this.filtered[2].items[1].should.have.property('bar', 'test bar 8');
                    this.filtered[2].items[2].should.have.property('foo', 'test foo 9');
                    this.filtered[2].items[2].should.have.property('bar', 'test bar 9');
                });

                it('keeps nested internal properties that start with `$` on all items', function() {
                    this.filtered[0].items[0].should.have.property('$id', 'test id 1');
                    this.filtered[0].items[1].should.have.property('$id', 'test id 2');
                    this.filtered[0].items[2].should.have.property('$id', 'test id 3');

                    this.filtered[1].items[0].should.have.property('$id', 'test id 4');
                    this.filtered[1].items[1].should.have.property('$id', 'test id 5');
                    this.filtered[1].items[2].should.have.property('$id', 'test id 6');

                    this.filtered[2].items[0].should.have.property('$id', 'test id 7');
                    this.filtered[2].items[1].should.have.property('$id', 'test id 8');
                    this.filtered[2].items[2].should.have.property('$id', 'test id 9');
                });

                it('discards unspecified properties on all items', function() {
                    this.filtered[0].items[0].should.not.have.property('dur');
                    this.filtered[0].items[1].should.not.have.property('dur');
                    this.filtered[0].items[2].should.not.have.property('dur');

                    this.filtered[1].items[0].should.not.have.property('dur');
                    this.filtered[1].items[1].should.not.have.property('dur');
                    this.filtered[1].items[2].should.not.have.property('dur');

                    this.filtered[2].items[0].should.not.have.property('dur');
                    this.filtered[2].items[1].should.not.have.property('dur');
                    this.filtered[2].items[2].should.not.have.property('dur');
                });
            });
        });
    });

    describe('complex structure 1', function() {
        beforeEach(function() {
            function createObject(id) {
                return {
                    $id: 'test id ' + id,
                    foo: 'test foo ' + id,
                    bar: 'test bar ' + id,
                    dur: 'test dur ' + id,
                    children: [
                        {
                            lerp: 'test lerp 1 ' + id,
                            merp: 'test merp 1 ' + id
                        },
                        {
                            lerp: 'test lerp 2 ' + id,
                            merp: 'test merp 2 ' + id
                        },
                        {
                            lerp: 'test lerp 3 ' + id,
                            merp: 'test merp 3 ' + id
                        }
                    ]
                };
            };

            this.data = [
                {
                    items: [
                        createObject(1),
                        createObject(2),
                        createObject(3)
                    ]
                },
                {
                    items: [
                        createObject(4),
                        createObject(5),
                        createObject(6)
                    ]
                },
                {
                    items: [
                        createObject(7),
                        createObject(8),
                        createObject(9)
                    ]
                }
            ];

            this.filter = new PropertyFilter(this.data);
        });

        describe('.props()', function() {
            describe('top-level props from each item', function() {
                beforeEach(function() {
                    this.filtered = this.filter.props(['@items@foo', '@items@children@lerp']);
                });

                it('returns an array', function() {
                    this.filtered.should.be.an('array');
                });

                it('keeps only what we asked for and special properties', function() {
                    this.filtered.should.deep.equal([
                        {
                            items: [
                                {
                                    $id: 'test id 1',
                                    foo: 'test foo 1',
                                    children: [
                                        { lerp: 'test lerp 1 1' },
                                        { lerp: 'test lerp 2 1' },
                                        { lerp: 'test lerp 3 1' }
                                    ]
                                },
                                {
                                    $id: 'test id 2',
                                    foo: 'test foo 2',
                                    children: [
                                        { lerp: 'test lerp 1 2' },
                                        { lerp: 'test lerp 2 2' },
                                        { lerp: 'test lerp 3 2' }
                                    ]
                                },
                                {
                                    $id: 'test id 3',
                                    foo: 'test foo 3',
                                    children: [
                                        { lerp: 'test lerp 1 3' },
                                        { lerp: 'test lerp 2 3' },
                                        { lerp: 'test lerp 3 3' }
                                    ]
                                }
                            ]
                        },
                        {
                            items: [
                                {
                                    $id: 'test id 4',
                                    foo: 'test foo 4',
                                    children: [
                                        { lerp: 'test lerp 1 4' },
                                        { lerp: 'test lerp 2 4' },
                                        { lerp: 'test lerp 3 4' }
                                    ]
                                },
                                {
                                    $id: 'test id 5',
                                    foo: 'test foo 5',
                                    children: [
                                        { lerp: 'test lerp 1 5' },
                                        { lerp: 'test lerp 2 5' },
                                        { lerp: 'test lerp 3 5' }
                                    ]
                                },
                                {
                                    $id: 'test id 6',
                                    foo: 'test foo 6',
                                    children: [
                                        { lerp: 'test lerp 1 6' },
                                        { lerp: 'test lerp 2 6' },
                                        { lerp: 'test lerp 3 6' }
                                    ]
                                }
                            ]
                        },
                        {
                            items: [
                                {
                                    $id: 'test id 7',
                                    foo: 'test foo 7',
                                    children: [
                                        { lerp: 'test lerp 1 7' },
                                        { lerp: 'test lerp 2 7' },
                                        { lerp: 'test lerp 3 7' }
                                    ]
                                },
                                {
                                    $id: 'test id 8',
                                    foo: 'test foo 8',
                                    children: [
                                        { lerp: 'test lerp 1 8' },
                                        { lerp: 'test lerp 2 8' },
                                        { lerp: 'test lerp 3 8' }
                                    ]
                                },
                                {
                                    $id: 'test id 9',
                                    foo: 'test foo 9',
                                    children: [
                                        { lerp: 'test lerp 1 9' },
                                        { lerp: 'test lerp 2 9' },
                                        { lerp: 'test lerp 3 9' }
                                    ]
                                }
                            ]
                        }
                    ]);
                });
            });
        });
    });

    describe('complex structure 2', function() {
        beforeEach(function() {
            this.data = {
                foo: 'test foo',
                bar: 'test bar',
                dur: 'test dur',
                objecto : {
                    hello: 'hey',
                    helloObject: {
                        hello : 3
                    },
                    items: [
                        {
                            user: {
                                $id: 'test',
                                userId: 123,
                                displayName: 'hey'
                            },
                            symlink: {
                                $link: 'test'
                            }

                        },
                        {
                            user: {
                                $id: 'yo',
                                userId: 345,
                                displayName: 'random'
                            },
                            symlink: {
                                $link: 'test'
                            }

                        }


                    ]
                },
                items: [
                    {
                        user: {
                            $id: 'test',
                            userId: 123,
                            displayName: 'hey'
                        },
                        symlink: {
                            $link: 'test'
                        }

                    }
                ]
            };
            this.filter = new PropertyFilter(this.data);
        });

        describe('.props() returns correct props', function() {

            it('if props is an object', function() {
                var expected = {
                    objecto: this.data['objecto']
                }
                 this.filter = new PropertyFilter(this.data);


                this.filter.props(['objecto']).should.deep.equal(expected);
            });

            it('if props is an object inside an object', function() {
                var expected = {
                    objecto: {
                        hello: this.data['objecto']['hello']
                    },
                    foo: this.data['foo']
                }
                this.filter = new PropertyFilter(this.data);

                this.filter.props(['objecto.hello', 'foo']).should.deep.equal(expected);
            });


            it('if props is a property inside an array', function() {
                var expected = {
                    objecto: {
                        helloObject: {
                            hello: this.data['objecto']['helloObject']['hello']
                        }
                    },
                    items: this.data['items'],
                    foo: this.data['foo']
                }
                this.filter = new PropertyFilter(this.data);
                var test = this.filter.props(['items@user.userId',  'items@user.displayName', 'foo', 'objecto.helloObject.hello', 'items@symlink']);

                test.should.deep.equal(expected);
            });

            it('if props is a property inside an array inside an object', function() {
                var expected = {
                    objecto: {
                        helloObject: {
                            hello: this.data['objecto']['helloObject']['hello']
                        },

                        items: [
                            {
                                user: this.data.objecto.items[0].user
                            },
                            {
                                user: this.data.objecto.items[1].user
                            },
                        ]

                    },
                    foo: this.data['foo']
                }
                this.filter = new PropertyFilter(this.data);
                var test = this.filter.props(['objecto.items@user.userId',  'objecto.items@user.displayName', 'foo', 'objecto.helloObject.hello']);

                test.should.deep.equal(expected);
            });

            it('when requesting props from multiple arrrays', function() {
                var expected = {
                    objecto: {
                        items: [
                            {
                                user: this.data.objecto.items[0].user
                            },
                            {
                                user: this.data.objecto.items[1].user
                            },
                        ]

                    },
                    items: this.data.items,
                    foo: this.data['foo']
                }
                this.filter = new PropertyFilter(this.data);
                var test = this.filter.props(['objecto.items@user.userId',  'objecto.items@user.displayName', 'foo', 'items@user', 'items@symlink']);

                test.should.deep.equal(expected);
            });

            it('when requesting props with the parent of the array', function() {
                var expected = {
                    objecto: {
                        items: this.data.objecto.items

                    },
                    items: this.data.items,
                }
                this.filter = new PropertyFilter(this.data);
                var test = this.filter.props(['objecto.items',  'items', 'items']);

                test.should.deep.equal(expected);
            });

            it('when requesting props with the object key', function() {
                var expected = {
                    objecto: this.data.objecto,
                    foo: this.data.foo
                }
                this.filter = new PropertyFilter(this.data);
                var test = this.filter.props(['objecto',  'foo']);

                test.should.deep.equal(expected);
            });

            [
                //Props requested, Props missing
                [['@foo'], ['@foo']],
                [['foo', 'unknown'], ['unknown']],
                [['foo$ds'], ['foo$ds']],
                [['foo', 'test', 'unknown'],    ['test', 'unknown']],
                [['items@not-exist'], ['items@not-exist']],
                [['items@user.not-exist'], ['items@user.not-exist']],
                [['items2@user.not-exist'], ['items2@user.not-exist']],
                [['random.random@randum.not-exist'], ['random.random@randum.not-exist']],
                [['objecto.hello1'], ['objecto.hello1']],
                [['objecto.helloObject.hello2'], ['objecto.helloObject.hello2']],
                [['objecto.items2', 'objecto.items2@test', 'object.items2@test.user333', 'foo'], ['objecto.items2', 'objecto.items2@test', 'object.items2@test.user333']]
            ].forEach(function(data) {
                it('returns error object if requested property does not exist', function() {
                    this.filter.props(data[0]).missing.should.deep.equal(data[1]);
                });
            });
        });
    });
});
