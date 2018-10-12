/* Alexa Classroom Assistant Master Skill */

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

async function initSheetID(attributes, session) {
    let currentUserId = session.user.userId;
    console.log(`*** userId: ${currentUserId}`);
    let profData = {
        sterpe: {
            userId: "amzn1.ask.account.AGN3GNHPLVSKB7LWETPV3CWYTL3DQCLQ4BWYG2OJEEA3T4EWWEJWINZGQN7G2EVWNPWSW2EK3GLU3EMJ464UWZ54YNBVI5NVK4UXGYKOVXJGAHILE4Z3234O2JN5M4XBUI7M4WFNMOBQUO7G7MUWZRJIOP6CJPYDGLTJ6EPTXGBZ43D6EFKHH3AUMKFXTMSQKOHZEHR6AUOJX3Y",
            sheetId: "1f_zgHHi8ZbS6j0WsIQpbkcpvhNamT2V48GuLc0odyJ0"
        },
        simonelli: {
            userId: "amzn1.ask.account.AFUZ7MBOG33QL6E53OKL62XCL5YBKRVFBOW62QPROKIKYKUJYB2DHRNOAJZVJCXKT2G356QAJC4ZM5WEXAD2FTC54DBNSFVNTDHN4SYCXROGWVSC4HKNMYPYRUXSXYQINRVFLHVTFCYVVKZZ2TWSXIW7KOACENDEM5EMN3MYEUANKFB5KVYNH4UK3K7Q7HNY2SBWZJ4WNXUIYNA",
            sheetId: "1xrEPVosoj5kmQdwy7Ddtn7q0YsTsEEmO_HJHCKyujqg"
        }
    };
    if (!attributes.spreadsheetID || attributes.spreadsheetID == "No professor data on record.") {
        let profs = Object.keys(profData);
        for (let i = 0; i < profs.length; i++) {
            if (profData[profs[i]].userId == currentUserId) {
                attributes.spreadsheetID = profData[profs[i]].sheetId;
                return true;
            }
        }
        attributes.spreadsheetID = "No professor data on record.";
        return false;
    }
    return true;
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
    let timeStamp = convertTimeStamp(getCurrentTime());
    let courseNumbers = Object.keys(scheduleObj);
    let gracePeriod = 300/(3600 * 24);

    for (let i = 0; i < courseNumbers.length; i++) {
        let sectionNumbers = Object.keys(scheduleObj[courseNumbers[i]]);
        for (let j = 0; j < sectionNumbers.length; j++) {
            let dayDoesMatch = false;
            let timeDoesMatch = false;
            let sectionObj = scheduleObj[courseNumbers[i]][sectionNumbers[j]];
            let DOWList = sectionObj['DayOfWeek'].split('');
            let start = sectionObj['Start'];
            let end = sectionObj['End'];

            DOWList.forEach(day => {
                if (day == dayOfWeek) {
                    dayDoesMatch = true;
                }
            });
            if (timeStamp >= (start - gracePeriod) && timeStamp <= (end + gracePeriod)) {
                timeDoesMatch = true;
            }
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
    return currentDay;
}

function getCurrentTime() {
    let currentTime = new Date(Date.now()).toLocaleTimeString('en-US', {timeZone: 'America/New_York', hour12: false});
    return currentTime;
}

// inSchedule is only one section object, with the section number as a key located at the 0th index of Object.keys(inSchedule)
function getContext(attributes, inSchedule) {
    if (inSchedule) {
        let sectionNumber = Object.keys(inSchedule)[0];
        let sectionObj = inSchedule[sectionNumber];
        attributes.courseNumber = sectionNumber.substr(0, 4);
        attributes.sectionNumber = sectionNumber;
        attributes.expiration = sectionObj['End'] + sectionObj.gracePeriod;
    }
}

function isValidSectionTime(attributes, schedule, courseNumberSlot, sectionTimeSlot) {
    let sectionTime = convertTimeStamp(sectionTimeSlot);
    let timeDoesMatch = false;
    Object.values(schedule[courseNumberSlot]).forEach(sectionObj => {
        if (sectionObj['Start'] == sectionTime) {
            attributes.sectionNumber = Object.keys(schedule[courseNumberSlot])[Object.values(schedule[courseNumberSlot]).indexOf(sectionObj)];
            timeDoesMatch = true;
        }
    });
    return timeDoesMatch;
}

function getInvalidNameList(attributes, names) {
    let roster = attributes.rosterObj;
    let courseNumber = attributes.courseNumber;
    let sectionObj = roster[courseNumber][attributes.sectionNumber];
    let nameList = names.split(' ');
    let rosterList = Object.keys(sectionObj);
    let invalidNames = [];

    nameList.forEach(name => {
        if (rosterList.indexOf(name) === -1) {
            invalidNames.push(name);
        }
    });
    return invalidNames;
}

async function readSchedule(spreadsheetID) {
    let scheduleObj = await googleSDK.readTab(spreadsheetID, "Schedule");
    return scheduleObj;
}

async function readRoster(spreadsheetID) {
    let readObj = await googleSDK.readTab(spreadsheetID, "Roster");
    return readObj;
}

async function readQuizQuestions(spreadsheetID) {
    let questionsObj = await googleSDK.readTab(spreadsheetID, "QuizQuestions");
    return questionsObj;
}

async function readFastFacts(spreadsheetID) {
    let factsObj = await googleSDK.readTab(spreadsheetID, "FastFacts");
    return factsObj;
}

async function readBriefing(spreadsheetID) {
    let briefingObj = await googleSDK.readTab(spreadsheetID, "ClassroomBriefing");
    return briefingObj;
}

function fastFactsHelper(attributes, facts, tag) {
    return facts[attributes.courseNumber][tag]['Answer'];
}

function coldCallHelper(attributes, roster) {
    const beenCalledList = [];
    let speechOutput;
    let sectionObj = roster[attributes.courseNumber][attributes.sectionNumber];
    let rosterList = Object.keys(sectionObj);
    rosterList.forEach(student => beenCalledList.push(sectionObj[student]['BeenCalled']));
    const minim = Math.min(...beenCalledList);
    while (true) {
        let randomIndex = Math.floor(Math.random() * rosterList.length);
        let randomStudent = rosterList[randomIndex];
        if (sectionObj[randomStudent]['BeenCalled'] === minim) {
            speechOutput = randomStudent;
            sectionObj[randomStudent]['BeenCalled']++;
            break;
        }
    }
    return speechOutput;
}

function orderedQuizQuestion(attributes, quizQuestions) {
    let courseObj = quizQuestions[attributes.courseNumber];
    if (!attributes.questionSets) {
        attributes.questionSets = {};
        attributes.questionSets[attributes.courseNumber] = {};
        attributes.questionSets[attributes.courseNumber].currentQuestionNumber = 0;
    } else if (!attributes.questionSets[attributes.courseNumber]) {
        attributes.questionSets[attributes.courseNumber] = {};
        attributes.questionSets[attributes.courseNumber].currentQuestionNumber = 0;
    }
    attributes.questionSets[attributes.courseNumber].currentQuestionNumber++;
    if (courseObj[attributes.questionSets[attributes.courseNumber].currentQuestionNumber.toString()] == undefined) {
        attributes.questionSets[attributes.courseNumber].currentQuestionNumber = 1;
    }
    return courseObj[attributes.questionSets[attributes.courseNumber].currentQuestionNumber]['Question'];
}

function playBriefingHelper(attributes, notes) {
    let notesAccessed = notes[attributes.courseNumber][attributes.classDate]['Note'].split(" | ");
    let speechOutput = '';
    if (notesAccessed.length == 1) {
        speechOutput = notesAccessed;
    } else {
        notesAccessed.forEach(note => {
            speechOutput += '<break time = "1s"/>' + `Note ${notesAccessed.indexOf(note) + 1}: ${note} `;
        });
    }
    return speechOutput;
}

function groupPresentHelper(attributes, roster, groupString) {
    let groupCount = parseInt(groupString);
    let presentList = [];
    let students = Object.keys(roster[attributes.courseNumber][attributes.sectionNumber]);

    // Searches existing presentation list for the student's name, returns true if name is not in list
    function studentNotInList(student, presenters) {
        for (let i = 0; i < presenters.length; i++) {
            if (presenters[i] === student) {
                return false;
            }
        }
        return true;
    }
    // Adds students in random order to presentation list if student is not already in list
    let j = 0;
    while (j < students.length) {
        let randomIndex = Math.floor(Math.random() * students.length);
        let randomStudent = students[randomIndex];
        if (studentNotInList(randomStudent, presentList)) {
            presentList.push(randomStudent);
            j++;
        }
    }
    // Names all students randomly ordered, along with number for purpose of presentation order
    // Divides student names into groups based on groupNumber
    let k = 1;
    let returnObj = {};
    let groups;
    let eachGroup = [];
    const groupList = [];

    if (students.length % groupCount === 0) {
        groups = students.length / groupCount;
    } else {
        groups = Math.floor(students.length / groupCount) + 1;
    }
    for (let l = 0; l < groups; l++) {
        for (let m = 0; m < groupCount; m++) {
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
        returnObj[k.toString()] = groupList[n];
        k++;
    }
    return returnObj;
}

function readTagsHelper(attributes, facts) {
    let speechOutput = '';
    let allTags = Object.keys(facts[attributes.courseNumber]);
    allTags.forEach(tag => {
        if (allTags.indexOf(tag) == allTags.length - 1) {
            speechOutput += tag;
        } else {
            speechOutput += (tag + ", ");
        }
    });
    return speechOutput;
}

function nullifyObjects(attributes) {
    attributes.scheduleObj = null;
    attributes.rosterObj = null;
    attributes.briefingObj = null;
    attributes.factsObj = null;
    attributes.questionsObj = null;
}

async function initializeObjects(context, intentObj) {
    let setUp = await initSheetID(context.attributes, context.event.session);
    if (!setUp) {
        return false;
    }
    let readFunctions = {
        'scheduleObj': readSchedule,
        'rosterObj': readRoster,
        'briefingObj': readBriefing,
        'questionsObj': readQuizQuestions,
        'factsObj': readFastFacts
    };
    if ((context.attributes.scheduleObj == null || context.attributes[intentObj] == null) && readFunctions[intentObj]) {
        context.attributes.scheduleObj = await readSchedule(context.attributes.spreadsheetID);
        context.attributes[intentObj] =  await readFunctions[intentObj](context.attributes.spreadsheetID);
    }
    return true;
}

function generateGoodbye() {
    const allOutputs = [
            'See you next time.',
            'See you later.',
            'Till next time.',
            'Have a nice day.',
            'Goodbye.',
            'May the force be with you.',
            'Bye for now.',
            'Take care.',
            'Talk to you later.'
        ];
        return allOutputs[Math.floor(Math.random() * allOutputs.length)];
}

const handlers = {
    'LaunchRequest': function () {
        this.attributes.lastIntent = 'LaunchRequest';
        const allOutputs = [
            'Hello, and welcome to your classroom assistant skill. What can I do for you?',
            'This is your classroom assistant. How can I help you today?',
            'Greetings from your classroom assistant. How may I assist you?'
        ];
        const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
        this.attributes.lastOutput = speechOutput;
        this.response.speak(speechOutput).listen(speechOutput);
        this.emit(':responseReady');
    },

    'AMAZON.HelpIntent': function () {
        let helpOutputs = {
            'LaunchRequest': "You have opened the classroom assistant skill. Please say another command to continue.",
            'AMAZON.FallbackIntent': "If you're having trouble finding the right command, please consult the user documentation. Otherwise, it's possible that I'm just not hearing you properly.",
            'PlayBriefing': "If you'd like to hear one of your saved notes, just say something like, 'play my note'.",
            'AddBriefingNote': "If you'd like me to add a briefing note, just say something like, 'add a note'.",
            'FastFacts': "If you'd like me to recite one of your fast facts, just say something like, 'talk about', and then the name of your tag. If you would like to hear a list of your tags, please say, 'read off my tags.'",
            'ReadTags': "If you'd like me to read off your tags for the Fast Facts skill, just say something like, 'read off my tags'.",
            'ColdCall': "If you'd like me to call on a random student from the class, just say something like, 'call on a student'.",
            'GroupPresent': "If you'd like me to randomly assign student groups, just say something like, 'make groups'.",
            'QuizQuestion': "If you'd like to hear a question from your list of questions, just say something like, 'ask a question.'"
        };
        let speechOutput;
        if (!this.attributes.lastIntent) {
            speechOutput = helpOutputs['LaunchRequest'];
        } else {
            speechOutput = helpOutputs[this.attributes.lastIntent];
        }
        this.attributes.lastIntent = 'AMAZON.FallbackIntent';
        this.response.speak(speechOutput).listen('What can I help you with?');
        this.emit(':responseReady');
    },

    'AMAZON.CancelIntent': function () {
        this.response.speak(generateGoodbye());
        nullifyObjects(this.attributes);
        this.emit(':responseReady');
    },

    'AMAZON.StopIntent': function () {
        this.response.speak(generateGoodbye());
        nullifyObjects(this.attributes);
        this.emit(':responseReady');
    },

    'AMAZON.FallbackIntent': function () {
        this.attributes.lastIntent = 'AMAZON.FallbackIntent';
        let speechOutput = "Sorry, I didn't understand that command. Say the word [help] if you're having trouble.";
        this.response.speak(speechOutput).listen(speechOutput);
        nullifyObjects(this.attributes);
        this.emit(':responseReady');
    },

    'SessionEndedRequest': function () {
        nullifyObjects(this.attributes);
        this.emit(':saveState', true);
    },

    'PlayBriefing': async function () {
        this.attributes.lastIntent = 'PlayBriefing';
        let initialized = await initializeObjects(this, 'briefingObj');
        if (!initialized) {
            this.response.speak("Please wait for your administrator to set up Google Sheets access.");
            this.emit(':responseReady');
        }

        let briefingObj = this.attributes.briefingObj;
        let scheduleObj = this.attributes.scheduleObj;
        let courseNumber = this.event.request.intent.slots.courseNumber.value;
        let classDate = this.event.request.intent.slots.classDate.value;

        if (courseNumber) {
            if (!briefingObj.hasOwnProperty(courseNumber)) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    `I'm sorry, I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                    `Looks like I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which course number would you like?`,
                    `I'm sorry, course <say-as interpret-as="spell-out">${courseNumber}</say-as> doesn't seem to exist. Which course number would you like??`
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!classDate) {
                let slotToElicit = 'classDate';
                const allOutputs = [
                    'For which date?',
                    'Which date would you like?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!briefingObj[courseNumber].hasOwnProperty(classDate)) {
                let slotToElicit = 'classDate';
                const allOutputs = [
                    `I'm sorry, I don't have ${classDate} on record for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which date would you like?`,
                    `Looks like I don't have ${classDate} for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which date would you like?`,
                    `I'm sorry, ${classDate} doesn't seem to exist in the record for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which date would you like?`
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (briefingObj[courseNumber][classDate]['Note'] == ' ') {
                let slotToElicit = 'classDate';
                const allOutputs = [
                    `I'm sorry, I don't have any notes for ${classDate}. Which date would you like?`,
                    `Looks like there aren't any notes stored for ${classDate}. Which date would you like?`,
                    `I just checked ${classDate} and there aren't any notes. Which date would you like?`
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                this.attributes.courseNumber = courseNumber;
                this.attributes.classDate = classDate;
                let speechOutput = playBriefingHelper(this.attributes, briefingObj);
                this.attributes.lastOutput = speechOutput;
                this.response.speak(speechOutput);
                nullifyObjects(this.attributes);
                this.emit(':responseReady');
            }
        } else {
            let sectionObj = checkSchedule(scheduleObj);
            getContext(this.attributes, sectionObj);
            if (!sectionObj) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    'For which course number?',
                    'What is the course number?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput)
            } else if (!classDate){
                let slotToElicit = 'classDate';
                const allOutputs = [
                    'For which date?',
                    'Which date would you like?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!briefingObj[this.attributes.courseNumber].hasOwnProperty(classDate)) {
                let slotToElicit = 'classDate';
                const allOutputs = [
                    `I'm sorry, I don't have ${classDate} on record for course <say-as interpret-as="spell-out">${this.attributes.courseNumber}</say-as>. Which date would you like?`,
                    `Looks like I don't have ${classDate} for course <say-as interpret-as="spell-out">${this.attributes.courseNumber}</say-as>. Which date would you like?`,
                    `I'm sorry, ${classDate} doesn't seem to exist in the record for course <say-as interpret-as="spell-out">${this.attributes.courseNumber}</say-as>. Which date would you like?`
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (briefingObj[this.attributes.courseNumber][classDate]['Note'] == ' ') {
                let slotToElicit = 'classDate';
                const allOutputs = [
                    `I'm sorry, I don't have any notes for ${classDate}. Which date would you like?`,
                    `Looks like there aren't any notes stored for ${classDate}. Which date would you like?`,
                    `I just checked ${classDate} and there aren't any notes. Which date would you like?`
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                this.attributes.classDate = classDate;
                const speechOutput = playBriefingHelper(this.attributes, briefingObj);
                this.attributes.lastOutput = speechOutput;
                this.response.speak(speechOutput);
                nullifyObjects(this.attributes);
                this.emit(':responseReady');
            }
        }
    },

    'AddBriefingNote': async function () {
        this.attributes.lastIntent = 'AddBriefingNote';
        let initialized = await initializeObjects(this, 'briefingObj');
        if (!initialized) {
            this.response.speak("Please wait for your administrator to set up Google Sheets access.");
            this.emit(':responseReady');
        }
        let briefingObj = this.attributes.briefingObj;
        let courseNumber = this.event.request.intent.slots.courseNumber.value;
        let classDate = this.event.request.intent.slots.classDate.value;
        let noteContent = this.event.request.intent.slots.noteContent.value;

        if (!courseNumber) {
            let slotToElicit = 'courseNumber';
            const allOutputs = [
                'For which course number?',
                'What is the course number?'
            ];
            const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
        } else if (!briefingObj.hasOwnProperty(courseNumber)) {
            let slotToElicit = 'courseNumber';
            const allOutputs = [
                `I'm sorry, I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                `Looks like I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which course number would you like?`,
                `I'm sorry, course <say-as interpret-as="spell-out">${courseNumber}</say-as> doesn't seem to exist. Which course number would you like?`
            ];
            let speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
        } else if (!classDate) {
            let slotToElicit = 'classDate';
            const allOutputs = [
                'For which date?',
                'Which date would you like?',
            ];
            const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
        } else if (!briefingObj[courseNumber].hasOwnProperty(classDate)) {
            let slotToElicit = 'classDate';
            const allOutputs = [
                `I'm sorry, I don't have ${classDate} on record for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which date would you like?`,
                `Looks like I don't have ${classDate} for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which date would you like?`,
                `I'm sorry, ${classDate} doesn't seem to exist for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which date would you like?`
            ];
            const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
        } else if(!noteContent) {
            let slotToElicit = "noteContent";
            const allOutputs = [
                'What note would you like to add?',
                'What should the note say?',
                'What is the note you\'re adding?'
            ];
            const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
            this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
        } else {
            this.attributes.courseNumber = courseNumber;
            this.attributes.classDate = classDate;
            this.attributes.noteContent = noteContent;
            let speechOutput = `I've added your note for course <say-as interpret-as="spell-out">${this.attributes.courseNumber}</say-as> on ${this.attributes.classDate}.`;
            this.attributes.lastOutput = speechOutput;
            if (this.attributes.briefingObj[this.attributes.courseNumber][this.attributes.classDate]["Note"] != ' ') {
                noteContent = " | " + noteContent;
            } else {
                this.attributes.briefingObj[this.attributes.courseNumber][this.attributes.classDate]["Note"] = '';
            }
            // writing
            let keys = {
                CourseNumber: this.attributes.courseNumber,
                Date: this.attributes.classDate
            };
            let values = {
                Note: this.attributes.briefingObj[this.attributes.courseNumber][this.attributes.classDate]["Note"] + noteContent
            };
            googleSDK.writeTab(this.attributes.spreadsheetID, "ClassroomBriefing", keys, values);
            this.response.speak(speechOutput);
            nullifyObjects(this.attributes);
            this.emit(':responseReady');
        }
    },

    'FastFacts': async function () {
        this.attributes.lastIntent = 'FastFacts';
        let initialized = await initializeObjects(this, 'factsObj');

        if (!initialized) {
            this.response.speak("Please wait for your administrator to set up Google Sheets access.");
            this.emit(':responseReady');
        }
        let scheduleObj = this.attributes.scheduleObj;
        let factsObj =  this.attributes.factsObj;
        let courseNumber = this.event.request.intent.slots.courseNumber.value;
        let tag = this.event.request.intent.slots.tag.value;

        if (courseNumber) {
            if (!scheduleObj.hasOwnProperty(courseNumber)) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    `I'm sorry, I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                    `Looks like I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                    `I'm sorry, course <say-as interpret-as="spell-out">${courseNumber}</say-as> doesn't seem to exist. Which course number would you like?`
                ];
                let speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!tag) {
                let slotToElicit = 'tag';
                const allOutputs = [
                    'What should I talk about?',
                    'What would you like me to discuss?',
                    'What can I tell you about?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!factsObj[courseNumber][tag.toLowerCase()]) {
                if (tag.toLowerCase() == 'cancel' || tag.toLowerCase() == 'stop' ||
                    tag.toLowerCase() == 'alexa stop' || tag.toLowerCase() == 'alexa cancel') {
                    this.emitWithState('AMAZON.CancelIntent');
                } else {
                    let slotToElicit = 'tag';
                    const allOutputs = [
                        `I'm sorry, I don't have the tag ${tag} on record for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which tag would you like?`,
                        `Looks like I don't have the tag ${tag} for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which tag would you like?`,
                        `I'm sorry, the tag ${tag} doesn't seem to exist for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which tag would you like?`
                    ];
                    const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                    this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
                }
            } else {
                this.attributes.courseNumber = courseNumber;
                let speechOutput = fastFactsHelper(this.attributes, factsObj, tag.toLowerCase());
                this.attributes.lastOutput = speechOutput;
                this.response.speak(speechOutput);
                nullifyObjects(this.attributes);
                this.emit(":responseReady");
            }
        } else {
            getContext(this.attributes, checkSchedule(scheduleObj));
            if (!checkSchedule(scheduleObj)) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    'For which course number?',
                    'What is the course number?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!tag) {
                let slotToElicit = 'tag';
                const allOutputs = [
                    'What should I talk about?',
                    'What would you like me to discuss?',
                    'What can I tell you about?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!factsObj[this.attributes.courseNumber].hasOwnProperty(tag.toLowerCase())) {
                if (tag.toLowerCase() == 'cancel' || tag.toLowerCase() == 'stop' ||
                    tag.toLowerCase() == 'alexa stop' || tag.toLowerCase() == 'alexa cancel') {
                    this.emitWithState('AMAZON.CancelIntent');
                } else {
                    let slotToElicit = 'tag';
                    const allOutputs = [
                        `I'm sorry, I don't have the tag ${tag} on record for course <say-as interpret-as="spell-out">${this.attributes.courseNumber}</say-as>. Which tag would you like?`,
                        `Looks like I don't have the tag ${tag} for course <say-as interpret-as="spell-out">${this.attributes.courseNumber}</say-as>. Which tag would you like?`,
                        `I'm sorry, the tag ${tag} doesn't seem to exist for course <say-as interpret-as="spell-out">${this.attributes.courseNumber}</say-as>. Which tag would you like?`
                    ];
                    const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                    this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
                }
            } else {
                let speechOutput = fastFactsHelper(this.attributes, factsObj, tag.toLowerCase());
                this.attributes.lastOutput = speechOutput;
                this.response.speak(speechOutput);
                nullifyObjects(this.attributes);
                this.emit(":responseReady");
            }
        }
    },

    'ReadTags': async function () {
        this.attributes.lastIntent = 'ReadTags';
        let initialized = await initializeObjects(this, 'factsObj');
        if (!initialized) {
            this.response.speak("Please wait for your administrator to set up Google Sheets access.");
            this.emit(':responseReady');
        }
        let scheduleObj = this.attributes.scheduleObj;
        let factsObj =  this.attributes.factsObj;
        let courseNumber = this.event.request.intent.slots.courseNumber.value;

        if (courseNumber) {
            if (!scheduleObj.hasOwnProperty(courseNumber)) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    `I'm sorry, I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                    `Looks like I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                    `I'm sorry, course <say-as interpret-as="spell-out">${courseNumber}</say-as> doesn't seem to exist. Which course number would you like?`
                ];
                let speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                this.attributes.courseNumber = courseNumber;
                let speechOutput = readTagsHelper(this.attributes, factsObj);
                this.attributes.lastOutput = speechOutput;
                this.response.speak(speechOutput);
                nullifyObjects(this.attributes);
                this.emit(":responseReady");
            }
        } else {
            let sectionObj = checkSchedule(scheduleObj);
            getContext(this.attributes, sectionObj);
            if (!sectionObj) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    'For which course number?',
                    'What is the course number?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                let speechOutput = readTagsHelper(this.attributes, factsObj);
                this.attributes.lastOutput = speechOutput;
                this.response.speak(speechOutput);
                nullifyObjects(this.attributes);
                this.emit(":responseReady");
            }
        }
    },

    'GroupPresent': async function () {
        this.attributes.lastIntent = 'GroupPresent';

        let initialized = await initializeObjects(this, 'rosterObj');

        if (!initialized) {
            this.response.speak("Please wait for your administrator to set up Google Sheets access.");
            this.emit(':responseReady');
        }
        let scheduleObj = this.attributes.scheduleObj;
        let rosterObj =  this.attributes.rosterObj;
        const groupNumberString = this.event.request.intent.slots.groupNumber.value;
        const courseNumber = this.event.request.intent.slots.courseNumber.value;
        const sectionTime = this.event.request.intent.slots.sectionTime.value;

        if (courseNumber || sectionTime) {
            if (!courseNumber) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    'For which course number?',
                    'What is the course number?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!scheduleObj.hasOwnProperty(courseNumber)) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    `I'm sorry, I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                    `Looks like I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                    `I'm sorry, course <say-as interpret-as="spell-out">${courseNumber}</say-as> doesn't seem to exist. Which course number would you like?`
                ];
                let speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!sectionTime) {
                let slotToElicit = 'sectionTime';
                const allOutputs = [
                    'For which section time?',
                    'Which section time would you like?',
                    'What is the section time?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!isValidSectionTime(this.attributes, scheduleObj, courseNumber, sectionTime)) {
                let slotToElicit = 'sectionTime';
                const allOutputs = [
                    `I'm sorry, I don't have a section at ${sectionTime} on record for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which section time would you like?`,
                    `Looks like I don't have a section at ${sectionTime} for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which section time would you like?`,
                    `I'm sorry, the section at ${sectionTime} doesn't seem to exist for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which section time would you like?`
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!groupNumberString) {
                let slotToElicit = 'groupNumber';
                const allOutputs = [
                    'How many people per group?',
                    'How many people are in each group?',
                    'What is the number of people per group?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                this.attributes.courseNumber = courseNumber;
                let groups = groupPresentHelper(this.attributes, rosterObj, groupNumberString);
                let speechOutput = '';
                Object.keys(groups).forEach(group => {
                    speechOutput += `Group ${group}: ${groups[group].toString()} ` + '<break time = "1s"/>';
                });
                // writing
                Object.keys(groups).forEach(group => {
                    groups[group].forEach(student => {
                        let keys = {
                            CourseNumber: this.attributes.courseNumber,
                            SectionNumber: this.attributes.sectionNumber,
                            NickName: student
                        };
                        let values = {
                            CurrentGroup: group
                        };
                        googleSDK.writeTab(this.attributes.spreadsheetID, "Roster", keys, values);
                    });
                });
                this.attributes.lastOutput = speechOutput;
                this.response.speak(speechOutput);
                nullifyObjects(this.attributes);
                this.emit(':responseReady');
            }
        } else {
            getContext(this.attributes, checkSchedule(scheduleObj));
            if (!checkSchedule(scheduleObj)) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    'For which course number?',
                    'What is the course number?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!groupNumberString) {
                let slotToElicit = 'groupNumber';
                const allOutputs = [
                    'How many people per group?',
                    'How many people are in each group?',
                    'What is the number of people per group?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                let groups = groupPresentHelper(this.attributes, rosterObj, groupNumberString);
                let speechOutput = '';
                Object.keys(groups).forEach(group => {
                    speechOutput += `Group ${group}: ${groups[group].toString()}` + '<break time = "1s"/>';
                });
                // writing
                Object.keys(groups).forEach(group => {
                    groups[group].forEach(student => {
                        let keys = {
                            CourseNumber: this.attributes.courseNumber,
                            SectionNumber: this.attributes.sectionNumber,
                            NickName: student
                        };
                        let values = {
                            CurrentGroup: group
                        };
                        googleSDK.writeTab(this.attributes.spreadsheetID, "Roster", keys, values);
                    });
                });
                this.attributes.lastOutput = speechOutput;
                this.response.speak(speechOutput);
                nullifyObjects(this.attributes);
                this.emit(':responseReady');
            }
        }
    },

    'ColdCall': async function () {
        console.log(`*** sessionObj: ${this.event.session.user.userId}`);
        this.attributes.lastIntent = 'ColdCall';
        let initialized = await initializeObjects(this, 'rosterObj');

        if (!initialized) {
            this.response.speak("Please wait for your administrator to set up Google Sheets access.");
            this.emit(':responseReady');
        }
        let scheduleObj = this.attributes.scheduleObj;
        let rosterObj = this.attributes.rosterObj;
        let courseNumber = this.event.request.intent.slots.courseNumber.value;
        let sectionTime = this.event.request.intent.slots.sectionTime.value;

        if (courseNumber || sectionTime) {
            if (!courseNumber) {
                let slotToElicit = 'courseNumber';
                let speechOutput = "From which course would you like me to cold call?";
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!scheduleObj.hasOwnProperty(courseNumber)) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    `I'm sorry, I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                    `Looks like I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                    `I'm sorry, course <say-as interpret-as="spell-out">${courseNumber}</say-as> doesn't seem to exist. Which course number would you like?`
                ];
                let speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!sectionTime) {
                let slotToElicit = 'sectionTime';
                const allOutputs = [
                    'For which section time?',
                    'Which section time would you like?',
                    'What is the section time?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!isValidSectionTime(this.attributes, scheduleObj, courseNumber, sectionTime)) {
                let slotToElicit = 'sectionTime';
                const allOutputs = [
                    `I'm sorry, I don't have a section at ${sectionTime} on record for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which section time would you like?`,
                    `Looks like I don't have a section at ${sectionTime} for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which section time would you like?`,
                    `I'm sorry, the section at ${sectionTime} doesn't seem to exist for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which section time would you like?`
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                this.attributes.courseNumber = courseNumber;
                let speechOutput = coldCallHelper(this.attributes, rosterObj);
                this.attributes.lastOutput = speechOutput;
                //writing
                let keys = {
                    CourseNumber: this.attributes.courseNumber,
                    SectionNumber: this.attributes.sectionNumber,
                    NickName: speechOutput
                };
                let values = {
                    BeenCalled: (this.attributes.rosterObj[this.attributes.courseNumber][this.attributes.sectionNumber][speechOutput]["BeenCalled"])
                };
                googleSDK.writeTab(this.attributes.spreadsheetID, "Roster", keys, values);

                this.response.speak(speechOutput);
                nullifyObjects(this.attributes);
                this.emit(':responseReady');
            }
        } else {
            getContext(this.attributes, checkSchedule(scheduleObj));
            if (!checkSchedule(scheduleObj)) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    'For which course number?',
                    'What is the course number?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                let speechOutput = coldCallHelper(this.attributes, rosterObj);
                this.attributes.lastOutput = speechOutput;
                //writing
                let keys = {
                    CourseNumber: this.attributes.courseNumber,
                    SectionNumber: this.attributes.sectionNumber,
                    NickName: speechOutput
                };
                let values = {
                    BeenCalled: (this.attributes.rosterObj[this.attributes.courseNumber][this.attributes.sectionNumber][speechOutput]["BeenCalled"])
                };

                googleSDK.writeTab(this.attributes.spreadsheetID, "Roster", keys, values);

                this.response.speak(speechOutput);
                nullifyObjects(this.attributes);
                this.emit(':responseReady');
            }
        }
    },

    'QuizQuestion': async function () {
        this.attributes.lastIntent = 'QuizQuestion';

        let initialized = await initializeObjects(this, 'questionsObj');

        if (!initialized) {
            this.response.speak("Please wait for your administrator to set up Google Sheets access.");
            this.emit(':responseReady');
        }
        let scheduleObj = this.attributes.scheduleObj;
        let questionsObj = this.attributes.questionsObj;
        let courseNumber = this.event.request.intent.slots.courseNumber.value;

        if (courseNumber) {
            if (!scheduleObj.hasOwnProperty(courseNumber)) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    `I'm sorry, I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                    `Looks like I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                    `I'm sorry, course <say-as interpret-as="spell-out">${courseNumber}</say-as> doesn't seem to exist. Which course number would you like?`
                ];
                let speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                this.attributes.courseNumber = courseNumber;
                let speechOutput = orderedQuizQuestion(this.attributes, questionsObj);
                this.attributes.lastOutput = speechOutput;
                this.response.speak(speechOutput);
                nullifyObjects(this.attributes);
                this.emit(":responseReady");
            }
        } else {
                getContext(this.attributes, checkSchedule(scheduleObj));
                if (!checkSchedule(scheduleObj)) {
                    let slotToElicit = 'courseNumber';
                    const allOutputs = [
                        'For which course number?',
                        'What is the course number?'
                    ];
                    const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                    this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
                } else {
                    let speechOutput = orderedQuizQuestion(this.attributes, questionsObj);
                    this.attributes.lastOutput = speechOutput;
                    this.response.speak(speechOutput);
                    nullifyObjects(this.attributes);
                    this.emit(":responseReady");
                }
            }
        },

    'ParticipationTracker': async function () {
        this.attributes.lastIntent = 'ParticipationTracker';
        let initialized = await initializeObjects(this, 'rosterObj');
        if (!initialized) {
            this.response.speak("Please wait for your administrator to set up Google Sheets access.");
            this.emit(':responseReady');
        }
        
        let scheduleObj = this.attributes.scheduleObj;
        let rosterObj = this.attributes.rosterObj;
        let courseNumber = this.event.request.intent.slots.courseNumber.value;
        let sectionTime = this.event.request.intent.slots.sectionTime.value;
        let firstNames = this.event.request.intent.slots.firstNames.value;

        if (courseNumber || sectionTime) {
            if (!courseNumber) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    'For which course number?',
                    'What is the course number?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!scheduleObj.hasOwnProperty(courseNumber)) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    `I'm sorry, I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                    `Looks like I don't have course <say-as interpret-as="spell-out">${courseNumber}</say-as> on record. Which course number would you like?`,
                    `I'm sorry, course <say-as interpret-as="spell-out">${courseNumber}</say-as> doesn't seem to exist. Which course number would you like?`
                ];
                let speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!sectionTime) {
                let slotToElicit = 'sectionTime';
                const allOutputs = [
                    'For which section time?',
                    'Which section time would you like?',
                    'What is the section time?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!isValidSectionTime(this.attributes, scheduleObj, courseNumber, sectionTime)) {
                let slotToElicit = 'sectionTime';
                const allOutputs = [
                    `I'm sorry, I don't have a section at ${sectionTime} on record for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which section time would you like?`,
                    `Looks like I don't have a section at ${sectionTime} for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which section time would you like?`,
                    `I'm sorry, the section at ${sectionTime} doesn't seem to exist in the record for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Which section time would you like?`
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!firstNames) {
                let slotToElicit = "firstNames";
                const allOutputs = [
                    'Who is getting points?',
                    'Who is going to receive points?',
                    'Who should I award points to?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (getInvalidNameList(this.attributes, firstNames).length > 0) {
                let invalidNames = getInvalidNameList(this.attributes, firstNames);
                let nameOutput = '';
                if (invalidNames.length > 0) {
                    invalidNames.forEach(name => {
                        if (name == 'cancel' || name == 'stop' ||
                            name == 'alexa stop' || name == 'alexa cancel') {
                            this.emitWithState('AMAZON.CancelIntent');
                        } else if (invalidNames.length == 1) {
                            nameOutput = name;
                        } else if (invalidNames.indexOf(name) == invalidNames.length - 1) {
                            nameOutput += `or ${name} `;
                        } else {
                            nameOutput += `${name}, `
                        }
                    });
                }
                let slotToElicit = 'firstNames';
                const allOutputs = [
                    `I'm sorry, I don't have ${nameOutput} on record for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Who is getting points?`,
                    `Looks like I don't have ${nameOutput} for course <say-as interpret-as="spell-out">${courseNumber}</say-as>. Who should I award points to?`,
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                this.attributes.courseNumber = courseNumber;
                let speechOutput = 'Your points have been awarded.';
                this.attributes.lastOutput = speechOutput;
                let names = firstNames.split(" ");
                // writing
                names.forEach((studentName) => {
                    let keys = {
                        CourseNumber: this.attributes.courseNumber,
                        SectionNumber: this.attributes.sectionNumber,
                        NickName: studentName
                    };
                    let values = {
                        ParticipationPoints: (rosterObj[this.attributes.courseNumber][this.attributes.sectionNumber][studentName]["ParticipationPoints"] + 1)
                    };

                    googleSDK.writeTab(this.attributes.spreadsheetID, "Roster", keys, values);
                });

                this.response.speak(speechOutput);
                nullifyObjects(this.attributes);
                this.emit(':responseReady');
            }
        } else {
            getContext(this.attributes, checkSchedule(scheduleObj));
            if (!checkSchedule(this.attributes.scheduleObj)) {
                let slotToElicit = 'courseNumber';
                const allOutputs = [
                    'For which course number?',
                    'What is the course number?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (!firstNames) {
                const allOutputs = [
                    'Who is getting points?',
                    'Who is going to receive points?',
                    'Who should I award points to?'
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                let slotToElicit = "firstNames";
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else if (getInvalidNameList(this.attributes, firstNames).length > 0) {
                let invalidNames = getInvalidNameList(this.attributes, firstNames);
                let nameOutput = '';
                if (invalidNames.length > 0) {
                    invalidNames.forEach(name => {
                        if (name == 'cancel' || name == 'stop' ||
                            name == 'alexa stop' || name == 'alexa cancel') {
                            this.emitWithState('AMAZON.CancelIntent');
                        } else if (invalidNames.length == 1) {
                            nameOutput = name;
                        } else if (invalidNames.indexOf(name) == invalidNames.length - 1) {
                            nameOutput += `or ${name} `;
                        } else {
                            nameOutput += `${name}, `
                        }
                    });
                }
                let slotToElicit = 'firstNames';
                const allOutputs = [
                    `I'm sorry, I don't have ${nameOutput} on record for course <say-as interpret-as="spell-out">${this.attributes.courseNumber}</say-as>. Who is getting points?`,
                    `Looks like I don't have ${nameOutput} for course <say-as interpret-as="spell-out">${this.attributes.courseNumber}</say-as>. Who should I award points to?`,
                ];
                const speechOutput = allOutputs[Math.floor(Math.random() * allOutputs.length)];
                this.emit(':elicitSlot', slotToElicit, speechOutput, speechOutput);
            } else {
                let speechOutput = 'Your points have been awarded.';
                this.attributes.lastOutput = speechOutput;
                let names = firstNames.split(" ");
                // writing
                names.forEach((studentName) => {
                    let keys = {
                        CourseNumber: this.attributes.courseNumber,
                        SectionNumber: this.attributes.sectionNumber,
                        NickName: studentName
                    };
                    let values = {
                        ParticipationPoints: (rosterObj[this.attributes.courseNumber][this.attributes.sectionNumber][studentName]["ParticipationPoints"] + 1)
                    };
                    googleSDK.writeTab(this.attributes.spreadsheetID, "Roster", keys, values);
                });
                this.response.speak(speechOutput);
                nullifyObjects(this.attributes);
                this.emit(':responseReady');
            }
        }
    },

    'RepeatIntent': function () {
        let speechOutput;
        if (!this.attributes.lastOutput) {
            speechOutput = "I'm sorry, I don't have anything to repeat yet. What can I do for you?"
        } else {
            speechOutput = this.attributes.lastOutput;
        }
        this.response.speak(speechOutput);
        this.emit(':responseReady');
    }
};
