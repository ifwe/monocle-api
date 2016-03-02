// This is an example route configuration file.
// This file manages two related resources:
// - /users/123     - Single user
// - /users         - Collection of users

/*** Initial dependencies **/

var _ = require('lodash');
var Promise = require('bluebird');
var Router = require('../lib');
var Resource = require('../lib').Resource;
var OffsetPaginator = require('../lib').OffsetPaginator;
var Symlink = require('../lib').Symlink;
var fs = require('fs');
var path = require('path');

/*** Set up simple HTTP server ***/

var connect = require('connect');
var app = connect();

// Allow method override via ?_method=METHOD query string parameter
var methodOverride = require('method-override');
app.use(methodOverride('_method', {
    methods: [ 'GET', 'POST' ] // Specifies which methods can support overrides
}));
var bodyParser = require('body-parser');
app.use(bodyParser.json());

/*** Mock data ***/

var mockUserBasicInfo = require('./data/user-basic-info');
var mockUserEmails = require('./data/user-emails');
var mockPhotos = require('./data/photos');

/*** Define the schemas ***/

var userSchema = require('./schemas/user');
var userCollectionSchema = require('./schemas/user-collection');
var photoSchema = require('./schemas/photo');
var photoCollectionSchema = require('./schemas/photo-collection');

/*** Set up a new router ***/

var api = new Router();

/*** Define the routes ***/

// Define the route that points to a specific user.
// The URL may contain named parameters, which will be parsed and handed to the callback.
api.route('/users/:userId', userSchema, {
    // Complex resources may need multiple callback handlers to support different properties.
    // The API router will figure out which callbacks are necessary to satisfy the incoming request.
    get: [
        {
            props: ['displayName', 'age', 'gender', 'birthDate', 'city', 'country'],
            callback: getUserBasicInfo
        },
        {
            props: ['email'],
            callback: getUserEmailInfo
        }
    ],
    put: [
        {
            props: ['displayName', 'age', 'gender', 'birthDate', 'city', 'country'],
            callback: putUserBasicInfo
        },
        {
            props: ['email'],
            callback: putUserEmailInfo
        }
    ],
    patch: function() {},
    delete: function(request) {
        var userId = request.getParam('userId');
        return request.error(403, 'You are not allowed to delete this user.');
    }
});

// Defines the route that manages a collection of users
api.route(['/users', 'limit=10&offset=0&search'], userCollectionSchema, {
    get: getUsers,
    post: createUser
});

api.route(['/users/:userId/photos', 'limit=10&offset=0'], photoCollectionSchema, {
    // Complex resources may need multiple callback handlers to support different properties.
    // The API router will figure out which callbacks are necessary to satisfy the incoming request.
    get: function(request) {
        var userId = request.getParam('userId');

        //Get Parametersplice(0, limit).
        var limit = request.getQuery('limit');
        var offset = request.getQuery('offset');

        var photos = mockPhotos.filter(function(photo) {
            return photo.userId === userId;
        })
        .slice(offset, limit)
        .map(function(photo) {
            return new Resource('/users/' + userId + '/photos/' + photo.photoId, photo, 86400);
        });

        return new OffsetPaginator('/users/' + userId + '/photos')
        .setItems(photos)
        .setLimit(limit)
        .setOffset(offset)
        .setTotal(mockPhotos.length);
    },
    post: function(request) {
        return request.getUpload('photo')
        .then(function(upload) {
            var photoFileName = Math.round(Math.random() * 1e16).toString(36);

            switch (upload.mimeType) {
                case 'image/png':
                    photoFileName += '.png';
                    break;

                case 'image/jpeg':
                    photoFileName += '.jpg';
                    break;

                case 'image/gif':
                    photoFileName += '.gif';
                    break;

                default:
                    return request.error(442, 'Invalid upload type: ' + upload.mimeType);
            }

            var saveFilePath = path.join(__dirname, 'files', 'photos', photoFileName);

            var wstream = fs.createWriteStream(saveFilePath, {
                encoding: upload.encoding
            });

            wstream.write(upload.buffer);
            wstream.end();

            var userId = request.getParam('userId');
            var photoId = mockPhotos.length;
            var photo = request.getResource();
            photo.userId = userId;
            photo.photoId = photoId;
            photo.url = 'http://localhost:5150/photos/' + photoFileName;
            mockPhotos.push(photo);

            return new Resource('/users/' + userId + '/photos/' + photo.photoId, photo, 86400);
        });
    }
});

