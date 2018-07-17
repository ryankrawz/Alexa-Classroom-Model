// This is the master skill for all Alexa Skills

/*
todo:
- Refactor intents to use data from Sheets
- Implement Writing to Sheets
- Outsource sheet schema to a JSON file, column names are currently hardcoded
- Change cache stream so user is always prompted for context after-hours
*/

'use strict';

const Alexa = require("alexa-sdk");
const AWS = require("aws-sdk");
const googleSDK = require('./GoogleSDK.js');
AWS.config.update({region: 'us-east-1'});

exports.handler = function (event, context, callback) {
    const alexa = Alexa.handler(event, context, callback);
    alexa.dynamoDBTableName = "ClassroomAssistant";
    alexa.registerHandlers(handlers);
    alexa.execute();
};

function initSheetID(context) {
    if (!context.attributes.spreadsheetID || context.attributes.spreadsheetID === "Not a Real ID") {
        context.attributes.spreadsheetID = "Not a Real ID";
    }
    context.response.speak("Please wait for your administrator to set up Google Sheets.");
    context.emit(':responseReady');
}

function getNames(students) {
    let names = [];
    students.forEach(student => names.push(student.name));
    return names;
}

function randomQuizQuestion(attributes, quizquestions) {
    const beenCalledList = [];
    let speechOutput;
    let courseObj = quizquestions[attributes.courseNumber];
    let questionList = Object.keys(courseObj);
    questionList.forEach(question => beenCalledList.push(courseObj[question][Object.keys(courseObj[student])[2]]));
    const minim = Math.min(...beenCalledList);
    while (true) {
        let randomIndex = Math.floor(Math.random() * questionList.length);
        let randomQuestion = questionList[randomIndex];
        if (courseObj[randomQuestion][Object.keys(courseObj[randomQuestion])[2]] === minim) {
            speechOutput = randomQuestion;
            courseobj[randomQuestion][Object.keys(courseObj[randomQuestion])[2]]++;
            break;
        }
    }
    return speechOutput;
}

function orderedQuizQuestion(attributes, quizquestions) {
    let speechOutput;
    let courseObj = quizquestions[attributes.courseNumber];
    let questionList = Object.keys(courseObj);
    let questionToAsk = questionList.shift();
    questionList.push(questionToAsk);
    return questionToAsk;
}

function convertDayOfWeek(day) {
	let dayInitials = ['U', 'M', 'T', 'W', 'R', 'F', 'A'];
	return dayInitials[day];
}

function convertTimeStamp(timeStamp) {
	let timeList = timeStamp.split(':').map(time => parseInt(time));
	let timeFraction;
	if (timeList.length == 3) {
	    timeFraction = (timeList[0] * 3600 + timeList[1] * 60 + timeList[2]) / (3600 * 24);
    } else if (timeList.length == 2) {
	    timeFraction = (timeList[0] * 3600 + timeList[1] * 60) / (3600 * 24);
    } else {
	    timeFraction = null;
    }
    return timeFraction;
}

function checkSchedule(scheduleObj) {
    let dayOfWeek = convertDayOfWeek(getCurrentDay());
    console.log(dayOfWeek);
    let timeStamp = convertTimeStamp(getCurrentTime());
    console.log(timeStamp);
    let courseNumbers = Object.keys(scheduleObj);
    let gracePeriod = 300/(3600 * 24);

    for (let i = 0; i < courseNumbers.length; i++) {
        let sectionNumbers = Object.keys(scheduleObj[courseNumbers[i]]);
        for (let j = 0; j < sectionNumbers.length; j++) {
            let dayDoesMatch = false;
            let timeDoesMatch = false;
            let sectionObj = scheduleObj[courseNumbers[i]][sectionNumbers[j]];
            let DOWList = sectionObj['DayOfWeek'].split('');
            console.log(DOWList);
            let start = sectionObj['Start'];
            console.log(start);
            let end = sectionObj['End'];
            console.log(end);

            DOWList.forEach(day => {
                if (day == dayOfWeek) {
                    dayDoesMatch = true;
                }
            });
            if (timeStamp >= (start - gracePeriod) && timeStamp <= (end + gracePeriod)) {
                timeDoesMatch = true;
            }
            console.log(dayDoesMatch);
            console.log(timeDoesMatch);
            if (dayDoesMatch && timeDoesMatch) {
                let returnObj = {};
                returnObj[sectionNumbers[j]] = sectionObj;
                returnObj[sectionNumbers[j]].gracePeriod = gracePeriod;
                return returnObj;
            }
        }
    }
    return false;
}

