/**
 * A CursorPaginator represents an array of items
 * that can be paginated via offset/limit parameters.
 * The items may be Resources, Symlinks, primatives, or any combination.
 * CursorPaginator provides a fluent interface to simplify their creation.
 *
 * ```js
 * return new CursorPaginator('/inbox')
 * .setItems([
 *     new Symlink('/messages/123'),
 *     new Symlink('/messages/789'),
 *     new Symlink('/messages/456')
 * ])
 * .setExpires(60000)       // expires in 60 seconds
 * .setTotal(500)           // total size of the collection
 * .setLimit(10)            // limit specified by client
 * .setNextCursor('abc123') // cursor for next page
 * ```
 */
var CursorPaginator = function(id, items, expires) {
    // Initial values default to `undefined`
    // to prevent them from appearing in JSON until set
    this.$type = 'collection';
    this.$id = undefined;
    this.$expires = undefined;
    this.total = undefined;
    this.limit = undefined;
    this.cursor = undefined;
    this.nextCursor = undefined;
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
 * @param {string|undefined} id - The new resource ID or `undefined` to remove it.
 * @throws Error - Provided resource ID is invalid.
 * @returns this - Fluent interface.
 */
CursorPaginator.prototype.setId = function(id) {
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
 * @returns string|undefined - The resource ID for this collection
 */
CursorPaginator.prototype.getId = function() {
    return this.$id;
};

/**
 * Sets the items in the collection.
 *
 * @param {Array} items - Array of items that are in this collection.
 *     May be an array of Resources, Symlinks, primatives, or any combination.
 * @throws Error - When non-array is passed in.
 * @returns this - Fluent interface.
 */
CursorPaginator.prototype.setItems = function(items) {
    if (!Array.isArray(items)) {
        throw new Error("Expecting items to be an array, got " + typeof items);
    }
    this.items = items;
    return this;
};

/**
 * Gets the items in the collection.
 *
 * @returns array - All items in the collection.
 */
CursorPaginator.prototype.getItems = function() {
    return this.items;
};

/**
 * Sets the value for an item in the collection.
 *
 * @param {Number} position - The integer array position.
 * @param {Array} item - Item to be placed into specified position.
 * @throws Error - Invalid position.
 * @returns this - Fluent interface.
 */
CursorPaginator.prototype.setItem = function(position, item) {
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
 * @param {Number} position - The integer array position.
 * @returns mixed - The item at the position in the collection or undefined.
 */
CursorPaginator.prototype.getItem = function(position) {
    return this.items[position];
};

/**
 * Sets the expiration for the collection in milliseconds.
 *
 * @param {Number|undefined} expires - Maximum number of milliseconds this collection may be cached for.
 * @throws Error - Expiration is invalid.
 * @returns this - Fluent interface.
 */
CursorPaginator.prototype.setExpires = function(expires) {
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
 * @returns integer|undefined - Maximum number of milliseconds this collection may be cached for.
 */
CursorPaginator.prototype.getExpires = function() {
    return this.$expires;
};

/**
 * Sets the total number of items in the collection.
 * May be more than the number of items represented.
 *
 * @param {Number} total - Number of items in the collection.
 * @throws Error - Total is invalid.
 * @returns mixed - Total number of items in collection if no argument provided,
 *     otherwise returns `this` for fluent interface
 */
CursorPaginator.prototype.setTotal = function(total) {
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
 * @returns integer|undefined - Total number of items in the collection
 */
CursorPaginator.prototype.getTotal = function() {
    return this.total;
};

/**
 * Sets the limit of items in the collection, or undefined if no limit is set.
 *
 * @param {Number|undefined} limit - Limit of items in the collection.
 * @throws Error - Limit is invalid.
 * @returns this - Fluent interface.
 */
CursorPaginator.prototype.setLimit = function(limit) {
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
 * @returns integer|undefined - Limit of items in the collection.
 */
CursorPaginator.prototype.getLimit = function() {
    return this.limit;
};

/**
 * Sets the current cursor for the items in the collection, or undefined if no cursor exists.
 *
 * @param {String|undefined} cursor - Current cursor for items in the collection.
 * @returns this - Fluent interface.
 */
CursorPaginator.prototype.setCursor = function(cursor) {
    this.cursor = cursor;
    return this;
};

/**
 * Returns the current cursor for the items in the collection, or undefined if no cursor exists.
 *
 * @returns string|undefined - Current cursor for items in the collection.
 */
CursorPaginator.prototype.getCursor = function() {
    return this.cursor;
};


/**
 * Sets the cursor for the next page of items in the collection, or undefined if no next cursor exists.
 *
 * @param {String|undefined} nextCursor - Cursor for the next page of items in the collection.
 * @returns this - Fluent interface.
 */
CursorPaginator.prototype.setNextCursor = function(nextCursor) {
    this.nextCursor = nextCursor;
    return this;
};

/**
 * Returns the cursor for the next page of items in the collection, or undefined if not set.
 *
 * @returns string|undefined - Cursor for next page of items in the collection.
 */
CursorPaginator.prototype.getNextCursor = function() {
    return this.nextCursor;
};

/**
 * Removes the last item from the collection and returns it.
 *
 * @returns any
 */
CursorPaginator.prototype.pop = function() {
    return this.items.pop();
};

/**
 * Adds the item to the end of the collection.
 *
 * @param {any} item - The item to add
 * @returns {CursorPaginator} - fluent interface
 */
CursorPaginator.prototype.push = function(item) {
    this.items.push(item);
    return this;
};

/**
 * Removes the first item from the collection and returns it.
 *
 * @returns mixed
 */
CursorPaginator.prototype.shift = function() {
    return this.items.shift();
};

/**
 * Adds the item to the beginning of the collection.
 *
 * @param {any} item - The item to add
 * @returns this - fluent interface
 */
CursorPaginator.prototype.unshift = function(item) {
    this.items.unshift(item);
    return this;
};

module.exports = CursorPaginator;
