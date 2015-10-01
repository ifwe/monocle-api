How to publish an update to npm
===============================

1. Create an account at https://www.npmjs.com
2. From the console, run `npm login`, and log in using your new account.
3. Ask the package manager to add you as a collaborator.
4. Run these commands:
```bash
cd path/to/repo
git checkout master
git pull
npm version patch -m "Preparing for publish" # see https://docs.npmjs.com/cli/version
git push
npm publish
```
5. Verify at https://www.npmjs.com/package/{packagename}
