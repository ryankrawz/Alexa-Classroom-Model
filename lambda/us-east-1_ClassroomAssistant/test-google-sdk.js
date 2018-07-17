// for local testing of GoogleSDK.js

const googleSDK = require('./GoogleSDK.js');

console.log('googleSDK = ' + Object.keys(googleSDK));

// read in some sheets to test readTab
// to see actual values, currently debugger is best
async function testRead() {

    let scheduleObj = await googleSDK.readTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", "Schedule");
    console.log("schedule = " + scheduleObj);

    let rosterObj = await googleSDK.readTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", "Roster");
    console.log("roster = " + rosterObj);

    let questionObj = await googleSDK.readTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", "QuizQuestions");
    console.log("questions = " + questionObj);

}

testRead();


// simple test of write

// read sheet and then update?
// how do read and write play?




async function testWrite() {

    const sheetData = {
        // omit? "range": "A1:D5",
        "majorDimension": "ROWS",
        "values": [
            ["Item", "Cost", "Stocked", "Ship Date"],
            ["Wheel", "$20.50", "4", "3/1/2016"],
            ["Door", "$15", "2", "3/15/2016"],
            ["Engine", "$100", "1", "30/20/2016"],
            ["Totals", "=SUM(B2:B4)", "=SUM(C2:C4)", "=MAX(D2:D4)"]
        ]
    };

    const keyList = "Engine";
    const valueList = {"header":"Cost", "value": "1,000.99"};

    googleSDK.writeTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", "WriteTest", keyList, valueList);
}

testWrite();