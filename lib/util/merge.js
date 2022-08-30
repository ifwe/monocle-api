'use strict';

var debug = require('debug')('monocle-api:util:merge');

function isObject(element) {
    if (element == null || typeof element !==  'object' || element.constructor == Date || Array.isArray(element)) {
        return false;
    }

    return true;
}

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
    var sources = Array.prototype.slice.call(arguments, 1);

    for (var sourceKey in sources) {
        if (!Object.prototype.hasOwnProperty.call(sources, sourceKey)) {
            continue;
        }

        var source = sources[sourceKey];
        if (!isObject(source) && !Array.isArray(source)) {
            target = source;
            continue;
        }

        for (var elementKey in source) {
            if (!Object.prototype.hasOwnProperty.call(source, elementKey)) {
                continue;
            }

            var element = source[elementKey];
            if (!Object.prototype.hasOwnProperty.call(target, elementKey)) {
                target[elementKey] = element;
                continue;
            }

            if (Array.isArray(element)) {
                element.forEach(function(arrayValue, arrayIndex) {
                    if (typeof target[elementKey][arrayIndex] == 'undefined') {
                        target[elementKey][arrayIndex] = arrayValue;
                        return;
                    }

                  target[elementKey][arrayIndex] = merge(target[elementKey][arrayIndex], arrayValue);

                });
                continue;
            }

            if (isObject(element)) {
                target[elementKey] = merge(target[elementKey], element);
                continue;
            }

            target[elementKey] = element;
        }
    }

    return target;
};
