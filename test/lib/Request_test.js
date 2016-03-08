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

    describe('isCollection', function() {
        beforeEach(function() {
            this.request = new Request('/foo');
        });

        it('true if schema represents collection', function() {
            var collectionSchema = {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                test: {
                                    type: 'string'
                                }
                            }
                        }
                    }
                }
            };

            this.request.isCollection(collectionSchema).should.be.true;
        });

        it('false if schema is not a collection', function() {
            var collectionSchema = {
                type: 'object',
                properties: {
                    test: {
                        type: 'string'
                    }
                }
            };

            this.request.isCollection(collectionSchema).should.be.false;
        });
    });

    describe('binary uploads', function() {
        beforeEach(function() {
            this.router = null;
            this.boundary = '---------------------BOUNDARY';
            this.connection = {
                raw: {
                    req: {
                        method: 'ANYTHING', // Technically any method is allowed
                        headers: {
                            'content-type': 'multipart/form-data; boundary=' + this.boundary
                        },
                        pipe: sinon.stub()
                    }
                }
            };
            this.schema = {
                type: 'object',
                properties: {
                    photo: {
                        type: 'file',
                        mimeTypes: ['image/jpeg', 'image/png', 'image/gif'], // allowed mime types
                        // TODO: Support minSize somehow
                        // minSize: 5, // minimum size in bytes
                        maxSize: 20 // maximum size in bytes
                    },
                    audio: {
                        type: 'file',
                        mimeTypes: ['audio/*'], // wildcards supported
                        maxSize: 20
                    }
                }
            };
        });

        describe('streaming API', function() {
            it('is available on multipart requests', function() {
                this.request = new Request('/foo', this.router, this.connection);
                var stream = this.request.getStream();
                stream.should.be.instanceOf(Busboy);
            });

            it('pipes request to stream', function() {
                this.request = new Request('/foo', this.router, this.connection);
                var stream = this.request.getStream();
                this.connection.raw.req.pipe.calledWith(stream).should.be.true;
            });

            it('throws error on non-multipart requests', function() {
                this.connection.raw.req.headers['content-type'] = 'application/json';
                this.request = new Request('/foo', this.router, this.connection);
                expect(function() {
                    this.request.getStream();
                }.bind(this)).to.throw();
            });
        });

        describe('validation', function() {
            describe('with valid upload', function() {
                [
                    'image/jpeg',       // jpeg OK
                    'image/png',        // png OK
                    'image/gif',        // gif OK
                ].forEach(function(validMimeType) {
                    it('does not emit error event with valid photo mime type: ' + validMimeType, function() {
                        this.request = new Request('/foo', this.router, this.connection);
                        this.request.setSchema(this.schema);

                        var stream = this.request.getStream();
                        var file = new EventEmitter();

                        var errorSpy = sinon.spy();
                        file.on('invalid', errorSpy);

                        // Simulate sending the file
                        stream.emit('file', 'photo', file, 'me.jpg', '7-bit', validMimeType);
                        file.emit('data', new Buffer('123'));
                        file.emit('data', new Buffer('☃'));
                        file.emit('data', new Buffer('456'));
                        file.emit('end');

                        stream.emit('finish');
                        errorSpy.called.should.be.false;
                    });
                });
            });

            describe('with invalid upload', function() {
                describe.skip('photo too small', function() {
                    it('emits error event', function(done) {
                        this.request = new Request('/foo', this.router, this.connection);
                        this.request.setSchema(this.schema);

                        var stream = this.request.getStream();
                        var file = new EventEmitter();

                        var errorSpy = sinon.spy(function(message, reason) {
                            message.should.equal('Uploaded data for field name photo is smaller than allowed minimum size of 5 bytes.');
                            reason.should.equal(Request.ERROR_UPLOAD_TOO_SMALL);
                            done();
                        });
                        file.on('invalid', errorSpy);

                        // Simulate sending the file
                        stream.emit('file', 'photo', file, 'me.jpg', '7-bit', 'image/jpeg');
                        file.emit('data', new Buffer('1')); // upload is too small; < 5 bytes
                        file.emit('end');

                        stream.emit('finish');
                        errorSpy.called.should.be.true;
                    });
                });

                describe('photo too large', function() {
                    it('emits error event', function(done) {
                        this.request = new Request('/foo', this.router, this.connection);
                        this.request.setSchema(this.schema);

                        var stream = this.request.getStream();
                        var file = new EventEmitter();

                        var errorSpy = sinon.spy(function(error, reason) {
                            error.should.equal('Uploaded data for field name photo is larger than allowed maximum size of 20 bytes.');
                            reason.should.equal(Request.ERROR_UPLOAD_TOO_LARGE);
                            done();
                        });
                        file.on('invalid', errorSpy);

                        // Simulate sending the file
                        stream.emit('file', 'photo', file, 'me.jpg', '7-bit', 'image/jpeg');
                        file.emit('data', new Buffer('☃☃☃☃☃☃☃☃☃☃')); // upload is too large; > 20 bytes
                        file.emit('end');

                        stream.emit('finish');
                        // errorSpy.called.should.be.true;
                    });
                });

                [
                    'audio/midi',   // totally wrong file type
                    'images/png',   // "images" should be "image"
                    'image',        // missing "/*"
                    'png/image',    // backwards
                    '',             // empty
                    null,           // no mime type
                ].forEach(function(invalidMimeType) {
                    it('emits error event with invalid photo mime type: ' + invalidMimeType, function(done) {
                        this.request = new Request('/foo', this.router, this.connection);
                        this.request.setSchema(this.schema);

                        var stream = this.request.getStream();
                        var file = new EventEmitter();

                        var errorSpy = sinon.spy(function(error, reason) {
                            error.should.equal('Uploaded data for field name photo has invalid mime type ' + invalidMimeType + '.');
                            reason.should.equal(Request.ERROR_UPLOAD_MIME_TYPE);
                            done();
                        });
                        file.on('invalid', errorSpy);

                        // Simulate sending the file
                        stream.emit('file', 'photo', file, 'me.jpg', '7-bit', invalidMimeType);
                        file.emit('data', new Buffer('☃☃☃')); // upload size is good
                        file.emit('end');

                        stream.emit('finish');
                        errorSpy.called.should.be.true;
                    });
                });
            });
        });

        describe('getUpload()', function() {
            it('returns a promise', function() {
                this.request = new Request('/foo', this.router, this.connection);
                var promise = this.request.getUpload('foo');
                promise.should.have.property('then');
                promise.then.should.be.a('function');
            });

            it('returns a rejected promise on non-multipart requests', function() {
                this.connection.raw.req.headers['content-type'] = 'application/json';
                this.request = new Request('/foo', this.router, this.connection);

                return this.request.getUpload('foo')
                .then(function(anything) {
                    throw new Error('Did not expect promise to resolve');
                })
                .catch(function(error) {
                    error.message.should.contain('Unsupported content type');
                });
            });

            it('resolves with an object containing a buffer of the upload contents', function() {
                this.request = new Request('/foo', this.router, this.connection);
                var stream = this.request.getStream();
                var promise = this.request.getUpload('foo');
                var file = new EventEmitter();

                // Simulate sending the file
                stream.emit('file', 'foo', file, 'me.jpg', '7-bit', 'image/jpeg');
                file.emit('data', new Buffer('123'));
                file.emit('data', new Buffer('☃'));
                file.emit('data', new Buffer('456'));
                file.emit('end');
                stream.emit('finish');

                return promise.then(function(upload) {
                    upload.should.have.property('buffer');
                    upload.buffer.toString('utf8').should.equal('123☃456');
                });
            });

            it('resolves with an object containing the encoding of the upload', function() {
                this.request = new Request('/foo', this.router, this.connection);
                var stream = this.request.getStream();
                var promise = this.request.getUpload('foo');
                var file = new EventEmitter();

                // Simulate sending the file
                stream.emit('file', 'foo', file, 'me.jpg', '7-bit', 'image/jpeg');
                file.emit('end');
                stream.emit('finish');

                return promise.then(function(upload) {
                    upload.should.have.property('encoding', '7-bit');
                });
            });

            it('resolves with an object containing the mime type of the upload', function() {
                this.request = new Request('/foo', this.router, this.connection);
                var stream = this.request.getStream();
                var promise = this.request.getUpload('foo');
                var file = new EventEmitter();

                // Simulate sending the file
                stream.emit('file', 'foo', file, 'me.jpg', '7-bit', 'image/jpeg');
                file.emit('end');
                stream.emit('finish');

                return promise.then(function(upload) {
                    upload.should.have.property('mimeType', 'image/jpeg');
                });
            });

            it('resolves with an object containing the file name of the upload', function() {
                this.request = new Request('/foo', this.router, this.connection);
                var stream = this.request.getStream();
                var promise = this.request.getUpload('foo');
                var file = new EventEmitter();

                // Simulate sending the file
                stream.emit('file', 'foo', file, 'me.jpg', '7-bit', 'image/jpeg');
                file.emit('end');
                stream.emit('finish');

                return promise.then(function(upload) {
                    upload.should.have.property('fileName', 'me.jpg');
                });
            });

            it('resolves with an object containing the field name of the upload', function() {
                this.request = new Request('/foo', this.router, this.connection);
                var stream = this.request.getStream();
                var promise = this.request.getUpload('foo');
                var file = new EventEmitter();

                // Simulate sending the file
                stream.emit('file', 'foo', file, 'me.jpg', '7-bit', 'image/jpeg');
                file.emit('data', new Buffer('☃')); // 1 character, multiple bytes
                file.emit('end');
                stream.emit('finish');

                return promise.then(function(upload) {
                    upload.should.have.property('size', 3);
                });
            });

            it('resolves with an object containing the size of the upload', function() {
                this.request = new Request('/foo', this.router, this.connection);
                var stream = this.request.getStream();
                var promise = this.request.getUpload('foo');
                var file = new EventEmitter();

                // Simulate sending the file
                stream.emit('file', 'foo', file, 'me.jpg', '7-bit', 'image/jpeg');
                file.emit('end');
                stream.emit('finish');

                return promise.then(function(upload) {
                    upload.should.have.property('fieldName', 'foo');
                });
            });

            it('resolves with upload by specified name if multiple uploads are sent', function() {
                this.request = new Request('/foo', this.router, this.connection);
                var stream = this.request.getStream();
                var promise = this.request.getUpload('foo2');

                var file1 = new EventEmitter();
                var file2 = new EventEmitter();
                var file3 = new EventEmitter();

                // Simulate sending the files
                stream.emit('file', 'foo1', file1, 'me1.jpg', '7-bit', 'image/jpeg');
                file1.emit('data', new Buffer('123'));
                file1.emit('end');

                stream.emit('file', 'foo2', file2, 'me2.jpg', '7-bit', 'image/jpeg');
                file2.emit('data', new Buffer('456'));
                file2.emit('end');

                stream.emit('file', 'foo3', file3, 'me3.jpg', '7-bit', 'image/jpeg');
                file3.emit('data', new Buffer('789'));
                file3.emit('end');

                stream.emit('finish');

                return promise.then(function(upload) {
                    upload.should.have.property('fileName', 'me2.jpg');
                    upload.buffer.toString('utf8').should.equal('456');
                });
            });

            it('resolves with first upload by specified name if multiple uploads are sent with the same name', function() {
                this.request = new Request('/foo', this.router, this.connection);
                var stream = this.request.getStream();
                var promise = this.request.getUpload('foo');

                var file1 = new EventEmitter();
                var file2 = new EventEmitter();
                var file3 = new EventEmitter();

                // Simulate sending the files
                stream.emit('file', 'foo', file1, 'me1.jpg', '7-bit', 'image/jpeg');
                file1.emit('data', new Buffer('123'));
                file1.emit('end');

                stream.emit('file', 'bar', file2, 'me2.jpg', '7-bit', 'image/jpeg');
                file2.emit('data', new Buffer('456'));
                file2.emit('end');

                stream.emit('file', 'foo', file3, 'me3.jpg', '7-bit', 'image/jpeg');
                file3.emit('data', new Buffer('789'));
                file3.emit('end');

                stream.emit('finish');

                return promise.then(function(upload) {
                    upload.should.have.property('fileName', 'me1.jpg');
                    upload.buffer.toString('utf8').should.equal('123');
                });
            });

            it('rejects if no upload by the specified name is found by the time the request ends', function() {
                this.request = new Request('/foo', this.router, this.connection);
                var stream = this.request.getStream();
                var promise = this.request.getUpload('foo');
                var file = new EventEmitter();

                // Simulate sending the file
                stream.emit('file', 'not-foo', file, 'me.jpg', '7-bit', 'image/jpeg');
                file.emit('end');
                stream.emit('finish');

                return promise.then(function() {
                    throw new Error('Did not expect promise to resolve');
                })
                .catch(function(error) {
                    error.message.should.contain('Did not find upload under field name foo');
                });
            });

            describe('validation', function() {
                describe('upload too large', function() {
                    it('rejects promise', function() {
                        this.request = new Request('/foo', this.router, this.connection);
                        this.request.setSchema(this.schema);
                        var stream = this.request.getStream();
                        var promise = this.request.getUpload('photo');
                        var file = new EventEmitter();

                        // Simulate sending the file
                        stream.emit('file', 'photo', file, 'me.jpg', '7-bit', 'image/jpeg');
                        file.emit('data', new Buffer('☃☃☃☃☃☃☃☃☃☃'));
                        file.emit('end');
                        stream.emit('finish');

                        return promise.then(function() {
                            throw new Error('Did not expect promise to resolve');
                        })
                        .catch(function(error) {
                            error.message.should.contain('Uploaded data for field name photo is larger than allowed maximum size of 20 bytes.');
                            error.reason.should.equal(Request.ERROR_UPLOAD_TOO_LARGE);
                        });
                    });
                });

                describe('upload invalid mime type', function() {
                    it('rejects promise', function() {
                        this.request = new Request('/foo', this.router, this.connection);
                        this.request.setSchema(this.schema);
                        var stream = this.request.getStream();
                        var promise = this.request.getUpload('photo');
                        var file = new EventEmitter();

                        // Simulate sending the file
                        stream.emit('file', 'photo', file, 'me.jpg', '7-bit', 'audio/midi');
                        file.emit('data', new Buffer('☃☃☃'));
                        file.emit('end');
                        stream.emit('finish');

                        return promise.then(function() {
                            throw new Error('Did not expect promise to resolve');
                        })
                        .catch(function(error) {
                            error.message.should.contain('Uploaded data for field name photo has invalid mime type audio/midi.');
                            error.reason.should.equal(Request.ERROR_UPLOAD_MIME_TYPE);
                        });
                    });
                });

                describe('mixed valid and invalid', function() {
                    it('resolves and rejects each promise accordingly', function() {
                        this.request = new Request('/foo', this.router, this.connection);
                        this.request.setSchema(this.schema);
                        var stream = this.request.getStream();
                        var promise1 = this.request.getUpload('photo');
                        var promise2 = this.request.getUpload('audio');
                        var file1 = new EventEmitter();
                        var file2 = new EventEmitter();

                        // Simulate sending the files
                        stream.emit('file', 'photo', file1, 'me.midi', '7-bit', 'audio/midi'); // wrong type
                        file1.emit('data', new Buffer('☃☃☃'));
                        file1.emit('end');

                        stream.emit('file', 'audio', file2, 'me.midi', '7-bit', 'audio/midi'); // valid type
                        file2.emit('data', new Buffer('☃☃☃'));
                        file2.emit('end');

                        stream.emit('finish');

                        return Promise.all([promise1, promise2])
                        .then(function(anything) {
                             throw new Error('Did not expect promise to resolve');
                        })
                        .catch(function(anything) {
                            promise1.isRejected().should.be.true;
                            promise2.isFulfilled().should.be.true;
                        });
                    });
                });
            });
        });

        describe('getAllUploads()', function() {
            it('returns a promise', function() {
                this.request = new Request('/foo', this.router, this.connection);
                var promise = this.request.getAllUploads();
                promise.should.have.property('then');
                promise.then.should.be.a('function');
            });

            it('returns a rejected promise on non-multipart requests', function() {
                this.connection.raw.req.headers['content-type'] = 'application/json';
                this.request = new Request('/foo', this.router, this.connection);

                return this.request.getAllUploads()
                .then(function(anything) {
                    throw new Error('Did not expect promise to resolve');
                })
                .catch(function(error) {
                    error.message.should.contain('Unsupported content type');
                });
            });

            describe('without arguments', function() {
                it('resolves with an array of objects containing buffers of the uploaded contents', function() {
                    this.request = new Request('/foo', this.router, this.connection);
                    var stream = this.request.getStream();
                    var promise = this.request.getAllUploads();
                    var file1 = new EventEmitter();
                    var file2 = new EventEmitter();
                    var file3 = new EventEmitter();

                    // Simulate sending the file
                    // Simulate sending the files
                    stream.emit('file', 'foo1', file1, 'me1.jpg', '7-bit', 'image/jpeg');
                    file1.emit('data', new Buffer('123'));
                    file1.emit('end');

                    stream.emit('file', 'foo2', file2, 'me2.png', '7-bit', 'image/png');
                    file2.emit('data', new Buffer('456'));
                    file2.emit('end');

                    stream.emit('file', 'foo3', file3, 'me3.gif', '7-bit', 'image/gif');
                    file3.emit('data', new Buffer('789'));
                    file3.emit('end');

                    stream.emit('finish');

                    return promise.then(function(uploads) {
                        uploads.should.be.an('array');
                        uploads.should.have.lengthOf(3);

                        // Validate zeroth upload
                        uploads[0].should.contain({
                            fieldName: 'foo1',
                            encoding: '7-bit',
                            mimeType: 'image/jpeg',
                            fileName: 'me1.jpg'
                        });
                        uploads[0].should.have.property('buffer');
                        uploads[0].buffer.toString('utf8').should.equal('123');

                        // Validate first upload
                        uploads[1].should.contain({
                            fieldName: 'foo2',
                            encoding: '7-bit',
                            mimeType: 'image/png',
                            fileName: 'me2.png'
                        });
                        uploads[1].should.have.property('buffer');
                        uploads[1].buffer.toString('utf8').should.equal('456');

                        // Validate second upload
                        uploads[2].should.contain({
                            fieldName: 'foo3',
                            encoding: '7-bit',
                            mimeType: 'image/gif',
                            fileName: 'me3.gif'
                        });
                        uploads[2].should.have.property('buffer');
                        uploads[2].buffer.toString('utf8').should.equal('789');
                    });
                });

                it('rejects promise if no uploads were found', function() {
                    this.request = new Request('/foo', this.router, this.connection);

                    var stream = this.request.getStream();
                    var promise = this.request.getAllUploads();

                    // Simulate no uploads, finish stream now
                    stream.emit('finish');

                    return promise
                    .then(function(anything) {
                        throw new Error('Did not expect promise to resolve');
                    })
                    .catch(function(error) {
                        error.message.should.contain('Did not find any uploads');
                    });
                });
            });

            describe('with arguments', function() {
                it('resolves with an array of objects containing buffers of the uploaded contents for each upload that matched the specified field name', function() {
                    this.request = new Request('/foo', this.router, this.connection);
                    var stream = this.request.getStream();
                    var promise = this.request.getAllUploads('foo');
                    var file1 = new EventEmitter();
                    var file2 = new EventEmitter();
                    var file3 = new EventEmitter();

                    // Simulate sending the file

                    // Matches field name
                    stream.emit('file', 'foo', file1, 'me1.jpg', '7-bit', 'image/jpeg');
                    file1.emit('data', new Buffer('123'));
                    file1.emit('end');

                    // Does not match field name
                    stream.emit('file', 'bar', file2, 'me2.png', '7-bit', 'image/png');
                    file2.emit('data', new Buffer('456'));
                    file2.emit('end');

                    // Also matches field name
                    stream.emit('file', 'foo', file3, 'me3.gif', '7-bit', 'image/gif');
                    file3.emit('data', new Buffer('789'));
                    file3.emit('end');

                    stream.emit('finish');

                    return promise.then(function(uploads) {
                        uploads.should.be.an('array');
                        uploads.should.have.lengthOf(2);

                        // Validate zeroth upload
                        uploads[0].should.contain({
                            fieldName: 'foo',
                            encoding: '7-bit',
                            mimeType: 'image/jpeg',
                            fileName: 'me1.jpg'
                        });
                        uploads[0].should.have.property('buffer');
                        uploads[0].buffer.toString('utf8').should.equal('123');

                        // Validate first upload
                        uploads[1].should.contain({
                            fieldName: 'foo',
                            encoding: '7-bit',
                            mimeType: 'image/gif',
                            fileName: 'me3.gif'
                        });
                        uploads[1].should.have.property('buffer');
                        uploads[1].buffer.toString('utf8').should.equal('789');
                    });
                });

                it('rejects promise if no uploads were found for provided field name', function() {
                    this.request = new Request('/foo', this.router, this.connection);
                    var stream = this.request.getStream();
                    var promise = this.request.getAllUploads('unknown');
                    var file1 = new EventEmitter();
                    var file2 = new EventEmitter();
                    var file3 = new EventEmitter();

                    // Simulate sending the file

                    // Matches field name
                    stream.emit('file', 'foo', file1, 'me1.jpg', '7-bit', 'image/jpeg');
                    file1.emit('data', new Buffer('123'));
                    file1.emit('end');

                    // Does not match field name
                    stream.emit('file', 'bar', file2, 'me2.png', '7-bit', 'image/png');
                    file2.emit('data', new Buffer('456'));
                    file2.emit('end');

                    // Also matches field name
                    stream.emit('file', 'baz', file3, 'me3.gif', '7-bit', 'image/gif');
                    file3.emit('data', new Buffer('789'));
                    file3.emit('end');

                    stream.emit('finish');

                    return promise
                    .then(function(anything) {
                        throw new Error('Did not expect promise to resolve');
                    })
                    .catch(function(error) {
                        error.message.should.contain('Did not find any uploads under field name unknown');
                    });
                });
            });
        });
    });
});
