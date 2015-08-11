var path = require('path');

// Use constant to help with resolving path to lib code within test files
GLOBAL.LIB_DIR = path.join(process.cwd(), 'lib');

// Set up in-place instrumentation for code coverage
require('blanket')({ pattern: LIB_DIR });

// Set up sinon
GLOBAL.sinon = require('sinon');

// Set up chai
GLOBAL.chai = require('chai');
chai.should();
GLOBAL.assert = chai.assert;
GLOBAL.expect = chai.expect;
chai.config.includeStack = true;
