'use strict';

var debug = require('debug')('monocle-api:util:merge');

/**
 * Deeply merges all arguments into one and returns the result.
 * Objects are simply combined
 * Arrays values are also merged according to index
 *
 * @return merged object/array
 */
var merge = module.exports = function(/* obj1, obj2, obj3 */) {
    if (arguments.length === 0) {
        debug('nothing to merge, no arguments');
        return undefined;
    }

    if (arguments.length === 1) {
        debug('nothing to merge, only one argument');
        return arguments[0];
    }

    var target = arguments[0];

    // convert arguments to array and cut off target object
    var args = Array.prototype.slice.call(arguments, 1);

    args.forEach(function(obj) {
        if (typeof obj !== 'object' || obj === null) {
            debug('source is not an object, replacing target');
            target = obj;
            return;
        }

        Object.keys(obj).forEach(function(key) {
            if (typeof target[key] !== 'undefined' && typeof obj[key] === 'object' && obj[key] !== null) {
                debug('deep merging', key);
                // object, deep merge!
                target[key] = merge(target[key], obj[key]);
                return;
            }

            debug('replacing value in target', key);
            target[key] = obj[key];
        });
    });

    return target;
};
