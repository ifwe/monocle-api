var messageSchema = require('./message');

module.exports = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'Messaging Conversation',
    description: 'A conversation between two users.',
    type: 'array',
    items: messageSchema
};
