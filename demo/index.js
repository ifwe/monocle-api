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
var bodyParser = require('body-parser');
app.use(bodyParser.json());

/*** Mock data ***/

var mockUserBasicInfo = require('./data/user-basic-info');
var mockUserEmails = require('./data/user-emails');

/*** Define the schemas ***/

// Defines the schema for the `user` resource.
// This schema will be shared across all HTTP methods (GET, POST, etc.)
// and across multiple routes (e.g. /users/123, /users/123/friends/456, etc.)
var userSchema = require('./schemas/user');

// Defines the schema for a collection of users (i.e. an array of User resources).
var userCollectionSchema = require('./schemas/user-collection');

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
            props: ['displayName', 'age', 'gender'],
            callback: getUserBasicInfo
        },
        {
            props: ['email'],
            callback: getUserEmailInfo
        }
    ],
    put: [
        {
            props: ['displayName', 'age', 'gender'],
            callback: putUserBasicInfo
        },
        {
            props: ['email'],
            callback: putUserEmailInfo
        }
    ]
});

// Defines the route that manages a collection of users
api.route('/users', userCollectionSchema, {
    get: [
        {
            props: ['displayName', 'age', 'gender'],
            callback: getUsersBasicInfo
        },
        {
            props: ['email'],
            callback: getUsersEmailInfo
        }
    ],
    post: createUser
});

/*** Define the callback functions ***/

// Returns basic user info for a given user id
function getUserBasicInfo(request) {
    // Get the user ID from the URL params
    var userId = request.getParam('userId'); // ex: 123

    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            for (var i = 0, len = mockUserBasicInfo.length; i < len; i++) {
                if (mockUserBasicInfo[i].userId === userId) {
                    return resolve(new Resource('/users/' + userId, mockUserBasicInfo[i], 3600));
                }
            }
            reject('Unable to find basic info for user id ' + userId);
        }, 100);
    });
}

// Returns email info for a given user id
function getUserEmailInfo(request) {
    // Get the user ID from the URL params
    var userId = request.getParam('userId'); // ex: 123

    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var index = userId - 1;
            var userEmail = mockUserEmails[index];
            if (userEmail) {
                resolve(new Resource('/users/' + userId, userEmail, 3600));
            } else {
                reject('Unable to find email for user id ' + userId);
            }
        });
    });
}

// Returns basic info for a collection of users
function getUsersBasicInfo(request) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            resolve(mockUserBasicInfo.map(function(info, i) {
                return new Resource('/users/' + info.userId, info);
            }));
        }, 100);
    });
}

// Returns email info for a collection of users
function getUsersEmailInfo(request) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            resolve(mockUserEmails.map(function(info, i) {
                return new Resource('/users/' + info.userId, info);
            }));
        }, 100);
    });
}

// Updates a user
function putUserBasicInfo(request) {
    var userId = request.getParam('userId');
    var resource = request.getResource();

    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            for (var i = 0, len = mockUserBasicInfo.length; i < len; i++) {
                if (mockUserBasicInfo[i].userId === userId) {
                    for (var k in resource) {
                        mockUserBasicInfo[i][k] = resource[k];
                    }
                    return resolve(new Resource('/users/' + userId, mockUserBasicInfo[i], 3600));
                }
            }
            reject('Unable to find basic info for user id ' + userId);
        }, 100);
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
    console.log('Success!!', data.resource, data.duration);
});

api.on('api:error', function(data) {
    console.log('Error :(', data.resource, data.duration);
});

// Create web server and listen on port 5150
var http = require('http');
http.createServer(app).listen(5150, function() {
    console.log("API Router Demo listening on port 5150");
});
