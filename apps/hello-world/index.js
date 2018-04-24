//where the action for your app happens!
//You are isolated in a VM and able to use limited packages:
//factom as variable (https://www.npmjs.com/package/factom)
var self = this;

//turn all included JS/JSON file dependencies into objects for us to use
console.log('APPDEPS: ' + JSON.stringify(dependencies, undefined, 2));
for (var depname in dependencies) {
    if (dependencies.hasOwnProperty(depname)) {
        // console.log('Dep: ' + depname)
        if (depname.includes('.js') && !depname.includes('static')) {
            var jsdep = eval(dependencies[depname]);
            depname = depname.replace('/dependencies/', '').replace('.js', '');
            self[depname] = jsdep;
            console.log('Set JS dep ' + depname);
        }
    }
}

//you can use the 'factom' npm library just as if required
//under variable 'factom' like so:
var cli = factom_cli;

//lets get an entry for example
/*cli.getEntry('69de95f3ecf34c7cf3e7588c0fbe08a9fd64155d54a1559960295fa9a232f380')
    .then(function (entry) {
        console.log('Entry:');
        console.log('   chainID: ' + entry.chainIdHex);
        console.log('   timestamp: ' + new Date(entry.timestamp) + '(' + entry.timestamp + ')');
        console.log('   extIds: [' + entry.extIdsHex + ']');
        console.log('   content: ' + entry.contentHex);

    }).catch(function (err) {
    console.error(err)
});*/

//happy hacking!!!

module.exports = {

    //Use just like an express endpoint!
    onHTTP: function (req, res) {

        //handle any HTTP methods you want, and parse routes
        //return true for any requests your app responds to, false for any that are ignored
        switch (req.method) {
            case 'GET': {
                console.log('App got GET req!');
                //serve HTML back!
                res.send(dependencies['/dependencies/index.html']);
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