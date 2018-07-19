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

/**
 * Writes values into specified columns of a specially formatted spreadsheet
 * @param  {string}                    sheetId     Google Sheets identifer string for whole file
 * @param  {string}                    tabName     Name of tab being written to; exact match required
 * @param  {Object.<string, string>}   keys        Key:Value pairs for all keys identified in the sheet
 * @param  {Object.<string, string>}   values      Key:Value pairs for non-key columns being written to
 *
 * @returns {boolean} Returns true if successful, false if error
 */
exports.writeTab = async function (sheetID, tabName, keys, values) {

    let loadPromise = loadFromSheets();
    let auth = await loadPromise;
    const sheets = google.sheets({version: 'v4', auth});

    // get current data as value range
    let valRange = await getValueRange(auth, sheetID, tabName);
    valRange = valRange.data;

    // Find rows that correspond to each key and successively narrow the set, key by key.

    let rows = valRange.values;
    let headers = rows[0];
    let types = rows[1];

    // Construct an array of key names based on columns in types that are annotated as 'key'
    let keyNames = [];
    for (let i = 0; i < types.length; i++) {
        if (types[i] != 'key') {
            break;
        }
        keyNames.push(headers[i]);
    }

    let startRow = 2;
    let endRow = rows.length - 1;

    // Narrow down to a range of row indices (startRow, endRow) that contain the intersection of the key values
    keyNames.forEach((k, idx) => {
        let r;
        for (r=startRow; r <= endRow; r++) {
            if (keys[k] == rows[r][idx]) {
                startRow = r;
                break;
            }
        }

        if (r == endRow + 1) {
            // Key not found
            console.log('writeTab could not find value ' + keys[k] + ' for key ' + k);
            return false;
        }

        for (let r=startRow + 1; r <= endRow; r++) {
            if (rows[r][idx] != "" && rows[r][idx] != keys[k]) {
                endRow = r - 1;
                break;
            }
        }
    });

    // startRow and endRow should be equal. If not, duplicate key error
    if (startRow != endRow) {
        console.log('Apparent duplicate key in sheet tab ' + tabName);
        return false;
    }

    // Determine spreadsheet row corresponding to startRow
    let spreadsheetRow = startRow;

    // Determine spreadsheet columns corresponding to value keys we were given
    // Create appropriate data structure to pass to Google Sheets API
    let dataObjects = [];

    for (let col = keyNames.length; col < headers.length; col++) {
        if (values.hasOwnProperty(headers[col])) {
            let data = {
                range: tabName + '!' + String.fromCharCode(65 + col) + (spreadsheetRow+1).toString(),
                values: [
                    [
                        values[headers[col]]
                    ]
                ]
            };
            dataObjects.push(data);
        }
    }


    // Construct appropriate parameters for Sheets API call
    let params1 = {
        spreadsheetId: sheetID,
        resource: {
            valueInputOption: "USER_ENTERED",
            data: dataObjects
        }
    };

    // Make the Sheets API call
    try {
        await sheets.spreadsheets.values.batchUpdate(params1);
        return true;
    }
    catch(e) {
        console.log('writeTab exception writing to Google sheet tab ' + tabName + ': ' + e);
        return false;
    }
};

// readTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", "Schedule")
//     .then(data => {
//         console.log(data);
//     });

exports.readTab = async function (key, tabName) {

    console.log("readTab starting (" + tabName + ")");
    let loadPromise = loadFromSheets();
    let auth = await loadPromise;

    let data = await getData(auth, key, tabName);
    console.log("Google Sheets Read " + tabName + " - Success");

    let rows = data.data.sheets[0].data[0].rowData;

    // in what follows values is not a plain list and will be referenced later
    let headers = rows[0].values; //column headers
    let kinds = rows[1].values; // types of data in each header

    // set number of columns to avoid getting thrown off by formatting witn no data
    // this might need to get smarter.  for now just take min length of kinds or headers
    const numCols = Math.min(getActualLength(headers),getActualLength(kinds));

    let scheduleObj = {}; // the object that will hold the data
    let latestObj = scheduleObj; // will point to object we are currently working on (could be subset)

    // scan each column of each non-header row
    try {
        for (let row = 2; row < rows.length; row++) {
            // need to exit if we find an all blank row
            if (rowIsBlank(rows[row].values,numCols)) {
                break;
            }
            for (let col = 0; col < numCols; col++) {
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
                    // if there is no effective value, then store empty string
                } else if (kind == 'string') {
                    let sval;
                    try {
                        sval = rows[row].values[col].effectiveValue.stringValue;
                    }
                    catch (e) {
                        sval =  "";
                    }
                    latestObj[kval] = sval;
                } else if (kind == 'number') {
                    let nval;
                    try {
                        nval = rows[row].values[col].effectiveValue.numberValue;
                    }
                    catch (e) {
                        nval =  "";
                    }
                    latestObj[kval] = nval;
                } else {
                    console.log("Yikes that's a weird type");
                }
            }
        }
    } catch (err) {
        console.log("ERROR: " + err);
    }
    console.log("Returning from readTab");
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

// check for blank row
function rowIsBlank(rowData, numCol) {
    const lastCol = Math.min(numCol,rowData.length);
    for (let i = 0; i < lastCol; i++) {
        if (rowData[i].hasOwnProperty("effectiveValue")) {
            return false;
        }
    }
    return true;
}

// get actual length of a row of cells by looking for only columns that have effective value
function getActualLength(rowData) {
    let i;
    for (i = 0; i < rowData.length; i++) {
        if (!rowData[i].hasOwnProperty("effectiveValue")) {
            break;
        }
    }
    return i;
}