/* eslint-disable  func-names */
/* eslint-disable  no-console */

//PRODUCTION
//TODO Add auto-scaling for Dynamo
//TODO register for aws credits
//TODO fill out skill.json fully

const Alexa = require('ask-sdk-core');

//DynamoDb Memory Persistence
const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
const dynamoDbPersistenceAdapter = new DynamoDbPersistenceAdapter({ tableName : 'disaster_ready_session_data', createTable: true });

const disaster_kit_list_items = require('./list-items');
const disaster_list_items = disaster_kit_list_items;
const https = require("https");
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');

const list_is_empty = "#list_is_empty#";

const listStatuses = {
    ACTIVE: 'active',
    COMPLETED: 'completed',
};

/* jshint -W101 */
const languageString = {
  en: {
    translation: {
    SKILL_NAME: 'Disaster Ready',
    LIST_NAME: 'Emergency Supply Kit',
    SURVEY_QUESTIONS_SLOTS: ['houseHoldQuantity', 'hasInfants', 'hasElderly'],
    SURVEY_QUESTIONS: [ //order the same as model and update as model changes
        'Do you live with people are in your household?',
        'Is there an infant in your household?',
        'Are there any elderly people in your household?',
    ],
    SURVEY_QUESTIONS_REPROMPTS_PREFACES : ['Sorry, I didn\'t get that. %s %s',
      'I didn\'t seem to get that, please answer the following question again. %s %s',
      'Pardon me, I didn\'t seem to get that. %s %s',
      'Sorry, I didn\'t understand your answer. Please answer the question again. %s %s',
    ],
    SURVEY_QUESTIONS_REPROMPTS: {
        'houseHoldQuantity': ['Do you live with other people?', 'Are other people in your household?'],
        'hasInfants': ['Does a baby live with you?', 'Is there a baby in your household?', 'Are there any infants in your household?'],
        'hasElderly': ['Do you live with any elderly people?', 'Do you live with a person who is a senior citizen?']
    },
    SURVEY_QUESTIONS_INSTRUCTIONS: 'You can answer by saying "yes" or "no"',
    LIST_COMPLETE_MESSAGE: 'You have checked off all the items on your Emergency Supply list. Congratulations! <audio src=\'https://s3.amazonaws.com/ask-soundlibrary/human/amzn_sfx_large_crowd_cheer_01.mp3\'/> Thank you for using the Disaster Ready Skill.',
    NEW_SESSION_MESSAGE: 'Welcome to the %s skill. I will walk you through building an emergency supply kit for disasters.<break time=".5s"/> First answer %s short questions so I can consider the unique needs of your home.<break time=".3s"/> You can begin by saying start survey.',
    RETURNING_SESSION_MESSAGE_SURVEY_INCOMPLETE: [
        'Welcome back to the %s skill. Let\'s pick up where we left off. You have %s %s remaining. You can say continue survey to answer the remaining %s.'
    ],
    RETURNING_SESSION_MESSAGE_SURVEY_COMPLETE: [
        'Welcome back to the %s skill.<break time=".5s"/> To get the next item on your %s list you can say "next item" or "next"'
    ],
    START_PERMISSIONS_MISSING: 'Welcome to the %s skill. In order to use this skill you must grant Alexa: list read and write permissions within the Alexa app.',
    GENERAL_PERMISSIONS_MISSING: 'I was unable to do what you asked. In order to use this skill you must grant Alexa: list read and write permissions within the Alexa app.',
    RESTART_SESSION_LAUNCH_MESSAGE: 'Okay, let\'s start over. I will walk you through building an emergency supply kit for disasters again. Let\'s go through the survey once more to consider the unique needs of your household. To begin say: start survey.',
    PERMISSIONS_MISSING: 'Alexa List permissions are missing. You can grant permissions within the Alexa app.',
    REVIEWED_ALL_ITEMS_SPEECH: 'All items on your %s have been reviewed. To start at the top of the list again, you can say, "next" or "next item." Or review all completed items by saying: "review completed". Or review all remaining items by saying: "review items remaining."',
    REVIEWED_ALL_ITEMS_REPROMPT: 'You can say "next" or "next item" to review the remaining items again. You can review all completed items by saying "review completed". Or to review all remaining items say "review items remaining."',
    LIST_MISSING: 'I was unable to find your %s List. Please create a new list by saying "create new list."',
    LIST_EXISTS: 'Thank you for answering my questions. It appears an %s list already exists. If you wish to continue using the skill, delete the existing list in your Alexa app. Then reopen the skill and say "create new list."',
    LIST_EXISTS_LAUNCH: 'Last time we talked, it appeared an %s list already existed. Make sure you have deleted the list in your Alexa app. Then say "create new list." If you have already deleted the list just say "create new list."',
    LIST_STATE_NOT_READY: 'Sorry, you can not get any list items until the survey is complete.',
    GOODBYE_MESSAGES: ['Thank you for using %s. Goodbye.', 'Thank you for using %s. See you later.', 'Thank you for using the %s skill. Toodles!', 'Goodbye! Remember to check in and use %s again soon!'],
    HELP_MESSAGE_LIST_MISSING: 'Your %s list is missing. You can create a new list by saying "create new list."',
    HELP_MESSAGE_LIST_ALREADY_EXISTS: 'A %s list exists already. If you wish to continue using the skill, delete the existing list in your Alexa app. Then reopen the skill and say "create new list." If you have already deleted the list simply say "create new list."',
    HELP_MESSAGE_STATE_SURVEY: 'Please answer the questions asked so that I can customize your %s list. You can resume the survey by saying continue.',
    HELP_MESSAGE_STATE_LIST: 'To get the next item on your list. Simply say, "next" or "next item."',
    HELP_MESSAGE_GENERAL: 'To get the next item on your list you can say "next" or "next item. To hear all the remaining items on the list can say "review items remaining." To hear the completed items say "review completed items."',
    HELP_MESSAGE_STATE_COMPLETE: 'You have completed all items on your %s list. You can start over by saying restart. Or you can leave the skill by saying exit.',
    HELP_MESSAGE_ALL_LIST_ITEMS_REVIEWED: 'You have reviewed all items on your %s list. To hear all the remaining items on the list can say "review items remaining." To hear the completed items say "review completed items." Or to start over at the top of your list say "next" or "next item."',
    LIST_COMPLETE_MESSAGE_LAUNCH: 'Your %s list has been completed! Great job! You can start over by saying restart. Or leave the skill by saying exit.',
    MORE_INFO_NOT_AVAILABLE: 'Sorry. Unfortunately, I do not have more information on this particular item. To get the next item on the list say: next or next item. To repeat the last item given, say: repeat.',
    MORE_INFO_INVALID: 'You can\'t ask for more information at this stage of the skill. If you don\'t know how to proceed, please ask for help by saying: help.',
    REPEAT_INVALID: 'You can\'t ask me to repeat a list item at this stage of the skill. If you don\'t know how to proceed, please ask for help by saying: help.',
    GET_COMPLETED_ITEMS_INVALID: 'Your %s list has not been created yet, you can not review your completed items on your list. Resume your survey by saying: continue.',
    LIST_ITEM_NONE_EXISTANT: 'I was unable to retrieve the last list item I recited <break time=".2s"/>because the list item no longer exists. Get the next item on the list by saying: next or next item.',
    COMPLETED_ITEMS_EMPTY_LIST: 'Your %s list has no completed items.',
    NO_COMPLETED_ITEMS: 'There are no completed items on your list.',
    COMPLETED_ITEMS: 'The items completed on your %s list are: %s.',
    COMPLETED_ITEM: 'There is only one item completed on your %s list, which is : %s',
    GET_REMAINING_ITEMS_INVALID: 'Your %s list has not been created yet, you can not review the remaining incompleted items on your list. Resume your survey by saying: continue.',
    REMAINING_ITEMS_EMPTY_LIST: 'Your %s list has no items remaining. All list items have been completed!',
    NO_REMAINING_ITEMS: 'There are no more items remaining on your list. You have completed your list!',
    REMAINING_ITEMS: 'The items remaining on your %s list are: %s.',
    REMAINING_ITEM: 'There is only one item remaining on your %s list, which is : %s',
    EXIT_MESSAGES: []
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
    const skill_name = requestAttributes.t('SKILL_NAME');
    //permission checks
    const permissionCheck = await hasListPermission(handlerInput);
    if(!permissionCheck){
        const permissions = ['read::alexa:household:list', 'write::alexa:household:list'];
        let speechText = requestAttributes.t('START_PERMISSIONS_MISSING', skill_name);
        return handlerInput.responseBuilder
            .speak(speechText)
            .withAskForPermissionsConsentCard(permissions)
            .getResponse();
    }

    //getting persistent attributes from the database
    const attributes = await attributesManager.getPersistentAttributes() || {};
    const list_name = requestAttributes.t('LIST_NAME');

    //sanity checks
    if(attributes.sessionState === 'COMPLETE'){
      attributesManager.setSessionAttributes(attributes);
      attributesManager.setPersistentAttributes(attributes);
      let speechText = requestAttributes.t('LIST_COMPLETE_MESSAGE_LAUNCH', list_name);
      return handlerInput.responseBuilder
          .speak(speechText)
          .withShouldEndSession(false)
          .getResponse()
    }

    if(attributes.listExists){
        attributesManager.setSessionAttributes(attributes);
        attributesManager.setPersistentAttributes(attributes);
        let speechText = requestAttributes.t('LIST_EXISTS_LAUNCH', list_name);
        return handlerInput.responseBuilder
            .speak(speechText)
            .withShouldEndSession(false)
            .getResponse()
    }

    if(attributes.listMissing){
        attributesManager.setSessionAttributes(attributes);
        attributesManager.setPersistentAttributes(attributes);
        let speechText = requestAttributes.t('LIST_MISSING', list_name);
        return handlerInput.responseBuilder
            .speak(speechText)
            .withShouldEndSession(false)
            .getResponse()
    }

    //setting up speech text and card text
    let speechText = '';
    let card_text = '';
    let questionsRemaining = surveyQuestions.length;

    //determining welcome message based on user experience with skill thus far
    if (Object.keys(attributes).length === 0 || Object.keys(attributes).length === 1) {
        attributes.sessionState = 'SURVEY';  //SESSION STATES [SURVEY, LIST, COMPLETE]
        attributes.listID = '';
        attributes.lastListItemID = null;
        attributes.listExists = false;
        attributes.listMissing = false;
        attributes.hasReviedAllItems = false;
        attributes.list_items_ids = {};
        speechText = requestAttributes.t('NEW_SESSION_MESSAGE', requestAttributes.t('SKILL_NAME'), surveyQuestions.length)+'<break time=".5s"/> ';

        if(attributes.hasOwnProperty('is_restarted')){
            if(attributes.is_restarted === true){
                attributes.is_restarted = false;
                speechText = requestAttributes.t('RESTART_SESSION_LAUNCH_MESSAGE');
            }
        }

    }else{
        const temp_survey_intent = attributes.temp_SurveyIntent;
        questionsRemaining = countEmptyFields(temp_survey_intent);
        if(questionsRemaining > 0){
            let nextSurveyQuestion = getNextListItem(questionsRemaining, surveyQuestions);
            let question_text = (questionsRemaining == 1) ? 'question' : 'questions';
            speechText = getRandomArrayItem(requestAttributes.t('RETURNING_SESSION_MESSAGE_SURVEY_INCOMPLETE', requestAttributes.t('SKILL_NAME'), questionsRemaining, question_text, question_text));
        }else{
            speechText = getRandomArrayItem(requestAttributes.t('RETURNING_SESSION_MESSAGE_SURVEY_COMPLETE', requestAttributes.t('SKILL_NAME'), requestAttributes.t('LIST_NAME')));
        }
    }

    //saving data launch data to database and attributes
    attributesManager.setSessionAttributes(attributes);
    attributesManager.setPersistentAttributes(attributes);
    await attributesManager.savePersistentAttributes();

    card_text = stripTags(speechText);
    let repromptText = '';
    if(questionsRemaining > 0){
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(repromptText)
            .getResponse();
    }else{
        repromptText = 'You can say next item or next';
    }

    return handlerInput.responseBuilder
      .speak(speechText)
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
        disambiguate_slot_response = await disambiguateSlot(handlerInput);
        console.log("disambiguate_slot_response:", disambiguate_slot_response);
        if(disambiguate_slot_response !== true){
            let current_slot = disambiguate_slot_response.slot;
            let repromptQuestionText = getRandomArrayItem(requestAttributes.t('SURVEY_QUESTIONS_REPROMPTS')[current_slot]);
            let repromptInstructionText = requestAttributes.t('SURVEY_QUESTIONS_INSTRUCTIONS');
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
        let list_recreated = false;
        if(current_attributes.listExists == true || current_attributes.listMissing == true){
            list_recreated = true;
        }

        current_attributes.sessionState = 'LIST';
        handlerInput.attributesManager.setPersistentAttributes(current_attributes);
        handlerInput.attributesManager.setSessionAttributes(current_attributes);

        const listClient = handlerInput.serviceClientFactory.getListManagementServiceClient();

        const list_request = {
            'name': requestAttributes.t('LIST_NAME'),
            'state': listStatuses.ACTIVE
        };

        await listClient.createList(list_request).then(async function(create_list_response) {
            current_attributes.listID = create_list_response.listId;
            current_attributes.listExists = false;
            current_attributes.listMissing = false;
            let list_id = create_list_response.listId;
            let slot_list = getActiveSlots(current_attributes.temp_SurveyIntent);
            let emergency_kit_list = getListItemsByType(slot_list, disaster_kit_list);
            for(let list_item of emergency_kit_list){
                const list_item_create_request = {
                    'value': list_item.name,
                    'status': listStatuses.ACTIVE
                };
                await listClient.createListItem(list_id, list_item_create_request).then(async function(response){
                    let list_item_id = response.id;
                    let disaster_kit_id = list_item.id;
                    current_attributes.list_items_ids[list_item_id] = {'id': disaster_kit_id, 'list_id':list_item_id, 'status': 1, 'is_reviewed': false};
                    handlerInput.attributesManager.setSessionAttributes(current_attributes);
                    handlerInput.attributesManager.setPersistentAttributes(current_attributes);
                    await handlerInput.attributesManager.savePersistentAttributes();
                });
            }
        });

        let speechOutput = 'Thank you for answering my questions! I\'ve created an emergency supply kit list for your specific needs.<break time=".5s"/> ';
        if(list_recreated){
            speechOutput = " I\'ve created a brand new emergency supply kit list for you. ";
        }
        speechOutput += 'To get the first item on your list you can say \"next item\" or \"next\"';

        const responseBuilder = handlerInput.responseBuilder;

        return responseBuilder
            .withShouldEndSession(false)
            .speak(speechOutput)
            .getResponse();

    },
};

const CreateNewListIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
          && handlerInput.requestEnvelope.request.intent.name === 'CreateNewListIntent';
    },
    handle(handlerInput) {
        return CompletedSurveyHandler.handle(handlerInput);
    }
};

const RepeatIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
          && handlerInput.requestEnvelope.request.intent.name === 'RepeatIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttribute = await attributesManager.getPersistentAttributes();
        const requestAttribute = attributesManager.getRequestAttributes();
        const disaster_kit_list = getDisasterKitItems(disaster_list_items, handlerInput.requestEnvelope.request.locale);
        let last_alexa_id = sessionAttribute.lastListItemID;
        let listId = sessionAttribute.listID;
        let list_items_ids = sessionAttribute.list_items_ids;
        let speechOutput = requestAttribute.t('REPEAT_INVALID');
        let repromptText = requestAttribute.t('REPEAT_INVALID');
        if(sessionAttribute.sessionState === 'LIST'){
            const listClient = handlerInput.serviceClientFactory.getListManagementServiceClient();
            const list_item = await listClient.getListItem(listId, last_alexa_id);

            speechOutput = 'The last item I gave you was ' + list_item.value+'.';
            repromptText = 'The last item I gave you was ' + list_item.value+'.';

            if(list_items_ids.hasOwnProperty(last_alexa_id)){
                let nextItem = getListItemsByInternalID(list_items_ids[last_alexa_id].id, disaster_kit_list);
                nextItem = nextItem[0];
                if(typeof nextItem !== 'undefined' && nextItem){
                    if(nextItem.hasOwnProperty('name')){
                        if(nextItem.hasOwnProperty('use_a')){
                            speechOutput = "The last item I gave you was a " + list_item.value +".";
                            if(nextItem.hasOwnProperty('short_description')){
                                speechOutput+= ' '+nextItem.short_description;
                            }
                        }else{
                            speechOutput = "The last item I gave you was " + list_item.value +".";
                            if(nextItem.hasOwnProperty('short_description')){
                                speechOutput+= ' '+nextItem.short_description;
                            }
                        }
                    }
                }
            }
        }

        const responseBuilder = handlerInput.responseBuilder;
        return responseBuilder
            .withShouldEndSession(false)
            .speak(speechOutput)
            .getResponse();
    }
};

const MoreInfoIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
          && handlerInput.requestEnvelope.request.intent.name === 'MoreInfoIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttribute = await attributesManager.getPersistentAttributes();
        const requestAttribute = attributesManager.getRequestAttributes();
        const disaster_kit_list = getDisasterKitItems(disaster_list_items, handlerInput.requestEnvelope.request.locale);
        console.log('SESSION STATE', sessionAttribute.sessionState);
        let speechOutput = requestAttribute.t('MORE_INFO_NOT_AVAILABLE');
        if(sessionAttribute.sessionState === 'LIST'){
            let last_alexa_id = sessionAttribute.lastListItemID;
            let last_alexa_items = sessionAttribute.list_items_ids;
            console.log('IN THE RIGHT LIST SECTION');
            if(last_alexa_items.hasOwnProperty(last_alexa_id)){
                console.log('LIST ITEM HAS THE VALUES');
                let last_alexa_item_ob = last_alexa_items[last_alexa_id];
                if(last_alexa_item_ob.hasOwnProperty('id')){
                    let internal_id = last_alexa_item_ob['id'];
                    console.log('INTERNAL_ID', internal_id);
                    let nextItem = getListItemsByInternalID(internal_id, disaster_kit_list);
                    nextItem = nextItem[0];
                    console.log('NEXT ITEM', nextItem);
                    if(nextItem.hasOwnProperty('full_description')){
                        speechOutput = nextItem.full_description + ' To get the next item on your list. Simply say, "next" or "next item."';
                    }

                }
            }
        }else{
            speechOutput = requestAttribute.t('MORE_INFO_INVALID');
        }

        const responseBuilder = handlerInput.responseBuilder;
        return responseBuilder
            .withShouldEndSession(false)
            .speak(speechOutput)
            .getResponse();
    }
};

const RestartIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
          && handlerInput.requestEnvelope.request.intent.name === 'RestartIntent';
    },
    async handle(handlerInput) {
        const attributes = {is_restarted:true};
        const attributeManager = handlerInput.attributesManager;
        attributeManager.setPersistentAttributes(attributes);
        await attributeManager.savePersistentAttributes()
        return LaunchRequestHandler.handle(handlerInput);
    }
};
const CheckOffItemIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
          && handlerInput.requestEnvelope.request.intent.name === 'CheckOffItemIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const requestAttributes = attributesManager.getRequestAttributes();
        const sessionAttributes = await attributesManager.getPersistentAttributes();
        const listID = sessionAttributes.listID;
        const listItemId = sessionAttributes.lastListItemID;
        const itemstatus = listStatuses.COMPLETED;
        let speechOutPut = 'Sorry, I was unable to check off the last item on your list. Please make sure the list item exists. You can proceed by saying next.';
        let item_checked_message = null;
        if(listItemId !== null){
            let list_item_return = await updateListItem(handlerInput, listID, listItemId, itemstatus);
            console.log('RETURN VALUE', list_item_return);
            item_checked_message = 'Got it! I\'ve checked off '+list_item_return.value+'.';
            speechOutPut = item_checked_message;
        }

        const items = await getToDoItems(handlerInput, listID, listStatuses.ACTIVE);
        if(items === list_is_empty){
            if(item_checked_message !== null){
                speechOutPut = item_checked_message +' <break time=".2s"/>'+requestAttributes.t('LIST_COMPLETE_MESSAGE');
            }else{
                speechOutPut = requestAttributes.t('LIST_COMPLETE_MESSAGE');
            }
            sessionAttributes.sessionState = 'COMPLETE';
            attributesManager.setSessionAttributes(sessionAttributes);
            attributesManager.setPersistentAttributes(sessionAttributes);
            await attributesManager.savePersistentAttributes();

            return handlerInput.responseBuilder
                .speak(speechOutPut)
                .withShouldEndSession(true)
                .getResponse();
        }

        const responseBuilder = handlerInput.responseBuilder;
        return responseBuilder
            .withShouldEndSession(false)
            .speak(speechOutPut)
            .getResponse();
    }
};

const GetCompletedItemsIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
          && handlerInput.requestEnvelope.request.intent.name === 'GetCompletedItemsIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttribute = attributesManager.getSessionAttributes();
        const requestAttribute = attributesManager.getRequestAttributes();
        const list_name = requestAttribute.t('LIST_NAME');
        const listId = sessionAttribute.listID;
        let speechOutPut = requestAttribute.t('GET_COMPLETED_ITEMS_INVALID', list_name);
        let card_text = stripTags(speechOutPut);
        if(sessionAttribute.sessionState !== 'SURVEY'){
            const items = await getToDoItems(handlerInput, listId, listStatuses.COMPLETED);
            if(!items) {
                let  permissions = ['read::alexa:household:list', 'write::alexa:household:list'];
                speechOutPut = requestAttribute.t('PERMISSIONS_MISSING');

                return handlerInput.responseBuilder
                    .speak(speechOutPut)
                    .withAskForPermissionsConsentCard(permissions)
                    .getResponse();

            }else if(items === list_is_empty){
                speechOutPut = requestAttribute.t('COMPLETED_ITEMS_EMPTY_LIST', list_name);
                card_text = stripTags(speechOutPut);
            }else{
                if(items.length === 0){
                    speechOutPut = requestAttribute.t('NO_COMPLETED_ITEMS');
                }else{
                    let string_completed_items = getStringOfListItems(items);
                    if(items.length > 1){
                        speechOutPut = requestAttribute.t('COMPLETED_ITEMS', list_name, string_completed_items);
                    }else{
                        speechOutPut = requestAttribute.t('COMPLETED_ITEM', list_name, string_completed_items);
                    }
                }
                card_text = stripTags(speechOutPut);
            }

            //TODO Instructions of what to do next? refer to what prompt use this intent
            speechOutPut += ' <break time=".3s"/>What would you like to do next? If you are not sure, you can say: help.';
        }

        const responseBuilder = handlerInput.responseBuilder;
        return responseBuilder
            .withShouldEndSession(false)
            .withSimpleCard('Completed List Items', card_text)
            .speak(speechOutPut)
            .getResponse();
    }
};

const GetRemainingItemsIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
          && handlerInput.requestEnvelope.request.intent.name === 'GetRemainingItemsIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttribute = attributesManager.getSessionAttributes();
        const requestAttribute = attributesManager.getRequestAttributes();
        const list_name = requestAttribute.t('LIST_NAME');
        const listId = sessionAttribute.listID;
        let speechOutPut = requestAttribute.t('GET_REMAINING_ITEMS_INVALID', list_name);
        let card_text = stripTags(speechOutPut);
        if(sessionAttribute.sessionState !== 'SURVEY'){
            const items = await getToDoItems(handlerInput, listId, listStatuses.ACTIVE);
            if(!items) {
                let  permissions = ['read::alexa:household:list', 'write::alexa:household:list'];
                speechOutPut = requestAttribute.t('PERMISSIONS_MISSING');

                return handlerInput.responseBuilder
                    .speak(speechOutPut)
                    .withAskForPermissionsConsentCard(permissions)
                    .getResponse();

            }else if(items === list_is_empty){
                speechOutPut = requestAttribute.t('REMAINING_ITEMS_EMPTY_LIST', list_name);
                card_text = stripTags(speechOutPut);
            }else{
                if(items.length === 0){
                    speechOutPut = requestAttribute.t('NO_REMAINING_ITEMS');
                }else{
                    let string_completed_items = getStringOfListItems(items);
                    if(items.length > 1){
                        speechOutPut = requestAttribute.t('REMAINING_ITEMS', list_name, string_completed_items);
                    }else{
                        speechOutPut = requestAttribute.t('REMAINING_ITEM', list_name, string_completed_items);
                    }
                }
                card_text = stripTags(speechOutPut);
            }

            //TODO Instructions of what to do next? refer to what prompt use this intent
            speechOutPut += ' <break time=".3s"/>What would you like to do next? If you are not sure, you can say: help.';
        }

        const responseBuilder = handlerInput.responseBuilder;
        return responseBuilder
            .withShouldEndSession(false)
            .withSimpleCard('Remaining List Items', card_text)
            .speak(speechOutPut)
            .getResponse();
    }
};

const NextItemIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'NextItemIntent';
  },
  async handle(handlerInput) {
    console.log("Next item intent");
    let speechText, repromptText;
    const attributesManager = handlerInput.attributesManager;
    const requestAttributes = attributesManager.getRequestAttributes();
    let sessionAttributes =  await attributesManager.getPersistentAttributes() || {};
    let list_items_ids = sessionAttributes.list_items_ids;
    let current_list_id = sessionAttributes.listID;
    const list_name = requestAttributes.t('LIST_NAME');
    const disaster_kit_list = getDisasterKitItems(disaster_list_items, handlerInput.requestEnvelope.request.locale);

    console.log("Starting get todo list call.", sessionAttributes);

    //sanity check: is it appropriate to start giving items
    if(sessionAttributes.sessionState === 'SURVEY'){
        speechText = requestAttributes.t('LIST_STATE_NOT_READY');
        return handlerInput.responseBuilder
            .withShouldEndSession(true)
            .speak(speechText)
            .getResponse();
    }

    if(sessionAttributes.hasReviedAllItems === true){
        const new_list_ids = resetReviewedItems(sessionAttributes.list_items_ids);
        sessionAttributes.list_items_ids = new_list_ids;
        sessionAttributes.hasReviedAllItems = false;
        attributesManager.setSessionAttributes(sessionAttributes);
        attributesManager.setPersistentAttributes(sessionAttributes);
        console.log('new list item ids', new_list_ids);
    }

    //getting to do items
    const items = await getToDoItems(handlerInput, current_list_id, listStatuses.ACTIVE);
    if(!items) {
          let  permissions = ['read::alexa:household:list', 'write::alexa:household:list'];
          speechText = requestAttributes.t('PERMISSIONS_MISSING');

          return handlerInput.responseBuilder
              .speak(speechText)
              .withAskForPermissionsConsentCard(permissions)
              .getResponse();

    }
    else if(items === list_is_empty){
        speechText = requestAttributes.t('LIST_COMPLETE_MESSAGE');
        sessionAttributes.sessionState = 'COMPLETE';
        attributesManager.setSessionAttributes(sessionAttributes);
        attributesManager.setPersistentAttributes(sessionAttributes);
        await attributesManager.savePersistentAttributes();

        return handlerInput.responseBuilder
              .speak(speechText)
              .withShouldEndSession(true)
              .getResponse();
    }
    else{
          let current_list_item = null;
          for(let i = 0;  i < items.length; i++){
              let list_item_skill_id = items[i].id;
              if(list_items_ids.hasOwnProperty(list_item_skill_id)){
                  if(list_items_ids[list_item_skill_id].is_reviewed === false){
                      sessionAttributes.list_items_ids[list_item_skill_id].is_reviewed = true;
                      sessionAttributes.lastListItemID = list_item_skill_id;
                      current_list_item = items[i];
                      break;
                  }
              }
          }
          if(current_list_item == null){ //not in the list
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

              let cur_session_attrs = attributesManager.getSessionAttributes();
              //TODO case where current_list_item!= null and is not a custom item
              //TODO write out text in requestAttributes
              if(current_list_item !== null){
                  sessionAttributes.lastListItemID = current_list_item.id;
                  speechText = "The next item on your list is "+current_list_item.value + ".";
                  repromptText = "The next item on your list is "+current_list_item.value + ". You added this item to your " + list_name + ".";
                  cur_session_attrs.list_items_ids[current_list_item.id] = {'name': current_list_item.value, 'type': 'custom', 'is_reviewed': true}
              }else{
                  cur_session_attrs.hasReviedAllItems = true;
                  speechText = requestAttributes.t('REVIEWED_ALL_ITEMS_SPEECH', list_name);
                  repromptText = requestAttributes.t('REVIEWED_ALL_ITEMS_REPROMPT');
              }

              attributesManager.setSessionAttributes(cur_session_attrs);
              attributesManager.setPersistentAttributes(cur_session_attrs);
              await attributesManager.savePersistentAttributes();

              return handlerInput.responseBuilder
                  .speak(speechText)
                  .reprompt(repromptText)
                  .withShouldEndSession(false)
                  .getResponse();
          }
          else{
              if(list_items_ids.hasOwnProperty(current_list_item.id)){
                  if(list_items_ids[current_list_item.id].hasOwnProperty('type')){
                      sessionAttributes.lastListItemID = current_list_item.id;
                      speechText = "The next item on your list is "+current_list_item.value + ".";
                      repromptText = "The next item on your list is "+current_list_item.value + ". You added this item to your "+ list_name + ".";
                  }else{
                      let nextItem = getListItemsByInternalID(list_items_ids[current_list_item.id].id, disaster_kit_list);
                      nextItem = nextItem[0];

                      sessionAttributes.lastListItemID = current_list_item.id;

                      if(nextItem.hasOwnProperty('use_a')){
                          speechText = "The next item is a " + current_list_item.value +".";
                          if(nextItem.hasOwnProperty('short_description')){
                              speechText += ' '+nextItem.short_description;
                          }
                          repromptText = "The next item is a " + current_list_item.value+".";
                      }else{
                          speechText = "The next item is " + current_list_item.value +".";
                          if(nextItem.hasOwnProperty('short_description')){
                              speechText += ' '+nextItem.short_description;
                          }
                          repromptText = "The next item is " + current_list_item.value+".";
                      }

                      if(nextItem.hasOwnProperty('full_description')){
                          speechText += " To get more information, you can say: more info.";
                      }

                      attributesManager.setSessionAttributes(sessionAttributes);
                      attributesManager.setPersistentAttributes(sessionAttributes);
                      await attributesManager.savePersistentAttributes();

                      if(nextItem.hasOwnProperty('image_small')){
                          return handlerInput.responseBuilder
                              .speak(speechText)
                              .reprompt(speechText)
                              .withShouldEndSession(false)
                              .withStandardCard(nextItem.name, nextItem.full_description, nextItem.image_small, nextItem.image_large)
                              .getResponse();
                      }else{
                          return handlerInput.responseBuilder
                              .speak(speechText)
                              .reprompt(speechText)
                              .withShouldEndSession(false)
                              .withSimpleCard(nextItem.name, nextItem.full_description)
                              .getResponse();
                      }
                  }
              }

              attributesManager.setSessionAttributes(sessionAttributes);
              attributesManager.setPersistentAttributes(sessionAttributes);
              await attributesManager.savePersistentAttributes();

              return handlerInput.responseBuilder
                  .speak(speechText)
                  .reprompt(repromptText)
                  .withShouldEndSession(false)
                  .getResponse();
          }
      }
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const session_attributes = handlerInput.attributesManager.getSessionAttributes();
    const sessionState = session_attributes.sessionState;
    const list_name = requestAttributes.t('LIST_NAME');
    let speechText = '';
    let repromptText = '';
    if(session_attributes.listExists === true){
        speechText = requestAttributes.t('HELP_MESSAGE_LIST_ALREADY_EXISTS', list_name);
    }else if(session_attributes.listMissing  === true){
        speechText = requestAttributes.t('HELP_MESSAGE_LIST_MISSING', list_name);
    }else if(session_attributes.hasReviedAllItems === true){
        speechText = requestAttributes.t('HELP_MESSAGE_ALL_LIST_ITEMS_REVIEWED', list_name);
    }else{
        if(sessionState === 'SURVEY'){
            speechText = requestAttributes.t('HELP_MESSAGE_STATE_SURVEY', list_name);
        }else if(sessionState === 'LIST'){
            speechText = requestAttributes.t('HELP_MESSAGE_STATE_LIST');
        }else if(sessionState === 'COMPLETE'){
            speechText = requestAttributes.t('HELP_MESSAGE_STATE_COMPLETE', list_name );
        }else{
            speechText = requestAttributes.t('HELP_MESSAGE_GENERAL');
        }
    }

    let cardText = stripTags(speechText);
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(repromptText)
      .withSimpleCard('Help', cardText)
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
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    let skill_name = requestAttributes.t('SKILL_NAME');
    const speechText = getRandomArrayItem(requestAttributes.t('GOODBYE_MESSAGES', skill_name));

    return handlerInput.responseBuilder
      .withShouldEndSession(true)
      .speak(speechText)
      .getResponse();
  },
};

const FallBackIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest'
            && request.intent.name === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        console.log('In FallBackIntentHandler');
        let session_attr = handlerInput.attributesManager.getSessionAttributes();
        console.log(session_attr);
        if(session_attr.sessionState === 'SURVEY'){
            return handlerInput.responseBuilder
                .speak('Sorry, I had trouble understanding what you said. You can resume the survey and answer the question again by saying continue.')
                .getResponse();
        }else{
            return handlerInput.responseBuilder
                .speak('Sorry, I had trouble doing what you asked.  Please ask for it again.')
                .reprompt('Sorry, I had trouble doing what you asked.  Please ask for it again.')
                .getResponse();
        }
    },
};


const UnhandledIntent = {
    canHandle() {
        return true;
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        if(sessionAttributes.sessionState === 'SURVEY'){
            const temp_survey_intent = sessionAttributes.temp_SurveyIntent;
            let questionsRemaining = countEmptyFields(temp_survey_intent);
            let init_slot = getNextListItem(questionsRemaining, requestAttributes.t('SURVEY_QUESTIONS_SLOTS'));
            let surveyQuestions = requestAttributes.t('SURVEY_QUESTIONS');
            let speechText = "Sorry, I didn't get that. Please answer the question again. To resume the survey say: continue.";

            return handlerInput.responseBuilder
                .speak(speechText)
                .withShouldEndSession(false)
                .getResponse();
        }

        return handlerInput.responseBuilder
            .speak("I didn't quite get that. Please repeat your request.")
            .getResponse();
    },
};


