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

// keyList is an array of key values
// valueList is an array of value objects consisting of header and value properties
exports.writeTab = async function (sheetID, tabName, keyList, valueList) {

    let loadPromise = loadFromSheets();
    let auth = await loadPromise;
    const sheets = google.sheets({version: 'v4', auth});

    // get current data as value range
    let valRange = await getValueRange(auth, sheetID, tabName);
    valRange = valRange.data;

    // search for key match
    // fixme: now assuming we have just one key and that it is found

    let rows = valRange.values;
    let writeRow = -1;

    // todo: handle multiple keys
    // todo: handle appends correctly
    for (let row = 2; row < rows.length; row++) {
        if (rows[row][0] === keyList) {
            writeRow = row;
            break;
        }
    }

    // append row if we need to
    // need to figure out how many columns to append
    // writeRow = -1 will signal append

    // find column to write into
    // todo: handle multiple values
    // todo: handle column append
    const theRow = rows[writeRow];
    for (let col = 0; col < theRow.length; col++) {
        if (rows[0][col] === valueList.header) {
            theRow[col] = valueList.value;
            break;
        }
    }


    // valRange should now have what it needs



    let params1 = {
      spreadsheetId: sheetID,
      range: valRange.range, // need to update to range we got
      resource: valRange,
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

    // in what follows values is not a plain list and will be referenced later
    let headers = rows[0].values; //column headers
    let kinds = rows[1].values; // types of data in each header

    let scheduleObj = {}; // the object that will hold the data
    let latestObj = scheduleObj; // will point to object we are currently working on (could be subset)

    // scan each column of each non-header row
    try {
        for (let row = 2; row < rows.length; row++) {
            for (let col = 0; col < rows[row].values.length; col++) {
                let kind = kinds[col].effectiveValue.stringValue;
                let kval = headers[col].effectiveValue.stringValue;

                if (kind == 'key') {

                    // blank key value continues previous key
                    // otherwise we need to grab new key
                    if (rows[row].values[col].effectiveValue) {
                        // Unwind stack until stack depth == col
                        // because col starts at 0, this gets us
                        // to level above col
                        while(stack.size() > col) {
                            stack.pop();
                        }

                        // if at 0, we add a key top level object
                        // otherwise stack points to parent in which
                        // to add key
                        if (stack.size() == 0) {
                            latestObj = scheduleObj;
                        }
                        else {
                            latestObj = stack.head();
                        }

                        // get new key as a string
                        // add it as attribute of parent object
                        // intially it points to an empty object
                        let effval = rows[row].values[col].effectiveValue;
                        let cellval = effval.stringValue || effval.numberValue.toString();
                        let newObj = {};
                        latestObj[cellval] = newObj;
                        latestObj = newObj;
                        stack.push(latestObj);
                    }

                    // anything else is data to be added to object we are working on
                    // in that case, kval holds text of header for that kind of data
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

// return data in format readTab can work with
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

// return data as a ValueRange
// writeTab can then update this and push back in
function getValueRange(auth, key, tabName) {
    const sheets = google.sheets({version: 'v4', auth});

    let readDataParams = {
        spreadsheetId: key,
        range: tabName
    };

    let p = sheets.spreadsheets.values.get(readDataParams);
    return p;
}