api.route('/users/:userId/photos/:photoId', photoSchema, {
    // Complex resources may need multiple callback handlers to support different properties.
    // The API router will figure out which callbacks are necessary to satisfy the incoming request.
    get: function(request) {
        var userId = request.getParam('userId');
        var photoId = request.getParam('photoId');
        for (var i = 0, len = mockPhotos.length; i < len; i++) {
            var photo = mockPhotos[i];
            if (photo.photoId === photoId && photo.userId === userId) {
                return new Resource('/users/' + userId + '/photos/' + photoId, photo, 86400);
            }
        }
        return Promise.reject("Unable to find photo for user " + userId + " and photo id " + photoId);
    },
    put: function(request) {
        var userId = request.getParam('userId');
        var photoId = request.getParam('photoId');
        var submittedPhoto = request.getResource();
        var photo;
        for (var i = 0, len = mockPhotos.length; i < len; i++) {
            if (mockPhotos[i].photoId === photoId && mockPhotos[i].userId === userId) {
                photo = mockPhotos[i];
                break;
            }
        }
        if (!photo) {
            return Promise.reject("Unable to find photo for user " + userId + " and photo id " + photoId);
        }
        photo.caption = submittedPhoto.caption;
        // mockPhotos[i] = photo;
        return new Resource('/users/' + userId + '/photos/' + photo.photoId, photo, 86400);
    },
    delete: function() {},
});

/*** Define the callback functions ***/

// Returns basic user info for a given user id
function getUserBasicInfo(request) {
    // Get the user ID from the URL params
    var userId = request.getParam('userId'); // ex: 123

    return new Promise(function(resolve, reject) {
        for (var i = 0, len = mockUserBasicInfo.length; i < len; i++) {
            if (mockUserBasicInfo[i].userId === userId) {
                return resolve(new Resource('/users/' + userId, mockUserBasicInfo[i], 3600));
            }
        }
        reject('Unable to find basic info for user id ' + userId);
    });
}

// Returns email info for a given user id
function getUserEmailInfo(request) {
    // Get the user ID from the URL params
    var userId = request.getParam('userId'); // ex: 123

    return new Promise(function(resolve, reject) {
        var index = userId - 1;
        var userEmail = mockUserEmails[index];
        if (userEmail) {
            resolve(new Resource('/users/' + userId, userEmail, 3600));
        } else {
            reject('Unable to find email for user id ' + userId);
        }
    });
}

// Returns basic info for a collection of users
function getUsersBasicInfo(request) {
    return new Promise(function(resolve, reject) {
        resolve(mockUserBasicInfo.map(function(info, i) {
            return new Resource('/users/' + info.userId, info);
        }));
    });
}

// Returns email info for a collection of users
function getUsersEmailInfo(request) {
    return new Promise(function(resolve, reject) {
        resolve(mockUserEmails.map(function(info, i) {
            return new Resource('/users/' + info.userId, info);
        }));
    });
}

// Updates a user
function putUserBasicInfo(request) {
    var userId = request.getParam('userId');
    var resource = request.getResource();

    return new Promise(function(resolve, reject) {
        for (var i = 0, len = mockUserBasicInfo.length; i < len; i++) {
            if (mockUserBasicInfo[i].userId === userId) {
                for (var k in resource) {
                    mockUserBasicInfo[i][k] = resource[k];
                }
                return resolve(new Resource('/users/' + userId, mockUserBasicInfo[i], 3600));
            }
        }
        reject('Unable to find basic info for user id ' + userId);
    });
}

function putUserEmailInfo(request) {
    var userId = request.getParam('userId');
    var resource = request.getResource();
    return new Resource('/users/' + userId, resource, 3600);
}

// Gets all users
function getUsers(request, connection) {
    // The limit is guaranteed to be an integer and within range, or default value
    var limit = request.getQuery('limit');

    // The offset is guaranteed to be an integer and within range, or default value
    var offset = request.getQuery('offset');

    var search = request.getQuery('search');

    var users = mockUserBasicInfo.slice(0); // Make a copy of users
    if (search) {
        search = search.toLowerCase();
        users = users.filter(function(user) {
            return (-1 !== user.displayName.toLowerCase().indexOf(search));
        });
    }

    var users = users.slice(offset, offset + limit).map(function(user) {
        return new Symlink('/users/' + user.userId);
    });

    return new OffsetPaginator('/users')
    .setItems(users)
    .setExpires(1000)
    .setLimit(limit)
    .setOffset(offset);
}

// Create a user
function createUser(request) {

}

// A very simple photo upload page
app.use(function(req, res, next) {
    if (req.url !== '/upload-photo' || req.method !== 'GET') {
        return next();
    }
    res.setHeader('Content-Type', 'text/html');
    res.write('\
        <form method="POST" enctype="multipart/form-data" action="/my-api/users/1/photos">\
            <input type="file" name="photo" />\
            <textarea name="caption" placeholder="caption"></textarea>\
            <button>Upload</button>\
        </form>\
    ');
    res.end();
});

// Allow uploaded files to be served
var serveStatic = require('serve-static');
app.use(serveStatic(path.join(__dirname, 'files')));

// Mount the API as middleware
app.use(api.middleware({
    basePath: '/my-api'
}));

api.on('api:success', function(data) {
    console.log('Success!!', data.resourceId);
});

api.on('api:error', function(data) {
    console.log('Error :(', data.resourceId);
});

// Create web server and listen on port 5150
var http = require('http');
http.createServer(app).listen(5150, function() {
    console.log("API Router Demo listening on port 5150");
    console.log("View documentation: http://localhost:5150/my-api");
});