const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

        return handlerInput.responseBuilder
            .speak("Sorry, an error occurred. The skill will be closed out.")
            .withShouldEndSession(true)
            .getResponse();
    },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  async handle(handlerInput, error) {
      const request = handlerInput.requestEnvelope.request;
      const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
      const session_attrs = handlerInput.attributesManager.getSessionAttributes();
      const skill_name = requestAttributes.t('SKILL_NAME');
      const list_name = requestAttributes.t('LIST_NAME');
      console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);
      console.log(`Error handled: ${error}`);
      console.log(error);
      let speechOutput = 'Sorry an error occurred, I am unable to process your request.';
      if(error.hasOwnProperty('response')){
          if(error.response.message === 'List id does not exists.'){
              session_attrs.listMissing = true;
              speechOutput = requestAttributes.t('LIST_MISSING', list_name)
          }
          else if(error.response.message === 'List name already exists.'){
              session_attrs.listExists = true;
              speechOutput = requestAttributes.t('LIST_EXISTS', list_name);
          }else if(error.response.message === 'List id or Item id does not exist.'){
              speechOutput = requestAttributes.t('LIST_ITEM_NONE_EXISTANT');
          }else if(error.response.hasOwnProperty('Message')){
              if(error.response.Message === 'Request is not authorized.'){
                  speechOutput = requestAttributes.t('GENERAL_PERMISSIONS_MISSING');
            }
          }

          await handlerInput.attributesManager.setSessionAttributes(session_attrs);
          await handlerInput.attributesManager.setPersistentAttributes(session_attrs);
          await handlerInput.attributesManager.savePersistentAttributes();
          return handlerInput.responseBuilder
              .withShouldEndSession(false)
              .speak(speechOutput)
              .getResponse();
      }

      return handlerInput.responseBuilder
          .speak('Sorry, I had trouble doing what you asked.  Please ask for it again.')
          .reprompt('Sorry, I had trouble doing what you asked.  Please ask for it again.')
          .getResponse();
  },
};

/**
 * Helper function to check list permissions
 */
async function hasListPermission(handlerInput){
    if(!handlerInput.requestEnvelope.context.System.user.permissions) {
        return false;
    }
    return true;
}

/**
 * List API to delete the top todo item.
 */
async function updateListItem(handlerInput, listID, listItemID, listItemStatus) {
    const listClient = handlerInput.serviceClientFactory.getListManagementServiceClient();
    const item = await listClient.getListItem(listID, listItemID);

    const updateRequest = {
        value: item.value,
        status: listItemStatus,
        version: item.version,
    };
    return listClient.updateListItem(listID, item.id, updateRequest);
}

/**
 * Helper function to retrieve the top to-do item.
 */
async function getToDoItems(handlerInput, listId, listStatus) {
    const listClient = handlerInput.serviceClientFactory.getListManagementServiceClient();

    console.log(`listid: ${listId}`);
    const list = await listClient.getList(listId, listStatus);
    if (!list) {
        console.log('null list');
        return null;
    } else if (!list.items || list.items.length === 0) {
        console.log('empty list');
        return list_is_empty;
    }
    console.log(`list items found: ${list.items} with first id: ${list.items[0].id}`);
    return list.items;
}


/**
*  General Helper Functions
*/
const disambiguateSlot = async (handlerInput) => {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    let currentRequest = handlerInput.requestEnvelope.request;
    let currentIntent = currentRequest.intent;
    console.log('current slots', currentIntent);
    let has_error = false;
    let error_response = {};
    let has_defined_values = false;

    console.log(currentIntent.slots);
    Object.keys(currentIntent.slots).forEach(function(slotName) {
        let currentSlot = currentIntent.slots[slotName];
        if(typeof currentSlot.value != 'undefined'){
            has_defined_values = true;
        }
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

const getStringOfListItems = (filtered_items) => {
    let list_items_string = '';
    if(filtered_items.length === 1){
        return filtered_items[0].value;
    }else if(filtered_items.length === 2){
        return filtered_items[0].value + ' and '+filtered_items[1].value;
    }

    const filtered_items_length = filtered_items.length;
    for(let i=0; i < filtered_items_length ; i++){
        if( i == (filtered_items_length - 1)){
            list_items_string += 'and '+filtered_items[i].value;
        }else{
            list_items_string += filtered_items[i].value + ', ';
        }
    }

    return list_items_string;

};

const resetReviewedItems = (obj_listitems) => {
    for(const key of Object.keys(obj_listitems)){
        let current_item = obj_listitems[key];
        current_item.is_reviewed = false;
        obj_listitems[key] = current_item;
    }
    return obj_listitems;
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
    CheckOffItemIntentHandler,
    GetCompletedItemsIntentHandler,
    GetRemainingItemsIntentHandler,
    MoreInfoIntentHandler,
    RepeatIntentHandler,
    RestartIntentHandler,
    CreateNewListIntentHandler,
    HelpIntentHandler,
    InProgressSurveyHandler,
    CompletedSurveyHandler,
    CancelAndStopIntentHandler,
    FallBackIntentHandler,
    SessionEndedRequestHandler,
    UnhandledIntent,
  )
  .withPersistenceAdapter(dynamoDbPersistenceAdapter)
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .lambda();