function getCurrentDay() {
    let localDateTime = new Date(Date.now()).toLocaleDateString('en-US', {timeZone: 'America/New_York', hour12: false});
    let currentDay = new Date(localDateTime).getDay();
    console.log(currentDay);
    console.log(typeof currentDay);
    return currentDay;
}

function getCurrentTime() {
    let currentTime = new Date(Date.now()).toLocaleTimeString('en-US', {timeZone: 'America/New_York', hour12: false});
    console.log(currentTime);
    console.log(typeof currentTime);
    return currentTime;
}

//inSchedule is only one section object, with the section number as a key located at the 0th index of Object.keys(inSchedule)
function getContext(attributes, inSchedule) {
    console.log(inSchedule);
    if (inSchedule) {
        let sectionNumber = Object.keys(inSchedule)[0];
        let sectionObj = inSchedule[sectionNumber];
        attributes.courseNumber = sectionNumber.substr(0, 4);
        attributes.sectionNumber = sectionNumber;
        attributes.expiration = sectionObj['End'] + sectionObj.gracePeriod;
    } else {
        console.log('*** looks like we\'re not in the schedule');
    }
}

function isValidSectionTime(attributes, scheduleObj, courseNumberSlot, sectionTimeSlot) {
    let sectionTime = convertTimeStamp(sectionTimeSlot);
    let timeDoesMatch = false;
    Object.values(scheduleObj[courseNumberSlot]).forEach(sectionObj => {
        if (sectionObj['Start'] == sectionTime) {
            attributes.sectionNumber = Object.keys(scheduleObj[courseNumberSlot])[Object.values(scheduleObj[courseNumberSlot]).indexOf(sectionObj)];
            timeDoesMatch = true;
            console.log('***valid section time provided manually');
        }
    });
    return timeDoesMatch;
}

async function readSchedule() {
    let scheduleObj = await googleSDK.readTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", "Schedule");
    return scheduleObj;
}

async function readRoster() {
    let readObj = await googleSDK.readTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", "Roster");
    return readObj;
}

async function readQuizQuestions() {
    let questionObj = await googleSDK.readTab("1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0", "QuizQuestions");
    return questionObj;
}

function coldCallHelper(attributes, roster) {
    const beenCalledList = [];
    let speechOutput;
    let sectionObj = roster[attributes.courseNumber][attributes.sectionNumber];
    console.log(sectionObj);
    let rosterList = Object.keys(sectionObj);
    rosterList.forEach(student => beenCalledList.push(sectionObj[student]['BeenCalled']));
    const minim = Math.min(...beenCalledList);
    while (true) {
        let randomIndex = Math.floor(Math.random() * rosterList.length);
        let randomStudent = rosterList[randomIndex];
        if (sectionObj[randomStudent]['BeenCalled'] === minim) {
            speechOutput = randomStudent;
            sectionObj[randomStudent]['BeenCalled']++;
            // todo: write updated beenCalled values to sheet
            break;
        }
    }
    return speechOutput;
}
function participationAwarder(attributes, roster) {
    let slotobj = this.event.request.intent.slots;
    let speechOutput = 'Awarded';
    let sectionObj = roster[attributes.courseNumber][attributes.sectionNumber];
    let rosterList = Object.keys(sectionObj);
    let firstNames = slotobj.firstNames.value;
    let nameList = firstNames.split(' ');
    for (let i = 0; i < nameList.length; i++) {
        for (let j = 0; j < rosterList.length; j++) {
            if (nameList[i] === rosterList[j]) {
                sectionObj[rosterList[j]][Object.keys(sectionObj[rosterList[j]])[3]]++;
                // Need to integrate writing to sheets now for points
            }
        }
    }
    return speechOutput;
}



