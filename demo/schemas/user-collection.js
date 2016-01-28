var userSchema = require('./user');

// Defines the schema for a collection of users (i.e. an array of User resources).
module.exports = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'User Collection',
    description: 'A collection of users.',
    type: 'object',
    properties: {
        limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            sample: 10
        },
        offset: {
            type: 'integer',
            minimum: 0,
            sample: 0
        },
        search: {
            type: 'string'
        },
        items: {
            type: 'array',
            items: userSchema // Each item in the collection is a user, so reuse the userSchema here
        }
    }
};
