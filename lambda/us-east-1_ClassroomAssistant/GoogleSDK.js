//Helper Functions
/*
1. a function that turn sheet/rows into an js object
2. converting time stamp into a 0-1 format
3. writing to sheets
4. move all the authentication to here
*/

// this is an sdk to help read in from google sheets

const fs = require('fs');
const util = require("util");
const readline = require('readline');
const {google} = require('googleapis');
var Peela = require( 'peela' );
let stack = Peela();

// If modifying these scopes, delete credentials.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'credentials.json';

const readFile = util.promisify(fs.readFile);

function convertTime(time) {
    time = time.split(":");
    let hours = parseInt(time[0]);
    let minutes = parseInt(time[1]);
    hours += (minutes / 60.0);
    return (hours / 24.0);
}

exports.writeTab = async function (key, tabName, values) {

    let loadPromise = loadFromSheets();
    let auth = await loadPromise;
    const sheets = google.sheets({version: 'v4', auth});

    let body = {
      values: values
    };

    let params1 = {
      spreadsheetId: key,
      range: tabName,
      resource: body,
      valueInputOption: "USER_ENTERED"
    };

    sheets.spreadsheets.values.update(params1)
      .then(data => {
        console.log("Success");
        console.log(data.toString());
      })

      .catch(err => {
        console.log("Error");
        console.log(err.toString());
      })
};

// readTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", "Schedule")
//     .then(data => {
//         console.log(data);
//     });

exports.readTab = async function (key, tabName) {

    let loadPromise = loadFromSheets();
    let auth = await loadPromise;

    let data = await getData(auth, key, tabName);
    console.log("Google Sheets Read - Success");

    let rows = data.data.sheets[0].data[0].rowData;
    let headers = rows[0].values; //reference the property later, this isn't a plain list
    let kinds = rows[1].values;
    let scheduleObj = {};
    let latestObj = scheduleObj;

    try {
        for (let row = 2; row < rows.length; row++) {
            for (let col = 0; col < rows[row].values.length; col++) {
                let kind = kinds[col].effectiveValue.stringValue;
                let kval = headers[col].effectiveValue.stringValue;

                if (kind == 'key') {
                    if (rows[row].values[col].effectiveValue) {
                        if (col == 0) {
                            stack.flush();
                            latestObj = scheduleObj;
                        }
                        //there is an effective value to the first cell
                        let cellval = rows[row].values[col].effectiveValue.stringValue;
                        let newObj = {};
                        latestObj[cellval] = newObj;
                        latestObj = newObj;
                        stack.push(latestObj);
                    } else {
                        stack.pop();
                        latestObj = stack.head();
                    }
                } else if (kind == 'string') {
                    let sval = rows[row].values[col].effectiveValue.stringValue;
                    latestObj[kval] = sval;
                } else if (kind == 'number') {
                    let nval = rows[row].values[col].effectiveValue.numberValue;
                    latestObj[kval] = nval;
                } else {
                    console.log("Yikes that's a weird type");
                }
            }
        }
    } catch (err) {
        console.log("ERROR: " + err);
    }

    return scheduleObj;
};

async function loadFromSheets() {
// Load client secrets from a local file.
    let p = readFile('client_secret.json');
    let res = await p;
    let pAuth = authorize(JSON.parse(res));
    return pAuth;
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    let a = readFile(TOKEN_PATH);
    let token = await a;
    return new Promise((resolve, reject) => {
        oAuth2Client.setCredentials(JSON.parse(token));
        resolve(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return callback(err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

function getData(auth, key, tabName) {
    const sheets = google.sheets({version: 'v4', auth});

    let readDataParams = {
        spreadsheetId: key,
        ranges: tabName,
        includeGridData: true
    };

    let p = sheets.spreadsheets.get(readDataParams);
    return p;
}
