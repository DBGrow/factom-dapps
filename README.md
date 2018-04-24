# Factom DApp

An experimental framework for running Factom-based distributed applications.

DApp modules are written in native node.js and executed in a restricted and isolated sandbox environment based on [VM2](https://github.com/patriksimek/vm2/). 

Modules have access to basic node modules and Factom libraries to perform operations:

- [Node Factom Library](https://github.com/PaulBernier/factomjs)

Modules are exposed by Express, and use HTTP to communicate with the world outside the VM.

## State of Development

Currently in proof of concept stage! (**disclaimer**: Do not expect commits to be backwards compatible or secure)

## DApp Structure

Each DApp needs just 2 files in it's root directory to run:

- `/factom.json` - A manifest describing the contents, identifiers, restrictions on the app, etc.
- `/index.js` - The starting place of the app. Get's run after all dependencies have been loaded

You may optionally include code dependencies for your app in `/dependencies`. Any files ending in `.js` or `.json` will be turned into objects and exposed for your app to use.

You may optionally include static dependencies for your app in `/dependencies/static` like HTML, JS, CSS, and image files, etc. Files in this directory will be ignored for compilation and will be served by Express as static files under `http:localhost:3000/app/<appid>/static/<filename/path>`

## DApp Restrictions

DApps are restricted by the VM to use certain modules. Attempting to `require()` modules that are not allowed will throw an error. even for local modules in `/dependencies`! 

Dependencies are exposed to your app through the `dependencies` object, accessible from code in the app's `index.js`.

## Working with Dependencies

In your app's `index.js`, the `dependencies` object is exposed to access dependencies placed in the app's `/dependencies` folder.  Subfolders are acceptable.

Code and other files are exposed as a string of the file, your app must convert these strings to objects to use them!

For example, heres an app with a valid JS file called `hello.js` under the path `/dependencies/hello.js`.

`/dependencies/hello.js`:

```javascript
module.exports = {speak:function(){console.log("It's Alive!")}}
```

`/index.js`:

```javascript
console.log('Deps: '+dependencies)
var self = this;

//turn all included JS/JSON file dependencies into objects for us to use
for (var depname in dependencies) {
    if (dependencies.hasOwnProperty(depname)) {
        if (depname.includes('.js') && !depname.includes('static')) {
            var jsdep = eval(dependencies[depname]);
            depname = depname.replace('/dependencies/', '').replace('.js', '');
            self[depname] = jsdep;
            console.log('Set JS dep: ' + depname);
        }
    }
}

console.log('Hello Factom!');
self.hello.speak();
```

output:

```
Deps: {"/dependencies/hello.js":"module.exports = {speak:function(){console.log("It's Alive!")}}"}

Set JS dep: hello

It's Alive!
```

## Interacting with your App

You may access your app via HTTP at `http://localhost:3000/app/<yourappid>/<yourroute>`.

At the time of request, this library passes the `request` and `response` objects from Express to your app to handle requests securely in it's isolated VM. Handling of such requests is left up to the user!

All Express requests are passed to your app's `onHTTP` function for you to handle.

### Example

App's `index.js`:

```javascript
module.exports = {

    //Use just like an express endpoint!
    onHTTP: function (req, res) {

        //handle any HTTP methods you want, and parse routes
        
        //return true for any requests your app responds to, false for any that are ignored
        switch (req.method) {
            case 'GET': {
                res.send('App got GET req!');
                return true;
            }

            case 'POST': {
                res.send('App got POST req!');
                return true;
            }

            default:
                return false;
        }
    }
};
```



### Publishing and Downloading apps

You can publish your app to the Factom blockchain for anyone to use! See the functions `downloadApp` and `publishApp` in `index.js` for test code