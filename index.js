//for packaging
var fs = require('fs');
var crypto = require('crypto');
var zlib = require('zlib');
var NodeRSA = require('node-rsa');
var uuid = require('node-uuid')

//factom stuff
var {FactomCli} = require('factom');
var cli = new FactomCli();
var {Entry} = require('factom/src/entry');
var {Chain} = require('factom/src/chain');

var {Writer} = require('factom-storage/src/writer');
var writer = new Writer();
var {Reader} = require('factom-storage/src/reader');
var reader = new Reader();

// var FactomStorageDownlaod = require('factom-storage/bin/factom-storage-download');


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
// publishApp('hello-world');

// initPublisherChain('devbyte');
// downloadApp('hello-world');
//
//

return;
//get keys for signing the published package
/*
fs.readFile('./publishing/private.pem', function (err, private_key_buffer) {
    if (err) throw err;
    fs.readFile('./publishing/public.pem', function (err, public_key_buffer) {
        if (err) throw err;

        console.log('Got publishing encryption materials');
        var private_key = new NodeRSA();
        private_key.importKey(private_key_buffer, 'private');

        console.log('Loaded publishing keys');

        var release_uuid = uuid.v1().toString('utf8');
        // var release_uuid = 'hfseuifhisuehf';
        // console.log('' + release_uuid);
        // console.log(get_date_obj(release_uuid));

        var signed_uuid = private_key.sign(release_uuid, 'hex', 'utf8');
        console.log('signed to: ', signed_uuid);
        console.log('signed len: ' + signed_uuid.length);

        const encoding = require('detect-character-encoding');
        console.log(encoding(new Buffer(public_key_buffer)))
        console.log(encoding(new Buffer(release_uuid)))
        console.log(encoding(new Buffer(signed_uuid)))

        var public_key = new NodeRSA();

        public_key.importKey(public_key_buffer.toString(), 'public');
        var verifed = public_key.verify(release_uuid, signed_uuid);

        console.log('authentic: ' + verifed)

        var obj = {
            pub: public_key_buffer.toString(),
            uuid: release_uuid,
            sig: signed_uuid,
        }
        console.log(obj)

        public_key.importKey(obj.pub.toString(), 'public');
        var verifed = public_key.verify(obj.uuid, obj.sig, 'utf8', 'hex');

        console.log('authentic2: ' + verifed)

        var test_entry = Entry.builder()
            .chainId('lsjfiuekfnsef')
            .extId('' + new Date().getTime())
            .content(JSON.stringify(obj), 'utf8')
            .build();

        var entry_content = test_entry.content;
        entry_content = JSON.parse(entry_content);
        // console.log(entry_content)

        public_key.importKey(entry_content.pub.toString(), 'public');
        var verifed = public_key.verify(entry_content.uuid, entry_content.sig, 'utf8', 'hex');
        console.log('authentic3: ' + verifed)
    });
});
return;
*/

