var userSchema = require('./user');

// Defines the schema for a collection of users (i.e. an array of User resources).
module.exports = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'User Collection',
    description: 'A collection of users.',
    type: 'object',
    properties: {
        items: {
            type: 'array',
            items: userSchema // Each item in the collection is a user, so reuse the userSchema here
        }
    }
};
