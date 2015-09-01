module.exports = [];
for (var i = 0; i < 100; i++) {
    var messageId = i + 1;
    var fromUserId = (messageId % 5) + 1;
    var toUserId = ((fromUserId + 1) % 5) + 1;

    module.exports.push({
        messageId: messageId,
        fromUserId: messageId % 5,
        toUserId: toUserId,
        content: 'Test message ' + messageId
    });
}
