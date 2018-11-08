module.exports = {
    type: 'object',
    properties: {
        code: {
            type: 'integer',
            description: 'HTTP status code.',
            sample: 403,
            required: true
        },
        error: {
            type: 'string',
            description: 'String representation of HTTP status code.',
            sample: 'FORBIDDEN',
            required: true
        },
        message: {
            type: 'string',
            description: 'General description of the error.',
            sample: 'Unable to update user id 123',
            required: true
        },
        properties: {
            type: 'array',
            description: 'Array of properties in error. If no individual properties are in error, this will be an empty array.',
            require: true,
            items: {
                type: 'object',
                properties: {
                    property: {
                        type: 'string',
                        description: 'Property name relative to document root. Nested properties will be dot-separated.',
                        sample: 'primaryPhoto.caption',
                        required: true
                    },
                    code: {
                        type: 'integer',
                        description: 'Error code.',
                        sample: 1029,
                        required: true
                    },
                    error: {
                        type: 'string',
                        description: 'Error in string format.',
                        sample: 'TOO_SHORT',
                        required: true
                    },
                    message: {
                        type: 'string',
                        description: 'Description of the error message for this field.',
                        sample: 'Photo caption contains banned content.',
                        required: true
                    }
                }
            }
        }
    }
};
