var connect = require('connect');
var app = connect();

// Allow parsing of JSON-encoded request body
var bodyParser = require('body-parser');
app.use(bodyParser.json());

// Create an API Router instance
var Monocle = require('../lib');
var api = new Monocle();

// For this simple demo we'll set up a simple in-memory data store for the user resource.
var user = {
    displayName: 'Alice',
    age: 27,
    gender: 'F'
};

var profilePhoto = {
    url: 'http://photo.url',
    caption: 'Awesome photo.'
};

// Configure your first API route
api.route(
    // Define the URL pattern for this resource
    '/user',

    // Define the schema for this resource. The schema will be shared across the supported HTTP methods.
    {
        type: 'object',
        properties: {
            displayName: { type: 'string' },
            age: { type: 'integer' },
            gender: { type: 'string' }
        }
    },

    // Define the HTTP methods that are supported by this url.
    {
        // Handle GET requests for this resource
        get: function(request, connection) {
            return new Promise(function(resolve, reject) {
                if (!user) {
                    return reject("No user found.");
                }
                // Resolve promise with the user object and it will be converted to JSON automatically
                resolve(user);
            });
        },

        // Handle PUT requests for this resource, which will replace the entire resource.
        put: function(request) {
            return new Promise(function(resolve, reject) {
                // Replace entire user object with provided resource, which is automatically JSON-decoded
                user = request.getResource();

                // Resolve promise with the updated user object
                resolve(user);
            });
        }
    }
);

api.route(
    '/user/profile-photo',
    {
        type: 'object',
        properties: {
            url: { type: 'string' },
            caption: { type: 'string' }
        }
    },
    {
        get: function(request, connection) {
            return new Promise(function(resolve, reject) {
                // Demo: Making a call to another endpoint within a handler
                connection.get('/user').then(function(user) {
                    if (!user) {
                        return reject("No user found.");
                    }

                    if (!profilePhoto) {
                        return reject("No profile photo found.");
                    }

                    resolve(profilePhoto);
                });
            });
        }
    }
);

// Add the API middleware to your connect app
app.use(api.middleware());

// Create web server and listen on port 5150
var http = require('http');
http.createServer(app).listen(5150, function() {
    console.log("Monocle API is now listening on port 5150");
});
