// this file is for testing lambda locally
// once working, it will invoke lambda via lambda-local package

const lambdaLocal = require('lambda-local');

const jsonPayload = require("./local-event.json");

// If you want to pass an AWS profile name to node, add it as an application parameter in your Run Configuration.
// The code below will use it. If you don't need this, don't add any parameters and everything will
// work with the defaults.
let args = process.argv.slice(2);
let awsprofile = 'default';

if (args.length > 0) {
    awsprofile = args[0];
}

lambdaLocal.execute({
    event: jsonPayload,
    lambdaPath: './index.js',
    timeoutMs: 120000,
    profileName: awsprofile,
    callback: function(err, data) {
        if (err) {
            console.log(err);
        } else {
            console.log(data);
        }
    }
});