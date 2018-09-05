/* eslint-disable  func-names */
/* eslint-disable  no-console */

//TODO Add auto-scaling for Dynamo
//TODO register for aws credits
//TODO use database saves sparingly, rely on session until application closes
//TODO fill out skill.json fully
//TODO handle first prompts
//TODO to emit and call another intent just call the function
//TODO handle case for calling, manging, adding items to an archived list
//TODO permission handling at each level
//TODO create repeat Intent
//TODO see if I can handle synonyms - can take care of this in unhandled - you can also have one singular unhandled intent. Make sure that it’s last in the argument list and that canHandle always returns true. That way, anything not otherwise handled will fall on through.
const Alexa = require('ask-sdk-core');

//DynamoDb Memory Persistence
const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
const dynamoDbPersistenceAdapter = new DynamoDbPersistenceAdapter({ tableName : 'disaster_ready_session_data', createTable: true });

const disaster_kit_list_items = require('./list-items');
const disaster_list_items = disaster_kit_list_items;
const https = require("https");
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');

//List API end-point.
const api_url = 'api.amazonalexa.com';
const api_port = '443';

const list_is_empty = "#list_is_empty#";

const affirmative_instruction = 'You can answer by saying "yes" or "no".';
const quantitative_instruction = "You can answer by giving me a number.";

/* jshint -W101 */
const languageString = {
  en: {
    translation: {
      SKILL_NAME: 'Disaster Ready',
      LIST_NAME: 'Emergency Supply Kit',
      SURVEY_QUESTIONS_SLOTS: ['houseHoldQuantity', 'hasInfants', 'hasElderly'],
      SURVEY_QUESTIONS: [ //order the same as model and update as model changes
        'How many people are in your household?',
        'Is there an infant in your household?',
        'Are there any elderly people in your household?',
      ],
      SURVEY_QUESTIONS_REPROMPTS_PREFACES : ['Sorry, I didn\'t get that. %s %s',
          'I didn\'t seem to get that, please answer the following question again. %s %s',
          'Pardon me, I didn\'t seem to get that. %s %s',
          'Sorry, I didn\'t understand your answer. Please answer the question again. %s %s',
      ],
      SURVEY_QUESTIONS_REPROMPTS: {
          'houseHoldQuantity': ['How many people do you live with?', 'What is the size of your household?'],
          'hasInfants': ['Does a baby live with you?', 'Is there a baby in your household?', 'Are there any infants in your household?'],
          'hasElderly': ['Do you live with any elderly people?', 'Do you live with a person who is a senior citizen?']
      },
      SURVEY_QUESTIONS_INSTRUCTIONS: {
          'houseHoldQuantity': quantitative_instruction,
          'hasInfants': affirmative_instruction,
          'hasElderly': affirmative_instruction,
      },
      SURVEY_COMPLETE_MESSAGE: '',
      NEW_SESSION_MESSAGE: 'Welcome to the %s skill. I will walk you through building an emergency supply kit for disasters.<break time=".5s"/> First answer %s short questions so I can consider the unique needs of your home.<break time=".3s"/> How many people are in your household?',
      RETURNING_SESSION_MESSAGE_SURVEY_INCOMPLETE: [
          'Welcome back to the %s skill. Let\'s pick up where we left off. You have %s %s remaining. Please answer the following %s. <break time=".8s"/> %s'
      ],
      RETURNING_SESSION_MESSAGE_SURVEY_COMPLETE: [
          'Welcome back to the %s skill.<break time=".5s"/> To get the next item on your list you can say "get next item" or "get next"'
      ],
    },
  },
  'en-US': {
    translation: {
      LANG_SKILL_NAME: 'Disaster Ready (American)'
    },
  },
  'en-GB': {
    translation: {
      LANG_SKILL_NAME: 'Disaster Ready (British)'
    },
  }
};

const LocalizationInterceptor = {
    process(handlerInput) {
        const localizationClient = i18n.use(sprintf).init({
            lng: handlerInput.requestEnvelope.request.locale,
            overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
            resources: languageString,
            returnObjects: true
        });

        const attributes = handlerInput.attributesManager.getRequestAttributes();
        attributes.t = function (...args) {
            return localizationClient.t(...args);
        };
    },
};


