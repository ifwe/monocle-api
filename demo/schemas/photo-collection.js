var photoSchema = require('./photo');

// Defines the schema for a collection of user photos (i.e. an array of Photo resources).
module.exports = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'Photo Collection',
    description: 'A collection of photos associated with a given user.',
    type: 'object',
    properties: {
        userId: {
            type: 'integer',
            minimum: 1,
            sample: 123
        },
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
        total: {
            type: 'integer',
            minimum: 0,
            sample: 100
        },
        items: {
            type: 'array',
            items: photoSchema // Each item in the collection is a photo
        }
    }
};
