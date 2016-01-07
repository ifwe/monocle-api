module.exports = {
    default: {
        code: 100,
        error: 'MONOCLE_INVALID_SCHEMA',
        message: 'Provided resource did not validate with schema'
    },

    type: {
        code: 105,
        error: 'MONOCLE_INCORRECT_TYPE',
        message: 'Property is of incorrect type'
    },

    enum: {
        code: 110,
        error: 'MONOCLE_INCORRECT_ENUM',
        message: 'Property contains invalid enum value'
    },

    minimum: {
        code: 120,
        error: 'MONOCLE_BELOW_MINIMUM',
        message: 'Property is below minimum allowed value'
    },

    maximum: {
        code: 125,
        error: 'MONOCLE_ABOVE_MAXIMUM',
        message: 'Property is above maximum allowed value'
    },

    multipleOf: {
        code: 130,
        error: 'MONOCLE_NOT_MULTIPLE_OF',
        message: 'Property is not a multiple of the specified value'
    },

    minLength: {
        code: 140,
        error: 'MONOCLE_BELOW_MINIMUM_LENGTH',
        message: 'Property is below the minimum allowed string length'
    },

    maxLength: {
        code: 145,
        error: 'MONOCLE_ABOVE_MAXIMUM_LENGTH',
        message: 'Property is above the maximum allowed string length'
    },

    pattern: {
        code: 150,
        error: 'MONOCLE_NOT_MATCHING_PATTERN',
        message: 'Property does not match the specified regular expression\'s pattern'
    },

    format: {
        code: 155,
        error: 'MONOCLE_NOT_MATCHING_FORMAT',
        message: 'Property does not match format that the value must conform to'
    },

    minItems: {
        code: 160,
        error: 'MONOCLE_BELOW_MINIMUM_ITEMS',
        message: 'Property does not contain the minimum number of items required in the array'
    },

    maxItems: {
        code: 165,
        error: 'MONOCLE_ABOVE_MAXIMUM_ITEMS',
        message: 'Property does not contain the maximum number of items required in the array'
    },

    additionalItems: {
        code: 170,
        error: 'MONOCLE_CONTAINS_ADDITIONAL_ITEMS',
        message: 'Resource contains additional properties that are not defined in the schema'
    },

    uniqueItems: {
        code: 175,
        error: 'MONOCLE_CONTAINS_DUPLICATE_ITEMS',
        message: 'Property contains duplicate items in the array'
    },

    required: {
        code: 180,
        error: 'MONOCLE_REQUIRED',
        message: 'Does not contain a required property'
    }
};
