// for local testing of GoogleSDK.js

const googleSDK = require('./GoogleSDK.js');

console.log('googleSDK = ' + Object.keys(googleSDK));

// read in some sheets to test readTab


async function testRead() {

    let scheduleObj = await googleSDK.readTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", "Schedule");
    console.log("schedule = " + scheduleObj);

    let rosterObj = await googleSDK.readTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", "Roster");
    console.log("roster = " + rosterObj);

    let questionObj = await googleSDK.readTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", "QuizQuestions");
    console.log("questions = " + questionObj);

}

testRead();