function publishApp(app_id) {
    var zipIn = __dirname + '/apps/' + app_id + '/';
    var zipOut = __dirname + '/out/' + app_id + '.zip';

    console.time('Zip App');
    var archiver = require('archiver');
    var output = fs.createWriteStream(zipOut);
    var archive = archiver('zip');

    output.on('close', function () {
        var bytes = archive.pointer();
        console.log("\nDone zipping " + app_id + ", compressed app to " + bytes + ' Bytes');
        console.timeEnd('Zip App');

        //calculate app price

        var ec_cost = Math.ceil(bytes / 100);
        // console.log('This app will cost ~' + ec_cost + 'EC to publish (~$' + (ec_cost * 0.01).toFixed(3) + ' USD)');

        var app_chain_ext_id = crypto.createHash('md5').update(config.factom_salt + app_id).digest('hex');
        console.log('app chain extid: ' + app_chain_ext_id);

        // console.log('Should check for a chain with ID ' +)

        //get keys for signing the published package
        fs.readFile('./publishing/private.pem', function (err, private_key_buffer) {
            if (err) throw err;
            fs.readFile('./publishing/public.pem', function (err, public_key_buffer) {

                console.log('Got publishing encryption materials');


                //upload the app archive to factom
                fs.readFile('./out/' + app_id + '.zip', function (err, buffer) {
                    if (err) throw err;

                    var archive_hash = crypto.createHash('md5').update(buffer).digest("hex");
                    console.log('archive MD5 file_hash: ' + archive_hash);

                    writer.write(app_id, buffer, process.env.FACTOM_EC).then(function (file_meta) {
                        console.log('Success writing app archive to Factom!');


                        //assemble cryptographic info
                        var private_key = new NodeRSA();
                        private_key.importKey(private_key_buffer, 'private');

                        //create a new UUID for the release
                        var release_uuid = uuid.v1().toString('utf8');
                        console.log('' + release_uuid);
                        console.log(get_date_obj(release_uuid));

                        var signed_uuid = private_key.sign(release_uuid, 'hex', 'utf8');
                        console.log('signed to: ', signed_uuid);
                        console.log('signed len: ' + signed_uuid.length);


                        //the metadata about how to assemble this app
                        var publish_entry_content = {
                            uuid: release_uuid, //
                            uuid_sig: signed_uuid, //this signature may be verified against the first entry's `private_key` field
                            app_id: app_id,
                            message: 'Hello world app commit! -drkatz',
                            file_chain_id: file_meta.chainId.toString(), //ID of the chain this app's files are stored under(via factom-storage)
                            file_hash: archive_hash, //the md5 hash of the expected zipped file repo file resulting from downloading file_chain_id

                            //user defined metadata
                            meta: {name: 'hello world app #nolife', version: '0.0.0'}
                        };

                        //check if the app's chain exists

                        var app_chain_id = getAppChainID(app_id);
                        console.log('app_chain_id: ' + app_chain_id);
                        cli.chainExists(app_chain_id).then(function (exists) {
                            if (exists) {
                                console.log('\nApplication chain with ID: ' + app_chain_id + ' exists!');
                                //if chain exists publish the new version of the app to the chain
                                console.log('chainid: ' + app_chain_id);
                                // return;
                                var new_entry = Entry.builder()
                                    .chainId(app_chain_id)
                                    .extId('' + new Date().getTime())
                                    .content(JSON.stringify(publish_entry_content), 'utf8')
                                    .build();

                                console.log('\nNew Entry Content length:');
                                console.log(new_entry.content.length);
                                // console.log('Newentry:')
                                console.log(new_entry);
                                // console.log(new_entry.chainIdHex);
                                console.log(new_entry.content.toString());

                                if (new_entry.content.length == 0) {
                                    console.error('Refused to commit release with content length 0');
                                    return;
                                }


                                return;

                                console.log('Committing entry...');
                                cli.addEntry(new_entry, process.env.FACTOM_EC).then(function (entry) {
                                    console.log('Published release to app chain!');
                                    // console.log('created entry on chain with ID: ');
                                    console.log(entry);
                                }).catch(function (err) {
                                    console.error(err);
                                });
                                return;
                            }
                            console.log('\nApplication chain with ID: ' + app_chain_id + ' did not exist yet!');

                            // we're initiating the chain so add the release private key
                            // Releases from here on may be verified against this public key for authenticity
                            // using each release's `uuid signature`, `uuid`, and this key
                            publish_entry_content.publisher_public_key = public_key_buffer.toString();

                            // console.log('Content string: ' + encrypted_content_string);
                            // console.log('Content string len: ' + encrypted_content_string.length);
                            // console.log('Writing to content: ' + encrypted_content_string);
                            // console.log('content typeof: ' + typeof encrypted_content_string);

                            var new_entry0 = Entry.builder()
                                .extId(new Buffer(app_chain_ext_id), 'utf8')
                                .content(JSON.stringify(publish_entry_content), 'utf8')
                                .build()

                            console.log(new_entry0);

                            //try to dissect

                            var new_chain0 = new Chain(new_entry0);
                            console.log(new_chain0);
                            console.log('Creating app chain with ID: ' + new_chain0.idHex);

                            if (new_entry0.content.length == 0) {
                                console.error('Refused to commit release with content length 0');
                                return;
                            }

                            cli.addChain(new_chain0, process.env.FACTOM_EC).then(function (entry) {
                                console.log('Published new app release chain and release chain! Congrats! You can go to sleep now :)');
                                console.log(entry)

                            }).catch(function (err) {
                                console.error(err);
                            })
                            console.log('Creating app with chain ' + app_chain_id.idHex)
                        }).catch(function (err) {
                            console.error(err);
                        })
                    });
                });
            });

        });

    });

    archive.on('error', function (err) {
        throw err;
    });

    archive.pipe(output);
    archive.directory(zipIn, app_id);
    archive.finalize();
}

function downloadApp(app_id) {
    var zipIn = __dirname + '/apps/' + app_id + '/';
    var zipOut = __dirname + '/out/' + app_id + '.zip';

    var app_chain_id = getAppChainID(app_id);
    console.log('\nGetting chain with ID: ' + app_chain_id);
    cli.getAllEntriesOfChain(app_chain_id)
        .then(function (entries) {
            console.log('Got ' + entries.length + ' release entries');

            //parse the entries from their raw form
            var parsed_entries = parseReleaseEntries(entries);
            console.log('parsed ' + parsed_entries.length + ' release entries');

            //get valid entries from parsed ones
            var valid_parsed_entries = getValidReleaseEntries(parsed_entries);
            console.log('Found ' + valid_parsed_entries.length + ' valid release entries');


            if (valid_parsed_entries.length == 0) throw new Error('Got no valid releases for app ' + app_id);

            //latest entry
            //right now in development we'll assume it's the latest entry

            var latest_release = valid_parsed_entries[parsed_entries.length - 1];

            // var release = JSON.parse(latest_release.content.toString());
            console.log(latest_release);

            //then download the latest release
            //then get the file info from the release entry!
            reader.read(latest_release.file_chain_id).then(function (factom_file) {
                var zip_path = './in/' + app_id + '.zip';
                fs.writeFile(zip_path, factom_file.data, function (err) {
                    if (err) throw err;
                    console.log('Done writing app file!');
                    //then unzip into ./external_apps
                    fs.createReadStream(zip_path).pipe(require('unzip').Extract({path: './external_apps'})).on('error', function (err) {
                        throw err;
                    }).on('close', function () {
                        console.log('Done extracting!');
                    });
                })
            }).catch(function (err) {
                console.error(err);
            });
        });
}

