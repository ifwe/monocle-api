module.exports = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'User',
    description: 'An end user of our product.',
    type: 'object',
    properties: {
        userId: {
            description: 'A unique identifier for this user.',
            type: 'integer',
            minimum: 1,
            readOnly: true,
            sample: 12345
        },
        displayName: {
            description: 'The user\'s preferred display name, which may be changed at any time by the user.',
            type: 'string',
            maxLength: 255,
            sample: 'Joe User'
        },
        age: {
            description: 'Age in years.',
            type: 'integer',
            minimum: 18,
            maximum: 99,
            readOnly: true,
            sample: 25
        },
        birthDate: {
            description: 'JSON representation of date of birth',
            type: 'string',
            sample: '1982-04-27T07:00:00.000Z'
        },
        gender: {
            description: '"M" for male, "F" for female.',
            type: 'string',
            sample: 'F'
        },
        email: {
            description: 'Primary email address.',
            type: 'string',
            sample: 'username@example.com'
        },
        city: {
            description: 'City that user lives in.',
            type: 'string',
            sample: 'San Francisco'
        },
        location: {
            type: 'string',
            description: 'A human-readable location, ready for presentation.',
            readOnly: true,
            sample: 'San Francisco, CA'
        },
        country: {
            description: '2-character country code that user lives in.',
            type: 'string',
            sample: 'US'
        }
    }
};
