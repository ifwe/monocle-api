var photoSchema = require('./photo');

// Defines the schema for a collection of user photos (i.e. an array of Photo resources).
module.exports = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'Photo Collection',
    description: 'A collection of photos associated with a given user.',
    type: 'array',
    items: photoSchema // Each item in the collection is a photo
};
