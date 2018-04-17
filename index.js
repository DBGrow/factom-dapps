//for packaging
var fs = require('fs');
var zlib = require('zlib');
var zipFolder = require('zip-folder');

const express = require('express');
const app = express();

//read config
var config = require('./config');
for (var option in config) {
    if (config.hasOwnProperty(option) && config[option] != '') {
        // console.log('Config option ' + option + ' = ' + config[option])


    }
}


//initiate HTTP routes
require('./routes/router').init(app);
app.listen(3000, function (err) {
    if (err) throw err;
    console.log('DApp server listening on port 3000')
});


//packaging testing
// packageApp('hello-world');

function packageApp(app_id) {
    var zipIn = __dirname + '/apps/' + app_id;
    var zipOut = __dirname + '/out/' + app_id + '.zip';

    console.time('Zip App');
    zipFolder(zipIn, zipOut, function (err) {
        if (err) throw err;

        fs.readFile(zipOut, 'utf8', function (err, zip_contents) {
            if (err) throw err;
            // var w = fs.createWriteStream();
            zlib.deflate(zip_contents, function (err, compressed_content) {
                if (err) throw err;
                console.timeEnd('Zip App');
                console.log('Deflated: ' + (compressed_content.length / 1000) + 'KB');

            })
        })
    });
}