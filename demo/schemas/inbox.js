var messageSchema = require('./message');

module.exports = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'Messaging Inbox',
    description: 'A user\'s inbox containing all the conversations that the user has participated in.',
    type: 'array',
    items: {
        type: 'array',
        title: 'Inbox Item',
        properties: {
            href: {
                type: 'string',
                readOnly: true
            },
            latestMessage: messageSchema
        }
    }
};
