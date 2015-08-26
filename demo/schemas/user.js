module.exports = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    type: 'object',
    properties: {
        userId: { type: 'integer' },
        displayName: { type: 'string' },
        age: { type: 'integer' },
        gender: { type: 'string' },
        email: { type: 'string' }
    }
};
