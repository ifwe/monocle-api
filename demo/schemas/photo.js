module.exports = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'Photo',
    description: 'A user-uploaded photo.',
    type: 'object',
    properties: {
        userId: {
            description: 'A unique identifier for the user that owns this photo.',
            type: 'integer',
            minimum: 1,
            readOnly: true,
            sample: 123
        },
        photoId: {
            description: 'A unique identifier for this photo.',
            type: 'integer',
            minimum: 1,
            readOnly: true,
            sample: 456
        },
        url: {
            description: 'Auto-generated URL to access the photo.',
            type: 'string',
            readOnly: true,
            sample: 'http://example.com/img-123-456.jpg'
        },
        caption: {
            description: 'A user-supplied caption that describes this photo.',
            type: 'string',
            sample: 'My awesome picture!'
        },
        photo: {
            description: 'Photo',
            type: 'file'
        }
    }
};
