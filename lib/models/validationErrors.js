module.exports = {
    default: {
        code: 100,
        error: 'INVALID',
        message: 'Provided resource did not validate with schema'
    },

    type: {
        code: 105,
        error: 'INVALID',
        message: 'Property is of incorrect type'
    },

    enum: {
        code: 110,
        error: 'INVALID',
        message: 'Property contains invalid enum value'
    },

    minimum: {
        code: 120,
        error: 'INVALID',
        message: 'Property is below minimum allowed value'
    },

    maximum: {
        code: 125,
        error: 'INVALID',
        message: 'Property is above maximum allowed value'
    },

    multipleOf: {
        code: 130,
        error: 'INVALID',
        message: 'Property is not a multiple of the specified value'
    },

    minLength: {
        code: 140,
        error: 'INVALID',
        message: 'Property is below the minimum allowed string length'
    },

    maxLength: {
        code: 145,
        error: 'INVALID',
        message: 'Property is above the maximum allowed string length'
    },

    pattern: {
        code: 150,
        error: 'INVALID',
        message: 'Property does not match the specified regular expression\'s pattern'
    },

    format: {
        code: 155,
        error: 'INVALID',
        message: 'Property does not match form that the value must conform to'
    },

    minItems: {
        code: 160,
        error: 'INVALID',
        message: 'Property does not contain the minimum number of items required in the array'
    },

    maxItems: {
        code: 165,
        error: 'INVALID',
        message: 'Property does not contain the maximum number of items required in the array'
    },

    additionalItems: {
        code: 170,
        error: 'INVALID',
        message: 'Resource contains additional properties that are not defined in the schema'
    },

    uniqueItems: {
        code: 175,
        error: 'INVALID',
        message: 'Property contains duplicate items in the array'
    },

    required: {
        code: 180,
        error: 'INVALID',
        message: 'Does not contain a required property'
    }
};
