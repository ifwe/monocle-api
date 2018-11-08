/**
 * An OffsetPaginator represents an array of items
 * that can be paginated via offset/limit parameters.
 * The items may be Resources, Symlinks, primatives, or any combination.
 * OffsetPaginator provides a fluent interface to simplify their creation.
 *
 * ```js
 * return new OffsetPaginator('/users')
 * .setItems([
 *     new Symlink('/users/123'),
 *     new Symlink('/users/789'),
 *     new Symlink('/users/456')
 * ])
 * .setExpires(60000) // expires in 60 seconds
 * .setTotal(500)     // total size of the collection
 * .setLimit(10)      // limit specified by client
 * .setOffset(0)      // offset specified by client
 * ```
 */
var OffsetPaginator = function(id, items, expires) {
    // Initial values default to `undefined`
    // to prevent them from appearing in JSON until set
    this.$type = 'collection';
    this.$id = undefined;
    this.$expires = undefined;
    this.total = undefined;
    this.limit = undefined;
    this.offset = undefined;
    this.items = [];

    if (typeof id !== 'undefined') {
        this.setId(id);
    }

    if (typeof items !== 'undefined') {
        this.setItems(items);
    }

    if (typeof expires !== 'undefined') {
        this.setExpires(expires);
    }
};

/**
 * Sets the resource ID for this collection.
 *
 * @param {String|undefined} id - The new resource ID or `undefined` to remove it.
 * @throws Error - Provided resource ID is invalid.
 * @return this - Fluent interface.
 */
OffsetPaginator.prototype.setId = function(id) {
    var type = typeof id;
    if (type !== 'string' && type !== 'undefined') {
        throw new Error("Expecting id to be a string or undefined, but got " + typeof id);
    }
    this.$id = id;
    return this;
};

/**
 * Gets the resource ID, or undefined if not set.
 *
 * @return string|undefined - The resource ID for this collection
 */
OffsetPaginator.prototype.getId = function() {
    return this.$id;
};

/**
 * Sets the items in the collection.
 *
 * @param {Array} items - Array of items that are in this collection.
 *     May be an array of Resources, Symlinks, primitives, or any combination.
 * @throws Error - When non-array is passed in.
 * @return this - Fluent interface.
 */
OffsetPaginator.prototype.setItems = function(items) {
    if (!Array.isArray(items)) {
        throw new Error("Expecting items to be an array, got " + typeof items);
    }
    this.items = items;
    return this;
};

/**
 * Gets the items in the collection.
 *
 * @return array - All items in the collection.
 */
OffsetPaginator.prototype.getItems = function() {
    return this.items;
};

/**
 * Sets the value for an item in the collection.
 *
 * @param {Number} position - The array position.
 * @param {Array} item - Item to be placed into specified position.
 * @throws Error - Invalid position.
 * @return this - Fluent interface.
 */
OffsetPaginator.prototype.setItem = function(position, item) {
    if (typeof position !== 'number') {
        throw new Error("Expecting position to be a number, got " + typeof position);
    }

    if (position < 0) {
        throw new Error("Expecting position to be 0 or greater");
    }

    this.items[position] = item;
    return this;
};

/**
 * Returns the value for an item in the collection, or undefined if not set.
 *
 * @param {Number} position - The array position.
 * @return mixed - The item at the position in the collection or undefined.
 */
OffsetPaginator.prototype.getItem = function(position) {
    return this.items[position];
};

/**
 * Sets the expiration for the collection in milliseconds.
 *
 * @param {Number|undefined} expires - Maximum number of milliseconds this collection may be cached for.
 * @throws Error - Expiration is invalid.
 * @return this - Fluent interface.
 */
OffsetPaginator.prototype.setExpires = function(expires) {
    var type = typeof expires;

    if (expires < 0) {
        throw new Error("Expecting expires to be 0 or greater");
    }

    if (type !== 'number' && type !== 'undefined') {
        throw new Error("Expecting expires to be a number or undefined, got " + typeof expires);
    }

    this.$expires = expires;
    return this;
};

/**
 * Returns the expiration for the collection in milliseconds, or undefined if not set.
 *
 * @return integer|undefined - Maximum number of milliseconds this collection may be cached for.
 */
OffsetPaginator.prototype.getExpires = function() {
    return this.$expires;
};

/**
 * Sets the total number of items in the collection.
 * May be more than the number of items represented.
 *
 * @param {Number} total - Number of items in the collection.
 * @throws Error - Total is invalid.
 * @return mixed - Total number of items in collection if no argument provided,
 *     otherwise returns `this` for fluent interface
 */
OffsetPaginator.prototype.setTotal = function(total) {
    var type = typeof total;

    if (total < 0) {
        throw new Error("Expecting total to be 0 or greater");
    }

    if (type !== 'number' && type !== 'undefined') {
        throw new Error("Expecting total to be a number or undefined, got " + typeof total);
    }

    this.total = total;
    return this;
};

/**
 * Returns the total number of items in the collection, or undefined if not set.
 *
 * @return integer|undefined - Total number of items in the collection
 */
OffsetPaginator.prototype.getTotal = function() {
    return this.total;
};

/**
 * Sets the limit of items in the collection, or undefined if no limit is set.
 *
 * @param {Number|undefined} limit - Limit of items in the collection.
 * @throws Error - Limit is invalid.
 * @return this - Fluent interface.
 */
OffsetPaginator.prototype.setLimit = function(limit) {
    var type = typeof limit;

    if (limit < 0) {
        throw new Error("Expecting limit to be 0 or greater");
    }

    if (type !== 'number' && type !== 'undefined') {
        throw new Error("Expecting limit to be a number or undefined, got " + type);
    }

    this.limit = limit;
    return this;
};

/**
 * Returns the limit of items in the collection, or undefined if not set.
 *
 * @return integer|undefined - Limit of items in the collection.
 */
OffsetPaginator.prototype.getLimit = function() {
    return this.limit;
};

/**
 * Sets the offset of items in the collection, or undefined if no offset is set.
 *
 * @param {Number|undefined} offset - Offset of items in the collection.
 * @throws Error - Offset is invalid.
 * @return this - Fluent interface.
 */
OffsetPaginator.prototype.setOffset = function(offset) {
    var type = typeof offset;

    if (offset < 0) {
        throw new Error("Expecting offset to be 0 or greater");
    }

    if (type !== 'number' && type !== 'undefined') {
        throw new Error("Expecting offset to be a number or undefined, got " + type);
    }

    this.offset = offset;
    return this;
};

/**
 * Returns the offset of items in the collection, or undefined if not set.
 *
 * @return integer|undefined - Offset of items in the collection.
 */
OffsetPaginator.prototype.getOffset = function() {
    return this.offset;
};

/**
 * Removes the last item from the collection and returns it.
 *
 * @return mixed
 */
OffsetPaginator.prototype.pop = function() {
    return this.items.pop();
};

/**
 * Adds the item to the end of the collection.
 *
 * @param {any} item - The item to add
 * @return this - fluent interface
 */
OffsetPaginator.prototype.push = function(item) {
    this.items.push(item);
    return this;
};

/**
 * Removes the first item from the collection and returns it.
 *
 * @return mixed
 */
OffsetPaginator.prototype.shift = function() {
    return this.items.shift();
};

/**
 * Adds the item to the beginning of the collection.
 *
 * @param {any} item - The item to add
 * @return this - fluent interface
 */
OffsetPaginator.prototype.unshift = function(item) {
    this.items.unshift(item);
    return this;
};

module.exports = OffsetPaginator;
