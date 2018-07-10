    // This is the master skill for all Alexa Skills
'use strict';

const Alexa = require("alexa-sdk");
const AWS = require("aws-sdk");
AWS.config.update({region: 'us-east-1'});


const initializeCourses = (attributes) => {
    console.log("We're in initializeCourses");
    if (!attributes.hasOwnProperty('courses')) {
        console.log('making a courses attribute');
        attributes.courses = {
            "1111": [
                {name: "Ryan", beenCalled: 0},
                {name: "Will", beenCalled: 0},
                {name: "Andy", beenCalled: 0},
                {name: "Daewoo", beenCalled: 0},
                {name: "Jamie", beenCalled: 0},
                {name: "Rebecca", beenCalled: 0},
                {name: "Professor Wyner", beenCalled: 0}
            ]
        }
    }
};


const initializeQuestions = (attributes) => {
    console.log("We're in initializeQuestions");
    if (!attributes.hasOwnProperty('allQuestions')) {
        console.log('making an allQuestions attribute');
        attributes.allQuestions = {
            "1111": [
                {question: "This is sample question 1 from course 1111", beenCalled: 0},
                {question: "This is sample question 2 from course 1111", beenCalled: 0},
                {question: "This is sample question 3 from course 1111", beenCalled: 0}
            ],
            "2222": [
                {question: "This is sample question 1 from course 2222", beenCalled: 0},
                {question: "This is sample question 2 from course 2222", beenCalled: 0},
                {question: "This is sample question 3 from course 2222", beenCalled: 0}
            ]
        }
    }
};



exports.handler = function (event, context, callback) {
    const alexa = Alexa.handler(event, context, callback);
    alexa.dynamoDBTableName = "ClassroomAssistant";
    alexa.registerHandlers(handlers);
    alexa.execute();

};
const fs = require('fs');
const util = require("util");
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete credentials.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'credentials.json';

const readFile = util.promisify(fs.readFile);

async function loadFromSheets() {
// Load client secrets from a local file.
    let p = readFile('client_secret.json');
    let res = await p;
    let pAuth = authorize(JSON.parse(res));
    return pAuth;
}
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
function getData(auth) {
    const sheets = google.sheets({version: 'v4', auth});

    let readDataParams = {
        spreadsheetId: '1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0',
        //range: sheetName,
        includeGridData: true
    };

    let p = sheets.spreadsheets.get(readDataParams);
    return p;
}
function initializeBriefingNotes(attributes) {
    if (attributes.briefingNotes == undefined) {
        attributes.briefingNotes = {
            "1111": {
                "2018-07-02": ["Hello. My name is Alexa and I will be your new class TA. We are in course 1111 and today is July 2nd. In today's lesson, we plan to demonstrate a couple of features" +
                "such as cold call, quiz questions, forming groups, and bonus points in a mock classroom environment. We hope to provide a realistic portrayal of Alexa's functionality and role in a classroom."],
                "2018-07-03": ["Hello. My name is Alexa and I will be your new class TA. We are in course 1111 and today is July 3rd. In today's lesson, we plan to demonstrate a couple of features" +
                "such as cold call, quiz questions, forming groups, and bonus points in a mock classroom environment. We hope to provide a realistic portrayal of Alexa's functionality and role in a classroom."],
                "2018-07-04": ["We are in course 1111 and today is July 4th"]
            },
            "2222": {
                "2018-11-01": ["We are in course 2222 and today is November 1st"],
                "2018-11-02": ["We are in course 2222 and today is November 2nd"],
                "2018-11-03": ["We are in course 2222 and today is November 3rd"]
            }
        }
    }
}
function search(list, target) {
    if (list.length == 0) return false;
    if (list[0] == target) return true;
    return search(list.splice(1), target);
}

function getNames(students) {
    let names = [];
    students.forEach(student => names.push(student.name));
    return names;
}

function randomQuizQuestion(questionList) {
    let randomIndex = Math.floor(Math.random() * questionList.length);
    let randomQuestion = questionList[randomIndex];
    const beenCalledList = [];
    questionList.forEach(question => beenCalledList.push(question.beenCalled));
    const minim = Math.min(...beenCalledList);
    if (randomQuestion.beenCalled !== minim) {
        return randomQuizQuestion(questionList);
    } else {
        return randomQuestion;
    }
}

function orderedQuizQuestion(questionList) {
    let questionToAsk = questionList.shift();
    questionList.push(questionToAsk);
    return questionToAsk;
}

function initializesessionID(attributes) {
    if (!attributes.sessionID) {
        attributes.sessionID = 0;
    }
}

