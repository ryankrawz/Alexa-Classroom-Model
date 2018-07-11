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

readTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", "Schedule");

async function readTab(key, tabName) {

    let res = {};

    let loadPromise = loadFromSheets();
    let auth = await loadPromise;
    let data = await getData(auth, key, tabName);
    console.log("Google Sheets Read - Success");

    let values = data.values;
    let headers = values[0];
    let kinds = values[1];

    for (let i = 2; i<values.length; i++) {
        let currentPath = res;
        for (let j = 0; j<values[i].length; j++) {
            switch (kinds[j]) {
                case 'key':
                    if (currentPath.hasOwnProperty(values[i][j])) {
                        currentPath = currentPath[values[i][j]];
                    } else {
                        currentPath = currentPath[values[i][j]];
                        currentPath = {};
                    }
                    break;
                case 'string':
                    currentPath[headers[i]] = values[i][j];
                    break;
                case 'time':
                    currentPath[headers[i]] = convertTime(values[i][j]);
                    break;
                case 'number':
                    currentPath[headers[i]] = parseInt(values[i][j]);
                    break;
                default:
                    console.log("Yikes that's a weird type");
            }
        }
    }


    /*
    let skillsSheets = data.data.sheets.slice(1);
    skillsSheets.forEach(sheet => {

        let courseNumber = sheet.properties.title;

        res[courseNumber] = {
            headers: [],
            rowData: [],
            colData: [],
            nCol: 0,
            nRow: 0
        };

        //index 0 is the headers
        res[courseNumber].headers = sheet.data[0].rowData[0];

        //omit index 0 because it's the header row
        let rows = sheet.data[0].rowData.slice(1);

        rows.forEach(row => {

            let r = res[courseNumber].rowData.length;
            let c = res[courseNumber].colData.length;

            if (row.values) {
                r.push([]);
                c.push([]);

                let values = row.values;

                //writing rows
                values.forEach(val => {
                    if (val.effectiveValue) {
                        res[courseNumber].rows.push(val.effectiveValue);
                    }
                });

                if (row.values[0].effectiveValue && row.values[1].effectiveValue) {
                    // Sets tag (first column) as key in empty object and sets question (second column) as value
                    res[courseNumber][row.values[0].effectiveValue.stringValue] = row.values[1].effectiveValue.stringValue;
                } else {
                    console.log("That row didn't have both a tag and an answer");
                }
            } else {
                console.log("Skipping empty row.");
            }
        });

    });

    let scheduleSheet = data.data.sheets[0];
    let profSchedule = {};
    profSchedule[scheduleSheet.properties.title] = {};
    let rows = scheduleSheet.data[0].rowData.slice(1);
    let headers = scheduleSheet.data[0].rowData[0];
    */
}

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

/**
 * https://docs.google.com/spreadsheets/d/11ZmOmNRSh00YaKDXl13-_MMbeX6uDY2gLD0exVxL-14/edit#gid=0
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function getData(auth, key, tabName) {
    const sheets = google.sheets({version: 'v4', auth});

    let readDataParams = {
        spreadsheetId: key,
        range: tabName,
        includeGridData: true
    };

    let p = sheets.spreadsheets.values.get(readDataParams);
    return p;

    //console.log(allQuestions["Sheet1"][0].tag);

    // let values = [
    //   ["Item", "Cost", "Stocked", "Ship Date"],
    //   ["Wheel", "$20.50", "4", "3/1/2016"],
    //   ["Door", "$15", "2", "3/15/2016"],
    //   ["Engine", "$100", "1", "30/20/2016"],
    //   ["Totals", "=SUM(B2:B4)", "=SUM(C2:C4)", "=MAX(D2:D4)"]
    // ];
    //
    // let body = {
    //   values: values
    // };
    //
    // let params1 = {
    //   spreadsheetId: "11ZmOmNRSh00YaKDXl13-_MMbeX6uDY2gLD0exVxL-14",
    //   range: sheetName,
    //   resource: body,
    //   valueInputOption: "USER_ENTERED"
    // };
    //
    // sheets.spreadsheets.values.update(params1)
    //   .then(data => {
    //     console.log("Success");
    //     console.log(data.toString());
    //   })
    //
    //   .catch(err => {
    //     console.log("Error");
    //     console.log(err.toString());
    //   })
}
