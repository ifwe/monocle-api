module.exports = {
    root: true,
    extends: [
        "eslint:recommended",
    ],
    parserOptions: {
        ecmaVersion: 2019,
    },
    env: {
        es2019: true,
        node: true,
        mocha: true,
    },
    globals: {
        mocha: true,
        chai: true,
        it: true,
        expect: true,
        sinon: true,
    },
};