function initPublisherChain(publisher_id) {
    fs.readFile('./publishing/public.pem', function (err, public_key_buffer) {
        if (err) throw err;

        var publisher_chain_id = getPublisherChainID(publisher_id);

        cli.chainExists(publisher_chain_id).then(function (exists) {
            if (exists) {
                console.error('\nPublisher chain for publisher with ID: ' + publisher_id + ' already exists!');
                return;
            }

            console.log('\nPublisher chain for publisher with ID: ' + publisher_chain_id + ' did not exist!');


            var publisher_chain_ext_id = crypto.createHash('md5').update(config.factom_salt + publisher_id).digest('hex');


            var publisher = {
                _id: publisher_id,
                name: 'Devbytes app co.',
                message: 'This is the beginning of our chain! All entries after this will be decryptable by our PK',
                public_key: public_key_buffer.toString()
            };

            var new_publisher_entry = Entry.builder()
                .extId(new Buffer(publisher_chain_ext_id), 'utf8')
                .content(new Buffer(JSON.stringify(publisher)), 'utf8')
                .build()

            console.log(new_publisher_entry);

            var new_publisher_chain = new Chain(new_publisher_entry);
            console.log(new_publisher_chain);
            console.log('Creating Publisher chain chain with ID: ' + new_publisher_chain.idHex);

            if (new_publisher_entry.content.length == 0) {
                console.error('Refused to commit release with content length 0');
                return;
            }

            cli.addChain(new_publisher_chain, process.env.FACTOM_EC).then(function (entry) {
                console.log('Created a new app publisher chain! Congrats! You can go to sleep now :)');
                console.log(entry)
            }).catch(function (err) {
                console.error(err);
            })
        });
    });
}

function getAppChainID(app_id) {
    console.log(config.factom_salt + ' USING SALT');
    return new Chain(Entry.builder()
        .extId(new Buffer(crypto.createHash('md5').update(config.factom_salt + app_id).digest("hex"), 'utf8'))
        .build()).id.toString('hex')
}

function getPublisherChainID(publisher_id) {
    console.log(config.factom_salt + ' USING SALT');
    return new Chain(Entry.builder()
        .extId(new Buffer(crypto.createHash('md5').update(config.factom_salt + publisher_id).digest("hex"), 'utf8'))
        .build()).id.toString('hex')
}

module.exports = {
    getFactomSalt: function () {
        return config.factom_salt;
    }
}


function get_time_int(uuid_str) {
    var uuid_arr = uuid_str.split('-'),
        time_str = [
            uuid_arr[2].substring(1),
            uuid_arr[1],
            uuid_arr[0]
        ].join('');
    return parseInt(time_str, 16);
}

function get_date_obj(uuid_str) {
    var int_time = get_time_int(uuid_str) - 122192928000000000,
        int_millisec = Math.floor(int_time / 10000);
    return new Date(int_millisec);
}

function parseReleaseEntry(raw_entry) {
    return JSON.parse(raw_entry.content)
}

function parseReleaseEntries(raw_entries) {
    return raw_entries.map(function (entry) {
        return parseReleaseEntry(entry)
    })
}

function getValidReleaseEntries(parsed_entries, options) {
    var init_entry = parsed_entries[0];

    if (!init_entry.publisher_public_key) throw new Error('publisher_public_key must be defined');
    if (!init_entry.uuid) throw new Error('uuid must be defined');
    if (!init_entry.uuid_sig) throw new Error('signed UUID must be defined');

    var public_key = new NodeRSA();
    public_key.importKey(init_entry.publisher_public_key, 'public');
    console.log('pubk: \n' + init_entry.publisher_public_key)
    console.log(JSON.stringify(init_entry));

    return parsed_entries.filter(function (entry) {
        try {
            console.log('euuid: ', entry.uuid)
            console.log('esig: ', entry.uuid_sig)
            return public_key.verify(entry.uuid, entry.uuid_sig, 'utf8', 'hex');
        } catch (e) {
            console.error('\nError validating entry: ' + e.message + '\n');
            return false;
        }
    })
}