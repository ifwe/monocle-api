[![Build Status](https://travis-ci.org/ifwe/monocle-api.png)](https://travis-ci.org/ifwe/monocle-api)

Monocle API Router for Connect
==============================

Monocle is a an API router that focuses on *consistency*, *flexibility* and *performance*.

## Consistency

Monocle implements various features to encourage consistency across all endpoints.

### Schemas

Monocle requires that each resource path includes a schema defined in [JSON Schema](http://json-schema.org/) format. The schema is shared among all HTTP verbs for the resource, e.g. `GET`, `POST`, `PUT`, etc. Monocle also validates all input and output with the schema, ensuring that the schema remains the source of truth for how data is structured.

### Server-Side Symlinks

Monocle supports "Server-Side Symlinks" to easily embed a resource in another resource. The Monocle Framework will automatically resolve these symlinks on the server, resulting in a complete response for clients. By utilizing Server-Side Symlinks, consistency comes for free when the Symlinked resources are updated.

## Flexibility

Monocle makes no assumptions about how clients consume the data -- the only assumption it makes is that client needs will change regularly.

### Property Filtering

Monocle allows clients to specify how much data to return for any given resource. Property filtering supports top-level properties, nested properties, and plucking properties from arrays. See [Monocle API Props](https://github.com/ifwe/monocle-api-props) for details on how property filtering works.

## Performance

Monocle allows for performance optimization via caching and property routing.

### Caching

Monocle provides cache-control headers for basic REST, but also supports nested resource caching when using the [Monocle Client](https://github.com/ifwe/monocle-client-js). Collection caching is also supported via the use of weak e-tags.

### Property Routing

For large resources, Monocle allows you to provide it with various callbacks that map to each of the properties in the resource. When used with *Property Filtering*, Monocle will automatically call only the required callbacks to fulfill the request.

--

## Quick Start

To get started, make sure you're using *Node 8.8.1* or greater, and create a new node project in an empty directory:

```
$ mkdir my-monocle-server
$ cd my-monocle-server
$ npm init
```

After filling in the details, install the required dependencies:

```
$ npm install monocle-api connect body-parser

```

Create a file named `server.js` and add the following code:


```js
const connect = require('connect');
const app = connect();

// Allow parsing of JSON-encoded request body
const bodyParser = require('body-parser');
app.use(bodyParser.json());

// Create an API Router instance
const MonocleApi = require('monocle-api');
const api = new MonocleApi();
const Resource = MonocleApi.Resource;

// For this simple demo we'll set up a simple in-memory data store for the user resources.
const users = {
  1: {
    userId: 1,
    displayName: 'Alice',
    age: 27,
    gender: 'female',
  },
  2: {
    userId: 2,
    displayName: 'Fred',
    age: 22,
    gender: 'male',
  },
};

// Configure your first API route
api.route(
  // Define the URL pattern for this resource
  '/users/:userId',

  // Define the schema for this resource. The schema will be shared across the supported HTTP methods for this resource.
  {
    name: 'User',
    description: 'A user resource',
    type: 'object',
    properties: {
      userId: { type: 'integer', minimum: 1, readOnly: true, sample: 123 },
      displayName: { type: 'string', minLength: 1, maxLength: 255 },
      age: { type: 'integer', minimum: 18, maximum: 99 },
      gender: { type: 'string', enum: ['male', 'female'] },
    },
  },

  // Define the HTTP methods that are supported by this url.
  {
    // Handle GET requests for this resource
    get: (request) => {
      let userId = request.getParam('userId'); // extracts userId param from url, automatically casts it to int due to schema definition

      let user = users[userId];
      if (!user) {
        return request.error(404, { message: 'User not found' });
      }

      // Resolve promise with the user object and it will be converted to JSON automatically
      // Monocle will also validate the return value and return a 500-level error code if the value does not validate.
      return new Resource(`/users/${userId}`, user, 60000);
    },

    // Handle PUT requests for this resource
    put: (request) => {
      let userId = request.getParam('userId'); // extracts userId param from url, automatically casts it to int due to schema definition

      // Replace entire user object with provided resource, which is automatically JSON-decoded
      // Monocle will have rejected this request if the provided resource did not validate with the schema.
      user = request.getResource();

      // Resolve promise with the updated user object
      return new Resource(`/users/${userId}`, user, 60000);
    },
  }
);

// Add the API middleware to your connect app
app.use(api.middleware());

// Create web server and listen on port 5150
const http = require('http');
http.createServer(app).listen(5150, function() {
  console.log("Monocle API is now listening on port 5150");
});
```

You can now start your monocle server by running `node server.js`.

## REST

Monocle API supports RESTful API calls:

```bash
$ curl -i http://127.0.0.1:5150/users/1
HTTP/1.1 200 OK
Content-Type: application/json
cache-control: private, max-age=60000
Date: Thu, 08 Feb 2018 23:27:30 GMT
Connection: keep-alive
Content-Length: 144

{
  "$type": "resource",
  "$id": "/users/1",
  "$expires": 60000,
  "userId": 1,
  "displayName": "Alice",
  "age": 27,
  "gender": "female"
}


$ curl -X PUT -H 'Content-Type: application/json' -d '{"displayName": "Joe", "age": 42, "gender": "male"}' -i http://127.0.0.1:5150/users/1
HTTP/1.1 200 OK
Content-Type: application/json
cache-control: private, max-age=60000
Date: Thu, 08 Feb 2018 23:29:48 GMT
Connection: keep-alive
Content-Length: 125

{
  "$type": "resource",
  "$id": "/users/1",
  "$expires": 60000,
  "displayName": "Joe",
  "age": 42,
  "gender": "male"
}


$ curl -i http://127.0.0.1:5150/users/3
HTTP/1.1 404 Not Found
Content-Type: application/json
Date: Thu, 08 Feb 2018 23:37:36 GMT
Connection: keep-alive
Content-Length: 145

{
  "code": 2000,
  "error": "UNKNOWN",
  "message": "User not found",
  "properties": [],
  "$httpStatus": 404,
  "$httpMessage": "NOT FOUND"
}

```

Property filtering can be used to restrict how much data is returned.

```bash
$ curl -i http://127.0.0.1:5150/users/1?props=displayName,age
HTTP/1.1 200 OK
Content-Type: application/json
cache-control: private, max-age=60000
Date: Thu, 08 Feb 2018 23:39:04 GMT
Connection: keep-alive
Content-Length: 107

{
  "$type": "resource",
  "$id": "/users/1",
  "$expires": 60000,
  "displayName": "Alice",
  "age": 27
}

```

See `demo/index.js` for advanced usage.

## Files and Directory Structure

The following describes the various files in this repo and the directory structure.

**Note:** Files and directories prefixed by `*` are auto-generated and excluded from the
repository via `.gitignore`.

    .
    ├── Gruntfile.js            # grunt task configuration
    ├── README.md               # this file
    ├── *docs                   # autogenerated documentation
    │   └── *index.html         # each JS file in `./lib` has a corresponding HTML file for documentation
    ├── lib                     # all code for this library will be placed here
    │   └── index.js            # main entry point for the API router
    ├── *node_modules           # all dependencies will be installed here by npm
    ├── package.json            # description of this package for npm, including dependency lists
    └── test                    # unit test configuration, reports, and specs
        ├── *coverage.html      # code coverage report
        ├── lib                 # specs go here with a 1:1 mapping to code in `./lib`
        │   └── index_test.js   # spec for `./lib/index.js`
        ├── mocha.opts          # runtime options for mocha
        └── test_runner.js      # configures mocha environment (e.g. chai, sinon, etc.)

## Development

### Grunt

Grunt is a JavaScript task runner to automate common actions. The API Router project
supports the following grunt tasks:

**test**

Runs all unit tests through mocha.

    $ grunt test

**coverage**

Runs all unit tests and generates a code coverage report in `./test/coverage.html`

    $ grunt coverage

**watch**

Automatically runs mocha tests each time a file changes in `./lib` or `./test`.

    $ grunt watch

**docs**

Generates documentation for all JS files within `./lib` using docco. Documentation is
written to `./docs`.

    $ grunt docs

**clean**

Deletes all auto-generated files, including `./docs` and `./test/coverage.html`

### Mocha, Sinon, Chai, Blanket

The ultimate TDD environment for node. Place your specs in `./test/lib`, and run `grunt test`.

See `./test/lib/index_test.js` for examples.
