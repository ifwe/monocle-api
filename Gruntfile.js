var path = require('path');

module.exports = function(grunt) {
    var TEST_RUNNER = path.join(process.cwd(), 'test', 'test_runner');
    var ALL_TESTS = 'test/**/*_test.js';

    // NPM tasks, alphabetical
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-docco');
    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.initConfig({
        // Clean
        clean: {
            docs: ['docs'],
            coverage: ['test/coverage.html']
        },

        // Documentation
        docco: {
            main: {
                src: ['lib/**/*.js'],
                options: {
                    output: 'docs/'
                }
            }
        },

        // Server-side mocha tests
        mochaTest: {
            // Runs all tests
            test: {
                options: {
                    require: TEST_RUNNER,
                    reporter: 'spec',
                    ui: 'bdd',
                    timeout: 200,
                    recursive: true,
                    clearRequireCache: true
                },
                src: [ALL_TESTS]
            },

            // Instruments code for reporting test coverage
            instrument: {
                options: {
                    require: TEST_RUNNER,
                    reporter: 'spec',
                    ui: 'bdd',
                    timeout: 200,
                    recursive: true,
                },
                src: [ALL_TESTS]
            },

            // Reports test coverage
            coverage: {
                options: {
                    require: TEST_RUNNER,
                    reporter: 'html-cov',
                    ui: 'bdd',
                    timeout: 200,
                    recursive: true,
                    quiet: true,
                    captureFile: 'test/coverage.html'
                },
                src: [ALL_TESTS]
            }
        },

        // Watches filesystem for changes to run tasks automatically
        watch: {
            test: {
                options: { spawn: false },
                files: [
                    'lib/**/*.js',
                    'test/**/*.js'
                ],
                tasks: ['mochaTest:test']
            },
            docco: {
                options: { spawn: false },
                files: ['lib/**/*.js'],
                tasks: ['docco:main']
            }
        }
    });

    // Runs all unit tests
    grunt.registerTask('test', 'All unit tests', ['mochaTest:test']);

    // Generates test coverage report
    grunt.registerTask('coverage', 'Unit test code coverage', ['clean:coverage', 'mochaTest:instrument', 'mochaTest:coverage']);

    // Generates documentation
    grunt.registerTask('docs', 'Generate documentation', ['clean:docs', 'docco:main']);
};
