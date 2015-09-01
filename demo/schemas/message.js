module.exports = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'Message',
    description: 'A single message sent from one user to another.',
    type: 'object',
    properties: {
        messageId: {
            description: 'A unique identifier for this message.',
            type: 'integer',
            minimum: 1,
            readOnly: true,
            sample: 123
        },
        fromUserId: {
            description: 'The user ID of the user that sent the message.',
            type: 'integer',
            minimum: 1,
            readOnly: true,
            sample: 456
        },
        toUserId: {
            description: 'The user ID of the user that the message was sent to.',
            type: 'integer',
            minimum: 1,
            readOnly: true,
            sample: 789
        },
        content: {
            description: 'The contents of the message. May contain sanitized HTML.',
            type: 'string',
            maxLength: 5000,
            readOnly: true,
            sample: 'Hello, friend!'
        }
    }
}
