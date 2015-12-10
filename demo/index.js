// This is an example route configuration file.
// This file manages two related resources:
// - /users/123     - Single user
// - /users         - Collection of users

/*** Initial dependencies **/

var _ = require('lodash');
var Promise = require('bluebird');
var Router = require('../lib');
var Resource = require('../lib').Resource;

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
    delete: function() {}
});

// Defines the route that manages a collection of users
api.route('/users', userCollectionSchema, {
    get: [
        {
            props: ['displayName', 'age', 'gender', 'city', 'country'],
            callback: getUsersBasicInfo
        },
        {
            props: ['email'],
            callback: getUsersEmailInfo
        }
    ],
    post: createUser
});

api.route('/users/:userId/photos', photoCollectionSchema, {
    // Complex resources may need multiple callback handlers to support different properties.
    // The API router will figure out which callbacks are necessary to satisfy the incoming request.
    get: function(request) {
        var userId = request.getParam('userId');

        //Get Parametersplice(0, limit).
        var limit = request.getQuery('limit') || mockPhotos.length;

        var photos = mockPhotos.filter(function(photo) {
            return photo.userId === userId;
        }).splice(0, limit).map(function(photo) {
            return new Resource('/users/' + userId + '/photos/' + photo.photoId, photo, 86400);
        });
        if (!photos.length) {
            return Promise.reject("Unable to find photos for user " + userId);
        };
        return photos;
    },
    post: function(request) {
        var userId = request.getParam('userId');
        var photoId = mockPhotos.length;
        var photo = request.getResource();
        photo.userId = userId;
        photo.photoId = photoId;
        photo.url = 'http://mysite.com/photos/photo-' + userId + '-' + photoId + '.png';
        mockPhotos.push(photo);
        return [new Resource('/users/' + userId + '/photos/' + photo.photoId, photo, 86400)];
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

// Create a user
function createUser(request) {

}

// Mounth the API as middleware

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
