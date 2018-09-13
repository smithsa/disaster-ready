/* eslint-disable  func-names */
/* eslint-disable  no-console */

//PRODUCTION
//TODO Add auto-scaling for Dynamo
//TODO register for aws credits
//TODO fill out skill.json fully

//DEV
//TODO handle first prompts
//TODO handle case for calling, manging, adding items to an archived list
//TODO permission handling at each level
//TODO create repeat Intent
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
      SURVEY_COMPLETE_MESSAGE: 'You have checked off all the items on your Emergency Supply list. Congratulations! <audio src=\'https://s3.amazonaws.com/ask-soundlibrary/human/amzn_sfx_large_crowd_cheer_01.mp3\'/> Thank you for using the Disaster Ready Skill.',
      NEW_SESSION_MESSAGE: 'Welcome to the %s skill. I will walk you through building an emergency supply kit for disasters.<break time=".5s"/> First answer %s short questions so I can consider the unique needs of your home.<break time=".3s"/> You can begin by saying start survey.',
      RETURNING_SESSION_MESSAGE_SURVEY_INCOMPLETE: [
          'Welcome back to the %s skill. Let\'s pick up where we left off. You have %s %s remaining. You can say continue survey to answer the remaining %s.'
      ],
      RETURNING_SESSION_MESSAGE_SURVEY_COMPLETE: [
          'Welcome back to the %s skill.<break time=".5s"/> To get the next item on your %s list you can say "next item" or "next"'
      ],
      START_PERMISSIONS_MISSING: 'Welcome to the %s skill. In order to use this skill you must grant Alexa: list read and write permissions within the Alexa app.',
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
      HELP_MESSAGE_STATE_SURVEY: 'Answer the questions asked so that I can customize your %s list. You can resume the survey by saying continue.',
      HELP_MESSAGE_STATE_LIST: 'To get the next item on your list. Simply say, "next" or "next item."',
      HELP_MESSAGE_GENERAL: 'To get the next item on your list you can say "next" or "next item. To hear all the remaining items on the list can say "review items remaining." To hear the completed items say "review completed items."',
      HELP_MESSAGE_STATE_COMPLETE: 'You have completed all items on your %s list. You can start over by saying restart. Or you can leave the skill by saying exit.',
      HELP_MESSAGE_ALL_LIST_ITEMS_REVIEWED: 'You have reviewed all items on your %s list. To hear all the remaining items on the list can say "review items remaining." To hear the completed items say "review completed items." Or to start over at the top of your list say "next" or "next item."',
      LIST_COMPLETE_MESSAGE_LAUNCH: 'Your %s list has been completed! Great job! You can start over by saying restart. Or leave the skill by saying exit.',
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

    //permission checks
    const permissionCheck = await hasListPermission(handlerInput);
    if(!permissionCheck){
        const permissions = ['read::alexa:household:list', 'write::alexa:household:list'];
        let speechText = requestAttributes.t('START_PERMISSIONS_MISSING', requestAttributes.t('SKILL_NAME'));
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
    const items = await getToDoItems(handlerInput, current_list_id);
    if(!items) {
          let  permissions = ['read::alexa:household:list', 'write::alexa:household:list'];
          speechText = requestAttributes.t('PERMISSIONS_MISSING');

          return handlerInput.responseBuilder
              .speak(speechText)
              .withAskForPermissionsConsentCard(permissions)
              .getResponse();

    }
    else if(items === list_is_empty){
        speechText = requestAttributes.t('SURVEY_COMPLETE_MESSAGE');
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
                      attributesManager.setSessionAttributes(sessionAttributes);
                      attributesManager.setPersistentAttributes(sessionAttributes);
                      await attributesManager.savePersistentAttributes();
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
              if(current_list_item !== null){
                  speechText = "The next item on your list is "+current_list_item.value + ". You added this item to your Emergency Supply Kit list.";
                  repromptText = "The next item on your list is "+current_list_item.value;
                  cur_session_attrs.list_items_ids[current_list_item.id] = {'name': current_list_item.value, 'type': 'custom', 'is_reviewed': true}
              }else{
                  cur_session_attrs.hasReviedAllItems = true;
                  let list_name = requestAttributes.t('LIST_NAME');
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
                      speechText = "The next item on your list is "+current_list_item.value + ". You added this item to your Emergency Supply Kit list.";
                      repromptText = "The next item on your list is "+current_list_item.value;;
                  }else{
                      let nextItem = getListItemsByInternalID(list_items_ids[current_list_item.id].id, disaster_kit_list);
                      nextItem = nextItem[0];

                      if(nextItem.hasOwnProperty('use_a')){
                          speechText = "The next item is a " + current_list_item.value +". "+nextItem.short_description;
                          repromptText = "The next item is a " + current_list_item.value+".";
                      }else{
                          speechText = "The next item is " + current_list_item.value +". "+nextItem.short_description;
                          repromptText = "The next item is " + current_list_item.value+".";
                      }

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
      console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);
      console.log(`Error handled: ${error}`);
      console.log(error);
      if(error.hasOwnProperty('response')){
          if(error.response.message === 'List id does not exists.'){
                  session_attrs.listMissing = true;
                  await handlerInput.attributesManager.setSessionAttributes(session_attrs);
                  await handlerInput.attributesManager.setPersistentAttributes(session_attrs);
                  await handlerInput.attributesManager.savePersistentAttributes();
                  return handlerInput.responseBuilder
                  .withShouldEndSession(false)
                  .speak(requestAttributes.t('LIST_MISSING', requestAttributes.t('LIST_NAME')))
                  .getResponse();
          }
          else if(error.response.message === 'List name already exists.'){
              session_attrs.listExists = true;
              await handlerInput.attributesManager.setSessionAttributes(session_attrs);
              await handlerInput.attributesManager.setPersistentAttributes(session_attrs);
              await handlerInput.attributesManager.savePersistentAttributes();
              return handlerInput.responseBuilder
                  .withShouldEndSession(true)
                  .speak(requestAttributes.t('LIST_EXISTS', requestAttributes.t('LIST_NAME')))
                  .getResponse();
          }
      }

      return handlerInput.responseBuilder
          .speak('Sorry, I had trouble doing what you asked.  Please ask for it again.')
          .reprompt('Sorry, I had trouble doing what you asked.  Please ask for it again.')
          .getResponse();
  },
};

/**
 * Check List Permissions
 */
async function hasListPermission(handlerInput){
    if(!handlerInput.requestEnvelope.context.System.user.permissions) {
        return false;
    }
    return true;
}

/**
 * Helper function to retrieve the top to-do item.
 */
async function getToDoItems(handlerInput, listId) {
    const listClient = handlerInput.serviceClientFactory.getListManagementServiceClient();

    console.log(`listid: ${listId}`);
    const list = await listClient.getList(listId, listStatuses.ACTIVE);
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