/*
 *  Skill Handlers
 */
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput) {
    //grabbing global
    const attributesManager = handlerInput.attributesManager;
    const requestAttributes = attributesManager.getRequestAttributes();
    const surveyQuestions = requestAttributes.t('SURVEY_QUESTIONS');

    //getting persistent attributes from the database
    const attributes = await attributesManager.getPersistentAttributes() || {};

    //setting up speech text and card text
    let speechText = '';
    let card_text = '';
    let questionsRemaining = surveyQuestions.length;

    //determining welcome message based on user experience with skill thus far
    if (Object.keys(attributes).length === 0) {
        attributes.sessionState = 'SURVEY';  //SESSION STATES [SURVEY, LIST, COMPLETE]
        attributes.listID = '';
        attributes.lastListItemID = null;
        attributes.list_items_ids = {};
        speechText = requestAttributes.t('NEW_SESSION_MESSAGE', requestAttributes.t('SKILL_NAME'), surveyQuestions.length)+'<break time=".5s"/> ';
        card_text = stripTags(speechText);
    }else{
        const temp_survey_intent = attributes.temp_SurveyIntent;
        questionsRemaining = countEmptyFields(temp_survey_intent);
        if(questionsRemaining > 0){
            let nextSurveyQuestion = getNextListItem(questionsRemaining, surveyQuestions);
            let question_text = (questionsRemaining == 1) ? 'question' : 'questions';
            speechText = getRandomArrayItem(requestAttributes.t('RETURNING_SESSION_MESSAGE_SURVEY_INCOMPLETE', requestAttributes.t('SKILL_NAME'), questionsRemaining, question_text, question_text, nextSurveyQuestion));
            card_text = stripTags(speechText);
        }else{
            speechText = getRandomArrayItem(requestAttributes.t('RETURNING_SESSION_MESSAGE_SURVEY_COMPLETE', requestAttributes.t('SKILL_NAME')));
            card_text = stripTags(speechText);
        }
    }

    //saving data launch data to database and attributes
    attributesManager.setSessionAttributes(attributes);
    attributesManager.setPersistentAttributes(attributes);
    await attributesManager.savePersistentAttributes();

    let repromptText = '';
    if(questionsRemaining > 0){
        let init_slot = getNextListItem(questionsRemaining, requestAttributes.t('SURVEY_QUESTIONS_SLOTS'));
        repromptText = getRandomArrayItem(requestAttributes.t('SURVEY_QUESTIONS_REPROMPTS')[init_slot]);

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(repromptText)
            .getResponse();
    }else{
        let repromptText = 'You can say get next item or get next';
    }

      return handlerInput.responseBuilder.speak(speechText)
          .reprompt(repromptText)
          .withSimpleCard('Welcome', card_text)
          .getResponse();

  },
};

const InProgressSurveyHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' &&
            request.intent.name === 'SurveyIntent' &&
            request.dialogState !== 'COMPLETED';
    },
    async handle(handlerInput) {
        console.log("in InProgressSurveyHandler");

        //grabbing constants that are needed
        const request = handlerInput.requestEnvelope.request;
        const attributesManager = handlerInput.attributesManager;
        const requestAttributes = attributesManager.getRequestAttributes();
        let current_attributes = await attributesManager.getPersistentAttributes() || {};

        let updatedIntent = request.intent;
        let disambiguate_slot_response = null;
        let at_state_end = true;

        // We only need to restore state if we aren't COMPLETED.
        if (request.dialogState !== "COMPLETED") {
            if (current_attributes.temp_SurveyIntent) {
                let tempSlots = current_attributes.temp_SurveyIntent.slots;
                Object.keys(tempSlots).forEach(currentSlot => {
                    if (tempSlots[currentSlot].value) {
                        request.intent.slots[currentSlot] = tempSlots[currentSlot];
                    }
                }, request);
            } else {
                current_attributes.temp_SurveyIntent = request.intent;
            }
        } else {
            delete current_attributes.temp_SurveyIntent;
        }

        current_attributes.temp_SurveyIntent = handlerInput.requestEnvelope.request.intent;
        if (request.dialogState === "STARTED" || request.dialogState !== "COMPLETED") {
            at_state_end = false;
        }

        console.log('dialog not complete attr::', current_attributes.temp_SurveyIntent.slots);

        // Dialog is now complete and all required slots should be filled, calling normal handler
        handlerInput.attributesManager.setPersistentAttributes(current_attributes);
        handlerInput.attributesManager.setSessionAttributes(current_attributes);

        console.log('in dialogState: ', request.dialogState);

        //handle promise update session values
        disambiguate_slot_response = disambiguateSlot(handlerInput);
        if(disambiguate_slot_response !== true){
            let current_slot = disambiguate_slot_response.slot;
            let repromptQuestionText = getRandomArrayItem(requestAttributes.t('SURVEY_QUESTIONS_REPROMPTS')[current_slot]);
            let repromptInstructionText = requestAttributes.t('SURVEY_QUESTIONS_INSTRUCTIONS')[current_slot];
            let repromptText = getRandomArrayItem(requestAttributes.t('SURVEY_QUESTIONS_REPROMPTS_PREFACES', repromptQuestionText, repromptInstructionText));

            return handlerInput.responseBuilder
                .addElicitSlotDirective(current_slot , disambiguate_slot_response.intent)
                .speak(repromptText)
                .getResponse();
        }else{
            await handlerInput.attributesManager.savePersistentAttributes();
            console.log('is completed');
            if(at_state_end){
                return request.intent.slots;
            }

            return handlerInput.responseBuilder
                .addDelegateDirective(updatedIntent)
                .getResponse();
        }
        return null;
    },
};

const CompletedSurveyHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'SurveyIntent';
    },
    async handle(handlerInput) {
        console.log('completed survey handler');
        const attributesManager = handlerInput.attributesManager;
        const requestAttributes = attributesManager.getRequestAttributes();
        let current_attributes = await attributesManager.getPersistentAttributes();
        const disaster_kit_list = getDisasterKitItems(disaster_list_items, handlerInput.requestEnvelope.request.locale);
        current_attributes.sessionState = 'LIST';
        handlerInput.attributesManager.setPersistentAttributes(current_attributes);
        handlerInput.attributesManager.setSessionAttributes(current_attributes);

        return new Promise((resolve, reject) => {
            createNewList(requestAttributes.t('LIST_NAME'), handlerInput).then(async (response) => {
                if(response.statusCode == 201){ //success
                    current_attributes.listID = response.listId;
                    let list_id = response.listId;
                    let slot_list = getActiveSlots(current_attributes.temp_SurveyIntent);
                    let emergency_kit_list = getListItemsByType(slot_list, disaster_kit_list);
                    for(let list_item of emergency_kit_list){
                        addListItem(list_id, list_item.name, handlerInput, async function(status, response_Data){
                            let list_item_id = response_Data.id;
                            let disaster_kit_id = list_item.id;
                            current_attributes.list_items_ids[list_item_id] = {'id': disaster_kit_id, 'list_id':list_item_id, 'status': 1, 'is_reviewed': false};
                            handlerInput.attributesManager.setSessionAttributes(current_attributes);
                            handlerInput.attributesManager.setPersistentAttributes(current_attributes);
                            await handlerInput.attributesManager.savePersistentAttributes();
                        });
                    }
                }else{
                    //TODO write list failure
                }
            }).then(function(){

                console.log('attribute inside promise', current_attributes);

                let speechOutput = 'Thank you for answering my questions! I\'ve created an emergency supply kit list for your specific needs.<break time=".5s"/>';
                speechOutput += 'To get the next item on your list you can say \"get next item\" or \"get next\"';

                const responseBuilder = handlerInput.responseBuilder;

                resolve(responseBuilder
                    .withShouldEndSession(false)
                    .speak(speechOutput)
                    .getResponse());
            });
        });
    },
};

const NextItemIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'NextItemIntent';
  },
  async handle(handlerInput) {
    let speechText = '';
    let  repromptText = '';
    const attributesManager = handlerInput.attributesManager;
    let sessionAttributes =  await attributesManager.getPersistentAttributes() || {};
    let list_items_ids = sessionAttributes.list_items_ids;
    const system = handlerInput.requestEnvelope.context.System;
    let consent_token = system.apiAccessToken;
    let current_list_id = sessionAttributes.listID;
    const disaster_kit_list = getDisasterKitItems(disaster_list_items, handlerInput.requestEnvelope.request.locale);
    let items = [];

    //TODO add reprompts
    if(!handlerInput.requestEnvelope.context.System.user.permissions) {
      console.log("permissions are not defined");
        let permissions = ["alexa::household:lists:read", "alexa::household:lists:write"];
        speechText = "Alexa List permissions are missing. You can grant permissions within the Alexa app.";
        return handlerInput.responseBuilder
            .speak(speechText)
            .withAskForPermissionsConsentCard(permissions)
            .getResponse();
    }

    console.log("Starting get todo list call.");

    let todo_path = '/v2/householdlists/'+current_list_id+'/active';

    let options = {
      custom: {'handler': handlerInput},
      host: api_url,
      port: api_port,
      path: todo_path,
      method: 'GET',
      headers: {
          'Authorization': 'Bearer ' + consent_token,
          'Content-Type': 'application/json'
      }
    };

    return new Promise((resolve, reject) => {
        httpGet(options).then(async (response) => {
            items = response.items;
            if(!items) {
                let  permissions = ["alexa::household:lists:read", "alexa::household:lists:write"];
                speechText = "Alexa List permissions are missing. You can grant permissions within the Alexa app.";

                resolve(handlerInput.responseBuilder
                    .speak(speechText)
                    .withAskForPermissionsConsentCard(permissions)
                    .getResponse());

            }else if(items === list_is_empty){
                speechText = "Your list is empty. You have no items on your Emergency Supply Kit list.";
                repromptText = "You have no items on your Emergency Supply Kit list.";
                //TODO add instructions on how to proceed
                resolve(handlerInput.responseBuilder
                    .speak(speechText)
                    .withShouldEndSession(false)
                    .getResponse());
            }else{
                let current_list_item = null;
                for(let i = 0;  i < items.length; i++){
                    let list_item_skill_id = items[i].id;
                    if(list_items_ids.hasOwnProperty(list_item_skill_id)){
                        if(list_items_ids[list_item_skill_id].is_reviewed === false){
                            sessionAttributes.list_items_ids[list_item_skill_id].is_reviewed = true;
                            sessionAttributes.lastListItemID = list_item_skill_id;
                            current_list_item = items[i];
                            attributesManager.setSessionAttributes(sessionAttributes);
                            attributesManager.setPersistentAttributes(sessionAttributes);
                            await attributesManager.savePersistentAttributes();
                            break;
                        }
                    }
                }

                if(items.length === 0){
                    //TODO return statement
                    console.log('item length is zero');
                    speechText = "There are no more items on your emergency supply kit list.";
                    repromptText = "You have completed your emergency supply kit list! All items have been checked off.";
                }
                else if(current_list_item == null){ //not in the list
                    for(let i = 0;  i < items.length; i++){
                        let list_item_skill_id = items[i].id;
                        if(!list_items_ids.hasOwnProperty(list_item_skill_id)){ //custom list item
                            current_list_item = items[i];
                            break;
                        }else{//keys found
                            if(list_items_ids[list_item_skill_id].is_reviewed === false){
                                current_list_item = items[i];
                                break;
                            }
                        }
                    }
                    //TODO case where current_list_item!= null and is not a custom item
                    if(current_list_item !== null){
                        speechText = "The next item on your list is "+current_list_item.value + ". You added this item to your Emergency Supply Kit list.";
                        repromptText = "The next item on your list is "+current_list_item.value;
                        let cur_session_attrs = attributesManager.getSessionAttributes();
                        cur_session_attrs.list_items_ids[current_list_item.id] = {'name': current_list_item.value, 'type': 'custom', 'is_reviewed': true}
                        attributesManager.setSessionAttributes(cur_session_attrs);
                        attributesManager.setPersistentAttributes(cur_session_attrs);
                        await attributesManager.savePersistentAttributes();
                    }else{
                        //TODO add case where we review each item again
                        // to start at the beginning of your list again say "reset"
                        // to get the items remaining on your list you can say "get all remaining items"
                        // to review the items you have checked off on the list say "review completed items"
                        speechText = "We have reviewed all items on your emergency supply kit list.";
                        repromptText = "We have reviewed all items on your emergency supply kit list.";
                    }

                    resolve(handlerInput.responseBuilder
                        .speak(speechText)
                        .reprompt(repromptText)
                        .withShouldEndSession(false)
                        .getResponse());
                }
                else{
                    if(list_items_ids.hasOwnProperty(current_list_item.id)){
                        if(list_items_ids[current_list_item.id].hasOwnProperty('type')){
                            speechText = "The next item on your list is "+current_list_item.value + ". You added this item to your Emergency Supply Kit list.";
                            repromptText = "The next item on your list is "+current_list_item.value;;
                        }else{
                            let nextItem = getListItemsByInternalID(list_items_ids[current_list_item.id].id, disaster_kit_list);
                            console.log('next item before::', nextItem);
                            nextItem = nextItem[0];
                            console.log('current_list_item::', current_list_item.id);
                            console.log('list_items_ids::', list_items_ids);
                            console.log('next item::', nextItem);

                            if(nextItem.hasOwnProperty('use_a')){
                                speechText = "The next item is a " + current_list_item.value +". "+nextItem.short_description;
                                repromptText = "The next item is a " + current_list_item.value+".";
                            }else{
                                speechText = "The next item is " + current_list_item.value +". "+nextItem.short_description;
                                repromptText = "The next item is " + current_list_item.value+".";
                            }

                            if(nextItem.hasOwnProperty('image_small')){
                                resolve(handlerInput.responseBuilder
                                    .speak(speechText)
                                    .reprompt(speechText)
                                    .withShouldEndSession(false)
                                    .withStandardCard(nextItem.name, nextItem.full_description, nextItem.image_small, nextItem.image_large)
                                    .getResponse());
                            }else{
                                resolve(handlerInput.responseBuilder
                                    .speak(speechText)
                                    .reprompt(speechText)
                                    .withShouldEndSession(false)
                                    .withSimpleCard(nextItem.name, nextItem.full_description)
                                    .getResponse());
                            }
                        }
                    }

                    resolve(handlerInput.responseBuilder
                        .speak(speechText)
                        .reprompt(repromptText)
                        .withShouldEndSession(false)
                        .getResponse());
                }
            }

            resolve(handlerInput.responseBuilder
                .speak(speechText)
                .reprompt(speechText)
                .withShouldEndSession(false)
                .getResponse());

        }).catch((error) => {
            console.log(error);
        });
    });

  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = 'You can say hello to me!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('Hello World', speechText)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const speechText = 'Goodbye!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Hello World', speechText)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`, error);

    return handlerInput.responseBuilder
      .speak('Sorry, I can\'t understand the command. Please say again.')
      .reprompt('Sorry, I can\'t understand the command. Please say again.')
      .getResponse();
  },
};