function writeToSheets(key, tabName, scheduleObj) {
    //TO DO: add first two rows for the headers and kinds
    let values = [];

    //this could be done recursively, but I'm going to use some conditionals and loops
    let keys = Object.keys(scheduleObj);
    keys.forEach(key => {
        let seckeys = Object.keys(scheduleObj[key]);
        if (typeof scheduleObj[key][seckeys[0]] === "object") {
            seckeys.forEach(seckey => {
                let tertkeys = Object.keys(scheduleObj[key][seckey]);
                if (typeof scheduleObj[key][seckey][tertkeys[0]] === "object") {
                    tertkeys.forEach(tertkey => {
                        let row = [key, seckey, tertkey];
                        row = row.concat(Object.keys(scheduleObj[key][seckey][tertkey]));
                        values.push(row);
                    });
                } else {
                    let row = [key, seckey];
                    row = row.concat(Object.values(scheduleObj[key][seckey]));
                    values.push(row);
                }
            });
        } else {
            let row = Object.values(scheduleObj[key]);
            values.push(row)
        }
    });
    googleSDK.writeTab(key, tabName, values);
}

const handlers = {
    'LaunchRequest': function () {
        const speechOutput = 'This is the Classroom Assistant skill.';
        this.response.speak(speechOutput).listen(speechOutput);
        this.emit(':responseReady');
    },

    //Required Intents
    'AMAZON.HelpIntent': function () {
        const speechOutput = 'This is the Classroom Assistant skill.';
        this.emit(':tell', speechOutput);
    },

    'AMAZON.CancelIntent': function () {
        this.attributes.lastIntent = null;
        const speechOutput = 'Goodbye!';
        this.emit(':tell', speechOutput);
    },

    'AMAZON.StopIntent': function () {
        this.attributes.lastIntent = null;
        const speechOutput = 'See you later!';
        this.emit(':tell', speechOutput);
    },

    'AMAZON.FallbackIntent': function () {
        let speechOutput = 'I did not understand that command.';
        this.response.speak(speechOutput).listen(speechOutput);
        this.emit(':responseReady');
    },

    'SessionEndedRequest': function () {
        this.attributes.lastIntent = null;
        this.emit(':saveState', true);
    },

    //Custom Intents
    'PlayBriefing': function () {
        initSheetID(this.attributes);
        this.attributes.lastIntent = 'PlayBriefing';

        //we may need to adjust the else if conditions depending on how we choose to set up/retrieve the briefings -> from google sheets? hardcoded for the demo?
        if (this.event.request.dialogState !== 'COMPLETED') {
            this.emit(':delegate');
        } else if (!this.attributes.briefingNotes.hasOwnProperty(this.event.request.intent.slots.courseNumber.value) ||
                   !this.event.request.intent.slots.courseNumber.value) {
            let speechOutput = "I'm sorry, I couldn't find that course number. For which course would you like me to play your briefing notes?";
            let slotToElicit = "courseNumber";
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
        } else if (!this.attributes.briefingNotes[this.event.request.intent.slots.courseNumber.value].hasOwnProperty(this.event.request.intent.slots.classDate.value) ||
                   !this.event.request.intent.slots.classDate.value) {
            let speechOutput = "I'm sorry, I couldn't find that class date. For which date would you like me to play your briefing notes?";
            let slotToElicit = "classDate";
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
        } else {
            let courseNumber = this.event.request.intent.slots.courseNumber.value;
            let classDate = this.event.request.intent.slots.classDate.value;
            let notesAccessed = this.attributes.briefingNotes[courseNumber][classDate];
            let speechOutput = "";
            if (notesAccessed.length == 1) {
                speechOutput = notesAccessed;
            } else {
                notesAccessed.forEach(note => {
                    speechOutput += '<break time = "1s"/>' + `Note ${notesAccessed.indexOf(note) + 1}: "${note}" `;
                });
                speechOutput += '<break time = "1s"/>' + " What else can I do for you today?"
            }
            this.response.speak(speechOutput);
            this.emit(':responseReady');
        }
    },

    'AddBriefingNote': function () {
        this.attributes.lastIntent = 'AddBriefingNote';

        if (this.event.request.dialogState !== 'COMPLETED') {
            this.emit(':delegate');
        } else if (!this.event.request.intent.slots.noteContent.value) {
            let speechOutput = "What briefing note would you like to add?";
            let slotToElicit = "noteContent";
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
        } else {
            console.log('*** noteContent: ' + this.event.request.intent.slots.noteContent.value);
            this.attributes.noteContent = this.event.request.intent.slots.noteContent.value;
            let speechOutput = "Which course number should I add this note to?";
            this.response.speak(speechOutput).listen(speechOutput);
            this.emit(':responseReady');
        }
    },

    'SpecifyCourseNumber': function () {
        const courseNumber = this.event.request.intent.slots.courseNumber.value;

        if (this.event.request.dialogState !== 'COMPLETED') {
            console.log('*** Trying to obtain courseNumber');
            this.emit(':delegate');
        } else if (this.attributes.lastIntent == 'AddBriefingNote') {
            if (this.attributes.briefingNotes.hasOwnProperty(courseNumber)) {
                console.log('*** Invalid courseNumber');
                let speechOutput = "I'm sorry, I can't find that course number. Which course number should I add this note to?";
                let slotToElicit = 'courseNumber';
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                console.log('*** I have the courseNumber: ' + courseNumber);
                this.attributes.courseNumber = courseNumber;

                let speechOutput = "And for which date should I add this note?";
                this.response.speak(speechOutput).listen("For which date should I add this note?");
                this.emit(':responseReady')
            }
        } else if (this.attributes.lastIntent == 'ParticipationTracker') {
            this.attributes.courseNumber = courseNumber;

            const speechOutput = `I have course ${courseNumber}. What section time?`;
            this.response.speak(speechOutput).listen(speechOutput);
            this.emit(':responseReady');
        } else {
            this.attributes.courseNumber = courseNumber;
            const speechOutput = `The course number has been set to ${courseNumber}. What can I do for you?`;
            this.response.speak(speechOutput).listen(speechOutput);
            this.emit(':responseReady');
        }
    },

    'SpecifyClassDate': function () {
        console.log('obtaining class date');
        if (this.event.request.dialogState !== 'COMPLETED') {
            this.emit(':delegate');
        } else if (!this.attributes.briefingNotes[this.attributes.courseNumber].hasOwnProperty(this.event.request.intent.slots.classDate.value)) {
            let speechOutput = "I'm sorry, I couldn't find that class date. For which date would you like me to this note?";
            let slotToElicit = "classDate";
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
        } else {
            this.attributes.date = this.event.request.intent.slots.classDate.value;
            this.attributes.briefingNotes[this.attributes.courseNumber][this.attributes.date].push(this.attributes.noteContent);
            let speechOutput = `Great, I've added your note for course <say-as interpret-as="spell-out">${this.attributes.courseNumber}</say-as> on ${this.attributes.date}. What else can I do for you today?`;
            this.response.speak(speechOutput).listen("If you'd like me to add another note or play a briefing for you, just let me know.");
            this.emit(':responseReady');
        }
    },
 /*
    'SpecifySectionTime': function() {
        this.attributes.lastIntent = 'SpecifySectionTime';

        if (this.event.request.dialogState !== 'COMPLETED') {
            this.emit(':delegate');
        } else if (slotobj.sectionTime.value) {
            let sectionTime = convertTimeStamp(slotobj.sectionTime.value);
            let sectionNumber;
            let timeDoesMatch = false;
            Object.values(scheduleObj[this.attributes.courseNumber]).forEach(sectionObj => {
                if (sectionObj[Object.keys(sectionObj)[1]] == sectionTime) {
                    sectionNumber = Object.keys(scheduleObj[this.attributes.courseNumber])[Object.values(scheduleObj[this.attributes.courseNumber]).indexOf(sectionObj)];
                    timeDoesMatch = true;
                }
            });
            if (timeDoesMatch) {
                this.attributes.sectionNumber - sectionNumber;
                this.response.speak(participationAwarder(this.attributes, rosterObj));
                this.emit(':responseReady');
            } else {
                let slotToElicit = 'sectionTime';
                let speechOutput = `I'm sorry I don't have that section time for course ${this.attributes.courseNumber}. For which section time?`;
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            }
        } else {
            getContext(this.attributes, checkSchedule(scheduleObj));
            this.response.speak(participationAwarder(this.attributes, rosterObj));
            this.emit(':responseReady');
        }
    },
   */

    'FastFacts': async function () {
        this.attributes.lastIntent = 'FastFacts';
        console.log("*** AnswerIntent Started");
        let allQuestions = {};
        let loadPromise = loadFromSheets();
        let auth = await loadPromise;
        let data = await getData(auth);
        console.log("Google Sheets Read - Success");
        let sheets = data.data.sheets;
        sheets.forEach(sheet => {
            allQuestions[sheet.properties.title] = {};
            //omit element 0 because it's the header row
            let rows = sheet.data[0].rowData.slice(1);
            rows.forEach(row => {
                if (row.values) {
                    if (row.values[0].effectiveValue && row.values[1].effectiveValue) {
                        allQuestions[sheet.properties.title][row.values[0].effectiveValue.stringValue] = row.values[1].effectiveValue.stringValue;
                    } else {
                        console.log("That row didn't have both a tag and an answer");
                    }
                } else {
                    console.log("Skipping empty row.");
                }
            });
        });

        console.log("Length of allQuestions: " + Object.keys(allQuestions).length);
        console.log(allQuestions["1111"]["Gettysburg"]);

        if (!this.event.request.intent.slots.tag.value || !this.event.request.intent.slots.courseNumber.value) {

            this.emit(':delegate');

        } else if (!allQuestions.hasOwnProperty(this.event.request.intent.slots.courseNumber.value)) {

            const slotToElicit = 'courseNumber';
            const speechOutput = "I'm sorry, we couldn't find any data for that course number. Try again";
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);

        } else if (!allQuestions[this.event.request.intent.slots.courseNumber.value].hasOwnProperty(this.event.request.intent.slots.tag.value)) {

            const slotToElicit = 'tag';
            const speechOutput = 'I\'m sorry, that tag doesn\'t currently exist. Could you provide another tag?';
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);

        } else {

            const tag = this.event.request.intent.slots.tag.value;
            const courseNumber = this.event.request.intent.slots.courseNumber.value;

            const speechOutput = allQuestions[courseNumber][tag];
            this.response.speak(speechOutput);
            this.emit(':responseReady');
        }
    },

    'ReadTags': function () {
        this.attributes.lastIntent = 'ReadTags';

        if (!this.event.request.intent.slots.courseNumber.value) {
            this.emit(':delegate');
        } else if (!allQuestions.hasOwnProperty(this.event.request.intent.slots.courseNumber.value)) {
            const slotToElicit = 'courseNumber';
            const speechOutput = "We couldn't find that course number. Please try again.";
            this.emit(':elicitiSlot', slotToElicit, speechOutput, speechOutput);
        } else {
            let speechOutput = '';
            const courseNumber = this.event.request.intent.slots.courseNumber.value;
            allQuestions[courseNumber].forEach(question => {
                speechOutput += (question.tag + ", ");
            });

            this.response.speak('Your current tags are: ' + speechOutput);
            this.emit(':responseReady');

        }
    },

    'GroupPresent': function () {
        this.attributes.lastIntent = 'GroupPresent';

        let presentList = [];

        // Searches existing presentation list for the student's name, returns true if name is not in list
        function findStudent(student) {
            for (let i = 0; i < presentList.length; i++) {
                if (presentList[i] === student) {
                    return false;
                }
            }
            return true;
        }

        let currentDialogState = this.event.request.dialogState;
        if (currentDialogState !== 'COMPLETED') {

            this.emit(':delegate');

        } else if (!this.attributes.courses.hasOwnProperty(this.event.request.intent.slots.courseNumber.value)) {

            const slotToElicit = 'courseNumber';
            const speechOutput = 'Please provide a valid course number.';
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);

        } else {

            const courseNumber = this.event.request.intent.slots.courseNumber.value;
            const groupNumber = parseInt(this.event.request.intent.slots.groupNumber.value);
            presentList = []; // reset presentList

            // Adds students in random order to presentation list if student is not already in list
            let j = 0;
            while (j < this.attributes.courses[courseNumber].length) {
                let randomIndex = Math.floor(Math.random() * this.attributes.courses[courseNumber].length);
                let randomStudent = this.attributes.courses[courseNumber][randomIndex];

                if (findStudent(randomStudent.name)) {
                    presentList.push(randomStudent.name);
                    j++;
                }
            }

            // Names all students randomly ordered, along with number for purpose of presentation order
            // Divides student names into groups based on groupNumber
            let k = 1;
            let speechOutput = '';
            if (groupNumber === 1) {
                for (let l = 0; l < presentList.length; l++) {
                    speechOutput += `${k}, ${presentList[l]}; `;
                    k++;
                }
            } else {
                let groups;
                let eachGroup = [];
                const groupList = [];

                if (this.attributes.courses[courseNumber].length % groupNumber === 0) {
                    groups = this.attributes.courses[courseNumber].length / groupNumber;
                } else {
                    groups = Math.floor(this.attributes.courses[courseNumber].length / groupNumber) + 1;
                }

                for (let l = 0; l < groups; l++) {
                    for (let m = 0; m < groupNumber; m++) {
                        if (presentList.length === 0) {
                            break;
                        }
                        eachGroup.push(presentList[0]);
                        presentList.shift();
                    }
                    groupList.push(eachGroup);
                    eachGroup = [];
                }

                for (let n = 0; n < groupList.length; n++) {
                    speechOutput += `group ${k}, ${groupList[n].toString()}; `;
                    k++;
                }
            }

            this.response.speak(speechOutput);
            this.emit(':responseReady');
        }
    },

    'ColdCall': async function () {

        this.attributes.lastIntent = 'ColdCall';
        let scheduleObj = await readSchedule();
        let rosterObj =  await readRoster();
        console.log(scheduleObj);
        console.log(rosterObj);
        let courseNumber = this.event.request.intent.slots.courseNumber.value;
        let sectionTime = this.event.request.intent.slots.sectionTime.value;

        if (courseNumber || sectionTime) {
            if (!courseNumber) {
                let slotToElicit = 'courseNumber';
                let speechOutput = "From which course would you like me to cold call?";
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!scheduleObj.hasOwnProperty(courseNumber)) {
                let slotToElicit = 'courseNumber';
                let speechOutput = "I'm sorry, I don't have that course number on record. From which course would you like me to cold call?";
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!sectionTime) {
                let slotToElicit = 'sectionTime';
                let speechOutput = "From which section time?";
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!isValidSectionTime(this.attributes, scheduleObj, courseNumber, sectionTime)) {
                let slotToElicit = 'sectionTime';
                let speechOutput = `I'm sorry, I don't have that section time on record for course ${courseNumber}. Which section time would you like me to cold call from?`;
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                console.log('*** valid course number and section number provided manually');
                this.attributes.courseNumber = courseNumber;
                this.response.speak(coldCallHelper(this.attributes, rosterObj));
                this.emit(':responseReady');
            }
        } else {
            getContext(this.attributes, checkSchedule(scheduleObj));
            if (checkSchedule(scheduleObj) == false) {
                console.log('*** not in a class');
                if (!this.attributes.courseNumber || !this.attributes.sectionNumber) {
                    console.log('*** nothing in the cache');
                    let slotToElicit = 'courseNumber';
                    let speechOutput = "For which course number?";
                    this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
                } else {
                    console.log('*** something in the cache');
                    coldCallHelper(this.attributes, rosterObj);
                    this.response.speak(coldCallHelper(this.attributes, rosterObj));
                    this.emit(':responseReady');
                }
            } else {
                console.log('*** we\'re in a class');
                coldCallHelper(this.attributes, rosterObj);
                this.response.speak(coldCallHelper(this.attributes, rosterObj));
                this.emit(':responseReady');
            }
        }
    },

    'QuizQuestion': async function () {
        this.attributes.lastIntent = 'QuizQuestion';

        let scheduleObj = await readSchedule();
        let questionObj = await readQuizQuestions();
        let slotObj = this.event.request.intent.slots;
        let courseNumber = slotObj.courseNumber.value;

        if (courseNumber) {
            if (!scheduleObj.hasOwnProperty(courseNumber)) {
                let slotToElicit = 'courseNumber';
                let speechOutput = "I'm sorry, I don't have that course number on record. From which course?";
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                this.attributes.courseNumber = courseNumber;
                if (courseObj[questionList][Object.keys(courseObj[questionList])[2]] === 'no') {
                    this.response.speak(randomQuizQuestion(this.attributes, questionObj));
                    this.emit(":responseReady");
                } else {
                    this.response.speak(orderedQuizQuestion(this.attributes, questionObj));
                    this.emit(":responseReady");
                }
            }
        } else {
                getContext(this.attributes, checkSchedule(scheduleObj));
                if (checkSchedule(scheduleObj) == false) {
                    if(!this.attributes.courseNumber) {
                        let slotToElicit = 'courseNumber';
                        let speechOutput = "For which course number?";
                        this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
                    } else {
                        if (courseObj[questionList][Object.keys(courseObj[questionList])[2]] === 'no') {
                            this.response.speak(randomQuizQuestion(this.attributes, questionObj));
                            this.emit(":responseReady");
                        } else {
                            this.response.speak(orderedQuizQuestion(this.attributes, questionObj));
                            this.emit(":responseReady");
                        }
                    }
                } else {
                    if (courseObj[questionList][Object.keys(courseObj[questionList])[2]] === 'no') {
                        this.response.speak(randomQuizQuestion(this.attributes, questionObj));
                        this.emit(":responseReady");
                    } else {
                        this.response.speak(orderedQuizQuestion(this.attributes, questionObj));
                        this.emit(":responseReady");
                    }
                }
            }
        },

    'ParticipationTracker': async function () {

        this.attributes.lastIntent = 'ParticipationTracker';
        let scheduleObj = await readSchedule();
        let rosterObj = await readRoster();
        let slotobj = this.event.request.intent.slots;
        let courseNumber = slotobj.courseNumber.value;
        let sectionTime = slotobj.sectionTime.value;

        if (courseNumber || sectionTime) {
            if (!courseNumber) {
                let slotToElicit = 'courseNumber';
                let speechOutput = "From which course would you like me to add points?";
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!scheduleObj.hasOwnProperty(courseNumber)) {
                let slotToElicit = 'courseNumber';
                let speechOutput = "I'm sorry, I don't have that course number on record. From which course would you like me to add points?";
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!sectionTime) {
                let slotToElicit = 'sectionTime';
                let speechOutput = "From which section time?";
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!isValidSectionTime(this.attributes, scheduleObj, courseNumber, sectionTime)) {
                let slotToElicit = 'sectionTime';
                let speechOutput = `I'm sorry, I don't have that section time on record for course ${courseNumber}. Which section time would you like?`;
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                console.log('*** valid course number and section number provided manually');
                this.attributes.courseNumber = courseNumber;
                this.response.speak(participationAwarder(this.attributes, rosterObj));
                this.emit(':responseReady');
            }
        } else {
            getContext(this.attributes, checkSchedule(scheduleObj));
            if (checkSchedule(scheduleObj) == false) {
                if (!this.attributes.courseNumber || !this.attributes.sectionNumber) {
                    let slotToElicit = 'courseNumber';
                    let speechOutput = "For which course number?";
                    this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
                } else {
                    participationAwarder(this.attributes, rosterObj);
                    this.response.speak(participationAwarder(this.attributes, rosterObj));
                    this.emit(':responseReady');
                }
            } else {
                participationAwarder(this.attributes, rosterObj);
                this.response.speak(participationAwarder(this.attributes, rosterObj));
                this.emit(':responseReady');
            }
        }
    },

    'RepeatIntent': function () {
        this.emitWithState(this.attributes.lastIntent);
    }
};
