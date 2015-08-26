var connect = require('connect');
var app = connect();
var _ = require('lodash');
var Promise = require('bluebird');

var bodyParser = require('body-parser');
app.use(bodyParser.json());

var ApiRouter = require('../lib');
var api = new ApiRouter();

var Resource = require('../lib/Resource');

var mockUserBasicInfo = require('./data/user-basic-info');
var mockUserEmails = require('./data/user-emails');

var userInfoSchema = {
    type: 'object',
    properties: {
        userId: { type: 'integer' },
        displayName: { type: 'string' },
        age: { type: 'integer' },
        gender: { type: 'string' }
    }
};

var userEmailSchema = {
    type: 'object',
    properties: {
        userId: { type: 'integer' },
        email: { type: 'string' }
    }
};

var userSchema = _.merge({}, userInfoSchema, userEmailSchema);

var usersSchema = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    type: 'array',
    items: userSchema
};

// All users
api.get('/users', usersSchema, function() {
    return new Promise(function(resolve, reject) {
        var users = _.merge([], mockUserBasicInfo, mockUserEmails);
        resolve(users.map(function(user, index) {
            return new Resource('/users/' + index + 1, user);
        }));
    });
});


// Basic user info
api.get('/users/:userId', userInfoSchema, function(params) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var index = parseInt(params.userId, 10) - 1;
            var userBasicInfo = mockUserBasicInfo[index];
            if (userBasicInfo) {
                resolve(new Resource('/users/' + params.userId, userBasicInfo));
            } else {
                reject('Unable to find basic info for user id ' + params.userId);
            }
        });
    });
});

// User email
api.get('/users/:userId', userEmailSchema, function(params) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var index = parseInt(params.userId, 10) - 1;
            var userEmail = mockUserEmails[index];
            if (userEmail) {
                resolve(userEmail);
            } else {
                reject('Unable to find email for user id ' + params.userId);
            }
        });
    });
});

// Update user info
api.post('/users/:userId', userInfoSchema, function(params, req) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var index = parseInt(params.userId, 10) - 1;
            var userBasicInfo = mockUserBasicInfo[index];
            if (userBasicInfo) {
                if (req.body.hasOwnProperty('displayName')) userBasicInfo.displayName = req.body.displayName;
                resolve(userBasicInfo);
            } else {
                reject('Unable to find basic info for user id ' + params.userId);
            }
        });
    });
});

// Reflection
api.get('/reflect/:myParam', {
    type: 'object',
    properties: {
        myParam: { type: 'string' },
        url: { type: 'string' }
    }
}, function(params, req) {
    return {
        myParam: params.myParam,
        url: req.url
    };
});

app.use(api.middleware({
    basePath: '/my-api'
}));

api.on('api:success', function(data) {
    console.log(['Success', data.resource, data.duration].join(' '));
});

api.on('api:error', function(data) {
    console.log(['Error :(', data.resource, data.duration].join(' '));
});

// Create web server and listen on port 5150
var http = require('http');
http.createServer(app).listen(5150, function() {
    console.log("API Router Demo listening on port 5150");
});
