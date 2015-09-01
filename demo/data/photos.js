module.exports = [];

for (var i = 0; i < 100; i++) {
    var userId = (i % 5) + 1;
    var photoId = i + 1;
    module.exports.push({
        userId: userId,
        photoId: photoId,
        url: 'http://mysite.com/photos/photo-' + userId + '-' + photoId + '.png',
        caption: 'Awesome photo #' + photoId
    });
}