/*
 *  List Helper Functions
 */
const createNewList = function(list_name, handlerInput) { //addNewListAction, 201 = success, 409 = already created
    console.log("prepare New List API call");

    const system = handlerInput.requestEnvelope.context.System;

    const path = "/v2/householdlists/";

    console.log("path:" + path);

    const postData = {
        "name": list_name, //item value, with a string description up to 256 characters
        "state": "active" // item status (Enum: "active" only)
    };

    const consent_token = system.apiAccessToken;

    const options = {
        host: api_url,
        port: api_port,
        path: path,
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + consent_token,
            'Content-Type': 'application/json'
        }
    };
    return new Promise(((resolve, reject) => {
        const req = https.request(options, (res) => {
            console.log('statusCode:', res.statusCode);
            console.log('headers:', res.headers);
            let data = "";

            res.on('data', (d) => {
                console.log("data received:" + d);
                data += d;
            });
            res.on('error', (e) => {
                console.log("error received");
                console.error(e);
                reject(e);
            });
            res.on('end', function() {
                console.log("ending post request");
                if (res.statusCode === 201) {
                    let responseMsg = eval('(' + data + ')');
                    responseMsg.statusCode = res.statusCode;
                    resolve(responseMsg);
                } else {
                    resolve(res.statusCode);
                }
            });
        });

        req.end(JSON.stringify(postData));
    }));
};