function idDoesMatch(oldID, newID) {
    if (oldID == undefined) {
        return true;
    }
    return oldID == newID;
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
        const speechOutput = 'Goodbye!';
        this.attributes.oldID = this.attributes.sessionID;
        this.emit(':tell', speechOutput);
    },

    'AMAZON.StopIntent': function () {
        const speechOutput = 'See you later!';
        this.attributes.oldID = this.attributes.sessionID;
        this.emit(':tell', speechOutput);
    },

    'AMAZON.FallbackIntent': function () {
        let speechOutput = 'I did not understand that command.';
        this.response.speak(speechOutput).listen(speechOutput);
        this.emit(':responseReady');
    },

    'SessionEndedRequest': function () {
        console.log('***session ended***');
        this.attributes.oldID = this.attributes.sessionID;
        this.emit(':saveState', true);
    },

    //Custom Intents
    'PlayBriefing': function () {
        initializeBriefingNotes(this.attributes);
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
        initializeBriefingNotes(this.attributes);
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
        console.log('*** SpecifyCourseNumber');
        if (this.event.request.dialogState !== 'COMPLETED') {
            console.log('*** Trying to obtain courseNumber');
            this.emit(':delegate');
        } else if (!this.attributes.briefingNotes.hasOwnProperty(this.event.request.intent.slots.courseNumber.value)) {
            console.log('*** Invalid courseNumber');
            let speechOutput = "I'm sorry, I can't find that course number. Which course number should I add this note to?";
            let slotToElicit = 'courseNumber';
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
        } else {
            console.log('*** I have the courseNumber: ' + this.event.request.intent.slots.courseNumber.value);
            this.attributes.courseNumber = this.event.request.intent.slots.courseNumber.value;
            let speechOutput = "And for which date should I add this note?";
            this.response.speak(speechOutput).listen("For which date should I add this note?");
            this.emit(':responseReady')
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

    'AnswerIntent': async function () {
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

        if (!this.event.request.intent.slots.courseNumber.value) {
            this.emit(':delegate');
        } else if (!allQuestions.hasOwnProperty(this.event.request.intent.slots.courseNumber.value)) {
            const slotToElicit = 'courseNumber';
            const speechOutput = "We couldn't find that course number. Please try agian.";
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

        initializeCourses(this.attributes);
        // presentList used throughout so declare here so in scope for
        // both findStudent and main code
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

    'ColdCall': function () {

        initializeCourses(this.attributes);

        if (this.event.request.dialogState !== "COMPLETED") {

            this.emit(':delegate');

        } else if (!this.attributes.courses.hasOwnProperty(this.event.request.intent.slots.courseNumber.value)) {

            let slotToElicit = 'courseNumber';
            let speechOutput = "I'm sorry, I don't have that course number on record. For which course would you like me to cold call from?";
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);

        } else {

            const courseNumber = this.event.request.intent.slots.courseNumber.value;
            this.attributes.courseNumber = courseNumber;
            const beenCalledList = [];
            this.attributes.courses[courseNumber].forEach(student => beenCalledList.push(student.beenCalled));
            const minim = Math.min(...beenCalledList);
            let loop = true;
            while (loop) {
                let randomIndex = Math.floor(Math.random() * this.attributes.courses[courseNumber].length);
                let randomStudent = this.attributes.courses[courseNumber][randomIndex];
                if (randomStudent.beenCalled === minim) {
                    const speechOutput = randomStudent.name;
                    randomStudent.beenCalled++;
                    this.attributes.courses[courseNumber].forEach(student => console.log(`name: ${student.name}, beenCalled: ${student.beenCalled}`));
                    loop = false;
                    this.response.speak(speechOutput);
                    this.emit(':responseReady');
                }
            }
        }
    },

    'QuizQuestion': function () {
        console.log("**** Quiz Question Intent Started");
        initializeQuestions(this.attributes);
        let slotObj = this.event.request.intent.slots;
        let currentDialogState = this.event.request.dialogState;
        console.log("**** Dialog State: " + currentDialogState);

        if (currentDialogState !== 'COMPLETED') {
            this.emit(':delegate');

        } else if (!this.attributes.allQuestions.hasOwnProperty(slotObj.questionSet.value)) {
            console.log("**** Getting a valid question set");
            const slotToElicit = 'questionSet';
            const speechOutput = 'Please provide a valid questionSet.';
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);

        } else {
            this.attributes.questionSet = slotObj.questionSet.value;
            this.attributes.question = orderedQuizQuestion(this.attributes.allQuestions[this.attributes.questionSet]);
            console.log("**** Question: " + this.attributes.question.question);
            this.response.speak(this.attributes.question.question);
            this.attributes.question.beenCalled++;
            this.emit(":responseReady");
        }
    },

    'BonusPoints': function () {
        initializeCourses(this.attributes);
        let currentDialogState = this.event.request.dialogState;
        console.log("**** Dialog State: " + currentDialogState);
        const slotsObj = this.event.request.intent.slots;

        if (currentDialogState !== 'COMPLETED') {
            this.emit(':delegate');

        } else if (!this.attributes.courses.hasOwnProperty(slotsObj.CourseNumber.value)) {
            let slotToElicit = 'CourseNumber';
            let speechOutput = "I'm sorry, I don't recognize that ";
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);

        } else if (getNames(this.attributes.courses[slotsObj.CourseNumber.value]).indexOf(slotsObj.Student.value) == -1) {
            let slotToElicit = 'Student';
            let speechOutput = "I'm sorry, I don't recognize that student name. For which student should I add points?";
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);

        } else {
            const courseNumber = slotsObj.CourseNumber.value;
            const student = slotsObj.Student.value;
            const index = getNames(this.attributes.courses[courseNumber]).indexOf(student);

            // initialize points if needed
            if (!this.attributes.courses[courseNumber][index].hasOwnProperty("points")) {
                this.attributes.courses[courseNumber][index].points = 0;
            }
            if (slotsObj.Points.value) {
                this.attributes.courses[courseNumber][index].points += slotsObj.Points.value;
                this.response.speak(slotsObj.Points.value.toString() + " points have been assigned to " + student);
            } else {
                this.attributes.courses[courseNumber][index].points++;
                this.response.speak("A point has been assigned to " + student);
            }

            this.emit(":responseReady");
        }
    }
};
