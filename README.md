# What is it?
A npm package that searches your yarn plug'n'play dependencies (`.yarn/cache/*.zip`) and
tells you which ones declare some sort of install script. Install scripts are dangerous;
you should disable them! But that might break the functionality of some packages, and
this tool lets you know *which* packages, so you can figure out workarounds.

The workarounds might be letting scripts run just for those packages, manually running the
commands that would've run or something else.

# How to use it
You do not need to install it into your project. You can run it with:

```bash
npx https://github.com/tomsaleeba/find-yarn-pnp-deps-with-install-scripts
```

...and it will print progress to stderr, and results to stdout. So you probably want to
run with something like:
```bash
# cd to your project dir that has the .yarn/ directory in it
cd my-project/
npx https://github.com/tomsaleeba/find-yarn-pnp-deps-with-install-scripts | tee results.txt
```

...and then you can watch the progress (it should take less than a minute for a normal
amount of dependencies on a regular laptop) and have a copy of the results in `results.txt`.

Example output:
```
$ npm FIXME | tee results.txt
...(snip)...
Checking esutils-npm-2.0.3-f865beafd5-9a2fe69a41.zip
Checking event-loop-lag-npm-1.4.0-294a2c0c07-784e59a0b4.zip
Checking event-loop-stats-npm-1.4.1-2e76123f7d-12e6f72e08.zip
Checking eventemitter3-npm-4.0.7-7afcdd74ae-5f6d97cbcb.zip
Checking execa-npm-5.1.1-191347acf5-c8e615235e.zip
event-loop-stats
...(snip)...

$ cat results.txt
event-loop-stats
```

I had hoped it would work with `yarn dlx` too, but it doesn't:
```bash
$ yarn dlx https://github.com/tomsaleeba/find-yarn-pnp-deps-with-install-scripts
Internal Error: Invalid descriptor (https://github.com/tomsaleeba/find-yarn-pnp-deps-with-install-scripts)
```
soooo 🤷.