/**
 * Add List Item API to retrieve the customer to-do list.
 */
/**
 * Add List Item API to retrieve the customer to-do list.
 */
const addListItem = async function(listId, listItemName, handlerInput, callback) {
    console.log("prepare API call to add item to list");

    const system = handlerInput.requestEnvelope.context.System;
    let consent_token = system.apiAccessToken;

    let path = "/v2/householdlists/_listId_/items";
    path = path.replace("_listId_", listId);

    console.log("path:" + path);

    let postData = {
        "value": listItemName, //item value, with a string description up to 256 characters
        "status": "active" // item status (Enum: "active" or "completed")
    };

    let options = {
        host: api_url,
        port: api_port,
        path: path,
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + consent_token,
            'Content-Type': 'application/json'
        }
    };

    let req = https.request(options, (res) => {
        console.log('statusCode:', res.statusCode);
        console.log('headers:', res.headers);
        let data = "";
        res.on('data', (d) => {
            console.log("data: " + d);
            data += d;
            //    process.stdout.write(d);
        });
        res.on('error', (e) => {
            console.log("error received");
            console.error(e);
        });
        res.on('end', function() {
            let responseMsg = eval('(' + data + ')');
            console.log('data from add list item:', responseMsg);
            callback(res.statusCode, responseMsg);
            return;
        });
    }).end(JSON.stringify(postData));

    return new Promise(function(resolve, reject) {
        resolve(postData);
    });
};
/**
 * Helper function to retrieve the top to-do item.
 */
const getAllListItems = function(handlerInput, callback) {
    return new Promise(function(resolve, reject) {
        getToDoList(handlerInput, function(handlerInput, returnValue) {
            if(!returnValue) {
                callback(null);
                reject(null);
            }
            else if(!returnValue.items || returnValue.items.length === 0) {
                callback(handlerInput, list_is_empty);
                resolve(list_is_empty);
            }
            else {
                callback(handlerInput, returnValue.items);
                resolve(returnValue.items);
            }
        });
    });
};

function httpGet(options) {
    return new Promise(((resolve, reject) => {

        const request = https.request(options, (response) => {
            response.setEncoding('utf8');
            let returnData = '';

            if((response.statusCode < 200 || response.statusCode >= 300) && response.statusCode !== 403) {
                return reject(new Error(`${response.statusCode}`));
            }

            if(response.statusCode === 403) {
                resolve(null);
                console.log("permissions are not granted");
            }

            response.on('data', (chunk) => {
                returnData += chunk;
            });

            response.on('end', () => {
                resolve(JSON.parse(returnData));
            });

            response.on('error', (error) => {
                reject(error);
            });
        });

        request.on('error', function (error) {
            reject(error);
        });

        request.end();
    }));
}

/*
 *  General Helper Functions
 */
