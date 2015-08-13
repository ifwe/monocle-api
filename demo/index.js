var connect = require('connect');
var app = connect();

var Promise = require('bluebird');

var responseTime = require('response-time');
app.use(responseTime());

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
    extended: false
}));

var ApiRouter = require('../lib');
var api = new ApiRouter();

var mockUserBasicInfo = require('./data/user-basic-info');
var mockUserEmails = require('./data/user-emails');

api.get('/users/:userId', {
    props: {
        userId: 'number',
        displayName: 'string',
        age: 'number',
        gender: 'string'
    }
}, function(params) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var userBasicInfo = mockUserBasicInfo[params.userId];
            if (userBasicInfo) {
                resolve(userBasicInfo);
            } else {
                reject('Unable to find basic info for user id ' + params.userId);
            }
        }, 100);
    });
});

api.get('/users/:userId', {
    props: {
        userId: 'number',
        email: 'string'
    }
}, function(params) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var userEmail = mockUserEmails[params.userId];
            if (userEmail) {
                resolve(userEmail);
            } else {
                reject('Unable to find email for user id ' + params.userId);
            }
        }, 100);
    });
});

api.get('/reflect/:myParam', {
    props: {
        myParam: 'string',
        url: 'string'
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