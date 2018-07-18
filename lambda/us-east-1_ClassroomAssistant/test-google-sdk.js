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

    const keysWriteTest = {
        Category: 'drivetrain',
        SubCategory: 'transmission',
        Item: 'engine'
    };

    const keysRoster = {
        CourseNumber: '1111',
        SectionNumber: '111102',
        NickName: 'Jam'
    };

    const valuesWriteTest = {"Ship Date":"7/18/2018"};
    const valuesRoster = {ParticipationPoints: 3};
    const tabNameWriteTest = 'WriteTest';
    const tabNameRoster = 'Roster';

    let keys = keysRoster;
    let values = valuesRoster;
    let tabName = tabNameRoster;

    googleSDK.writeTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", tabName, keys, values);
}

testWrite();