const disambiguateSlot = (handlerInput) => {
    let currentRequest = handlerInput.requestEnvelope.request;
    let currentIntent = currentRequest.intent;
    let has_error = false;
    let error_response = {};

    Object.keys(currentIntent.slots).forEach(function(slotName) {
        let currentSlot = currentIntent.slots[slotName];
        // console.log('** current slot name', currentSlot);
        // let slotValue = slotHasValue(currentRequest, currentSlot.name);
        // console.log('** slot value', slotValue);
        if (currentSlot.confirmationStatus !== 'CONFIRMED' &&
            currentSlot.resolutions &&
            currentSlot.resolutions.resolutionsPerAuthority[0]) {
            if (currentSlot.resolutions.resolutionsPerAuthority[0].status.code == 'ER_SUCCESS_NO_MATCH') {
                console.log("NO MATCH FOR: ", currentSlot.name, " value: ", currentSlot.value);
                has_error = true;
                error_response.status = false;
                error_response.slot = currentSlot.name;
                error_response.intent = handlerInput.requestEnvelope.request.intent;
                return;
            }
        }
    }, handlerInput);

    if(has_error){
        return error_response;
    }
    return true;
}
const slotHasValue = (request, slotName) => {

    let slot = request.intent.slots[slotName];

    //uncomment if you want to see the request
    //console.log("request = "+JSON.stringify(request));
    let slotValue;

    //if we have a slot, get the text and store it into speechOutput
    if (slot && slot.value) {
        //we have a value in the slot
        slotValue = slot.value.toLowerCase();
        return slotValue;
    } else {
        //we didn't get a value in the slot.
        return false;
    }
}
const isSlotValid = (request, slotName) => {
    var slot = request.intent.slots[slotName];
    //console.log("request = "+JSON.stringify(request)); //uncomment if you want to see the request
    var slotValue;

    //if we have a slot, get the text and store it into speechOutput
    if (slot && slot.value) {
        //we have a value in the slot
        slotValue = slot.value.toLowerCase();
        return slotValue;
    } else {
        //we didn't get a value in the slot.
        return false;
    }
}
const getRandomArrayItem = (myArray) => {
    return myArray[Math.floor(Math.random()*myArray.length)]
}
const stripTags = (someTextWithSSMLTags) => {
    let regex = /(<([^>]+)>)/ig;
    return someTextWithSSMLTags.replace(regex, "");
}
const countEmptyFields = (intent_obj) => {
    if(typeof intent_obj === "undefined"){
        return 3;
    }
    let slots = intent_obj.slots;
    let count = 0;
    for(let key in slots){
        if(!slots[key].hasOwnProperty('value')){
            count += 1;
        }
    }
    return count;
}
const getNextListItem = (remaining_questions, list_questions) => {
    if(remaining_questions == 0){
        return false;
    }
    return list_questions[(list_questions.length - remaining_questions)];
}
const getListItemsByType = (slot_list, list) => {
    return list.filter(function(val) {
        return (slot_list.indexOf(val.type) !== -1);
    });
}
const getListItemsByInternalID = (id, list) => {
    return list.filter(function(val) {
        return (val.id == id);
    });
}

const getActiveSlots = (intent) => {
    let active_slots = ['general'];
    const intent_slots = intent.slots;
    for(const key of Object.keys(intent_slots)){
        let slot_val = intent_slots[key].value;
        if(slot_val === 'yes'){
            active_slots.push(key);
        }
    }
    return active_slots;
}

const getActiveAndUnreviewedListId = (list_ids_obj, handlerInput) => {
    let return_id = null;
    console.log('list length', list_ids_obj.length);
    for(let i = 0; i < list_ids_obj.length; i++){
        console.log('listy list', list_ids_obj[i]);
        if(list_ids_obj[i].is_reviewed === false) {
            list_ids_obj[i].is_reviewed = true;
            return_id = list_ids_obj[i].id;
            break;
        }
    }
    let session_attr = handlerInput.attributesManager.getSessionAttributes();
    session_attr.list_items_ids = list_ids_obj;
    if(return_id !== null){
        session_attr.lastListItemID = return_id;
    }
    handlerInput.attributesManager.setPersistentAttributes(session_attr);
    handlerInput.attributesManager.setSessionAttributes(session_attr);

    return return_id;
}
const updateListItemToReviewed = (list_id, list) =>{
    for(let i = 0; list.length; i++){
        if(list.id == list_id){
            list[i].is_reviewed = true;
        }
    }
    return list;
}
const getHouseholdCount = (intent) => {
    return intent.slots.houseHoldQuantity.value;
}
const getDisasterKitItems = (disaster_list_items, locale) =>{
    if(disaster_list_items.hasOwnProperty(locale)){
        return disaster_list_items.locale;
    }else{
        return disaster_list_items.en;
    }
}


/*
 *  Skill Build Response
 */
const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    NextItemIntentHandler,
    HelpIntentHandler,
    InProgressSurveyHandler,
    CompletedSurveyHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .withPersistenceAdapter(dynamoDbPersistenceAdapter)
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .lambda();