const fs = require('fs');
var path = require("path");
var dir = require('node-dir');
const {NodeVM, VMScript} = require('vm2');

var loaded_apps = {};
var express_app;

var {Entry} = require('factom/src/entry');
var {Chain} = require('factom/src/chain');

var {FactomCli} = require('factom');

function init(app) {
    express_app = app;

    //set up HTTP endpoints for this app!
    //Serve the app's home page or load it
    app.get('/app/:app_id', function (req, res) {
        console.log('appid: ' + req.params.app_id)
        console.log('params: ' + JSON.stringify(req.params));

        var app_id = req.params.app_id;

        var app = loaded_apps[app_id];
        if (!app) {
            res.send('No app loaded with id ' + app_id);
            return;
        }

        //Pass on the HTTP request to the app to do it's thing
        if (app.index) {
            var handled = app.index.onHTTP(req, res);

            //if the app did not accept this request show the error!s
            if (!handled) res.status(404).send('Got no respose from the app at this endpoint!');
        }
    });

    //serve an app's static files!
    app.get('/app/:app_id/static/*', function (req, res) {
        var app_id = req.params.app_id;

        var app = loaded_apps[app_id];
        if (!app) {
            res.send('No app loaded with id ' + app_id);
            return;
        }


        var filepath = './apps/' + app_id + '/dependencies/static/' + req.params['0'];
        filepath = path.resolve(filepath);
        console.log(filepath);
        res.sendFile(filepath)
    });

    //serve all other HTTP Requests to the app
    app.all('/app/:app_id/*', function (req, res) {
        var app_id = req.params.app_id;

        var app = loaded_apps[app_id];
        if (!app) {
            res.send('No app loaded with id ' + app_id);
            return;
        }

        //Pass on the HTTP request to the app to do it's thing
        if (app.index) {
            var handled = app.index.onHTTP(req, res);

            //if the app did not accept this request show the error!s
            if (!handled) res.status(404).send('Got no respose from the app at this endpoint!');
        }
    });


    //enumerate all installed apps
    syncApps();
}

function syncApps() {
    //enumerate all installed apps by directory in ./apps
    var directory = './apps/';
    dir.files(directory, 'dir', function (err, subdirs) {
        if (err) throw err;
        // console.log(subdirs);
        subdirs.forEach(function (subdir) {
            var app_path = directory + subdir.split('/')[1];
            // console.log(app_path);
            var app_id = app_path.replace('./apps/', "");
            // console.log('AppID: ' + app_id);
            loadAppFromPath(app_path, function (err, app) {
                if (err) {
                    console.error(err);
                    return;
                }
                console.log("loaded app " + app._id);

                //put the app into the global loaded map if it does not exist
                if (!loaded_apps[app._id]) {
                    loaded_apps[app._id] = app;
                    runApp(app._id);
                    return;
                }
            });
        });
    }, {recursive: false});
}

//only 2 files are required to run an app:
// factom.js - the manifest for the app
// index.js - the starting file that contains the index() function that the VM calls to initiate the code
function loadAppFromPath(path, callback) {
    //load the app's factom manifest
    // console.log('path: ' + path)

    fs.readFile(path + '/manifest.json', 'utf8', function (err, app_manifest_string) {
            if (err) throw err;
            var manifest = JSON.parse(app_manifest_string);
            // console.log('manifest: ' + JSON.stringify(manifest));

            //evaluate the manifest

            //load the app's index file
            fs.readFile(path + '/index.js', 'utf8', function (err, app_index_string) {
                if (err) throw err;
                // console.log('app_index_string: ' + app_index_string);

                //ensure any other dependencies specified in the app's /dependencies folder
                //are loaded

                dir.files(path + '/dependencies', function (err, subdirs) {
                    if (err) throw err;

                    //deps template
                    var dependencies = {};

                    //load all dependency files except for those under dependencies and anywhere else the manifest defines
                    var exclude_regexes = [/*RegExp('/dependencies/static*')*/];
                    if (manifest['exclude_dependency_paths']) {
                        for (var directory in manifest.exclude_dependency_paths) {
                            if (manifest.exclude_dependency_paths.hasOwnProperty(directory)) {
                                exclude_regexes.push(RegExp(manifest['exclude_dependency_paths']));
                                console.log('excluding ' + manifest['exclude_dependency_paths'])
                            }
                        }
                    }

                    var completed = 0;
                    subdirs.forEach(function (subdir) {
                        //if file is not on excluded list inject it as a dependency:
                        // console.log('test '+subdir+'\n'+regex1.test(subdir));
                        if (exclude_regexes.some(function (regex) {
                            return regex.test(subdir)
                        })) {
                            // console.log('skipped ' + subdir);
                            completed++;
                            return; //skip
                        }
                        // console.log('Loaded dep ' + subdir);
                        fs.readFile(subdir, 'utf8', function (err, dependency) {
                            if (err) throw err;
                            var depname = subdir.replace('apps/' + manifest.app_id, "")

                            //attempt to turn into node file if it's not in static
                            if (subdir.includes('.js') && !subdir.includes('static')) {
                                try {
                                    app_index_script = new VMScript(dependency).compile();
                                } catch (err) {
                                    console.error('Failed to compile script.', err);
                                }
                            }

                            dependencies[depname] = dependency;
                            completed++;

                            //done with deps
                            if (completed == subdirs.length) {
                                // try to compile the app
                                console.log('Compiling app with ' + app_index_string.length + ' Bytes');

                                var app_index_script;
                                //attempt to compile the user's script
                                try {
                                    app_index_script = new VMScript(app_index_string).compile();
                                } catch (err) {
                                    console.error('Failed to compile script.', err);
                                    return;
                                }

                                //fill in details from meta!
                                var app = {
                                    _id: manifest.app_id,
                                    manifest: app_manifest_string,
                                    version: '0.0.0',
                                    index_string: app_index_string,
                                    index_script: app_index_script,
                                    path: path,
                                    dependencies: dependencies
                                };
                                if (callback) callback(undefined, app);
                                return app;
                            }
                        })
                    });
                });
            });
        }
    );
}

function runApp(app_id, callback) {
    var app = loaded_apps[app_id];
    if (!app) throw new Error('No app loaded with ID ' + app_id);

    var index_script_string = app.index_string;

    var sandbox = {
        dependencies: app.dependencies, //file deps
        factom_cli: new FactomCli({
            /*factomd: {
                host: '52.202.51.229',
                port: 8088
            },
            walletd: {
                host: '52.202.51.229',
                port: 8089
            }*/
        }), //give the app a fresh instance of the factom-cli
        Entry: Entry,
        Chain: Chain,
        factom_salt: require('../../index').getFactomSalt()
    };

    let vm = new NodeVM({
        sandbox: sandbox,
        require: {
            context: "sandbox",
            external: false,
            builtin: ["crypto"],
        }
    });

    //then run it!
    try {
        var index = vm.run(index_script_string, app.path);
        loaded_apps[app_id].index = index;
        console.log('running app ' + app_id)
    } catch (err) {
        console.error('Failed to execute script.', err);
        if (callback)
            callback(err);
        return;
    }

    process.on('uncaughtException', (err) => {
        console.error('Asynchronous error caught.', err);
    })
}

module.exports = {
    init: init
}