module.exports = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'User',
    description: 'An end user of our product.',
    type: 'object',
    properties: {
        userId: {
            description: 'A unique identifier for this user.',
            type: 'integer',
        },
        displayName: {
            description: 'The user\'s preferred display name, which may be changed at any time by the user.',
            type: 'string'
        },
        age: {
            description: 'Age in years',
            type: 'integer'
        },
        gender: {
            description: 'M: Male, F: Female',
            type: 'string'
        },
        email: {
            description: 'Primary email address',
            type: 'string'
        }
    }
};
