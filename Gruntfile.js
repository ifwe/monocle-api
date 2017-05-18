var path = require('path');

module.exports = function(grunt) {
    var TEST_RUNNER = path.join(process.cwd(), 'test', 'test_runner');
    var ALL_TESTS = 'test/**/*_test.js';

    // NPM tasks, alphabetical
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-docco');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-bump');

    grunt.initConfig({
        // Clean
        clean: {
            docs: ['docs'],
            coverage: ['test/coverage.html']
        },

        //Bump up version
        bump: {
            options: {
                files: ['package.json'],
                updateConfigs: [],
                commit: true,
                commitMessage: 'Release v%VERSION%',
                commitFiles: ['package.json'],
                createTag: true,
                tagName: 'v%VERSION%',
                tagMessage: 'Version %VERSION%',
                push: true,
                pushTo: 'origin',
                gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d',
                globalReplace: false,
                prereleaseName: false,
                regExp: false
            }
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

        // Watches filesystem for changes to run tasks automatically
        watch: {
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
