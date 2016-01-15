var crypto = require('crypto');

/**
 * Given a collection and request details,
 * determines a "weak" etag.
 */
var CollectionCache = function(collection, request) {
    this.collection = collection;
    this.request = request;
};

/**
 * Generates a "weak" etag for the collection.
 * Returns `false` if a weak etag cannot be created.
 *
 * @returns string|false - Weak etag
 */
CollectionCache.prototype.id = function() {
    if (this.collection.$type !== 'collection' || !this.collection.$id || !this.collection.$expires) {
        return false;
    }

    if (!Array.isArray(this.collection.items)) {
        // No items, probably filtered out, unable to create an etag
        return false;
    }

    var hasMissingIdentity = false;

    // 1. Gather resource IDs in collection
    var resourceIds = this.collection.items.map(function(item) {
        if (item.$link) {
            return item.$link;
        }

        if (item.$id) {
            return item.$id;
        }

        // Item has no identity
        hasMissingIdentity = true;
    });

    if (hasMissingIdentity) {
        // Cannot create an etag if identities are missing
        return false;
    }

    // 2. Gather requested props, alphabetized
    var props = [].concat(this.request.getProps()).sort();

    // 3. Gather all other query string parameters
    var query = this.request.getUrl().search
    .replace(/^\?/, '')             // remove "?" from beginning of string
    .split('&')                     // create array of keyvalue parts
    .filter(function(keyvalue) {    // filter out "props" query string param
        return !keyvalue.match(/^props=/)
    })
    .sort();                        // sort alphabetically

    // 4. Generate a string of metadata
    var metadataString = JSON.stringify([
        resourceIds,
        props,
        query
    ]);

    // 5. Generate a sha256 hash of the metadata
    var sha256Hash = crypto
    .createHash('sha256')
    .update(metadataString, 'utf8')
    .digest('hex');

    // 6. Make a weak etag
    return 'W/"' + sha256Hash + '"';
};

/**
 * Verifies an etag. Returns `true` if it matches.
 *
 * @param string etag - The etag to check.
 * @return boolean - True if passes validation.
 */
CollectionCache.prototype.isValid = function(etag) {
    if (!etag) {
        return false;
    }

    if (!etag.match(/W\/"[0-9a-f]+"/)) {
        return false;
    }

    var actualEtag = this.id();
    if (!actualEtag) {
        return false;
    }

    return etag === actualEtag;
};

module.exports = CollectionCache;
