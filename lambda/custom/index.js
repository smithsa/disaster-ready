/* eslint-disable  func-names */
/* eslint-disable  no-console */

//TODO Add auto-scaling for Dynamo
//TODO register for aws credits
//TODO use database saves sparingly, rely on session until application closes
//TODO fill out skill.json fully
//TODO handle first prompts
//TODO to emit and call another intent just call the function
//TODO see if I can handle synonyms - can take care of this in unhandled - you can also have one singular unhandled intent. Make sure that it’s last in the argument list and that canHandle always returns true. That way, anything not otherwise handled will fall on through.
const Alexa = require('ask-sdk-core');

//DynamoDb Memory Persistence
const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
const dynamoDbPersistenceAdapter = new DynamoDbPersistenceAdapter({ tableName : 'disaster_ready_session_data', createTable: true });

//Requests
const https = require("https");
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');
const disaster_kit_list_items = require('./list-items');

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
      LIST_ITEMS: disaster_kit_list_items.LIST_ITEMS_EN_US,
      SKILL_NAME: 'Disaster Kit Ready',
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
      NEW_SESSION_MESSAGE: 'Welcome to the %s skill, where I will walk you through building an emergency supply kit for disasters.<break time=".5s"/> First answer %s short questions so I can consider the unique needs of your home.<break time=".3s"/> How many people are in your household?',
      RETURNING_SESSION_MESSAGE_SURVEY_INCOMPLETE: 'Welcome back to the %s skill. Let\'s pick up where we left off. You have %s %s remaining. Please answer the following %s. <break time=".8s"/> %s',
      RETURNING_SESSION_MESSAGE_SURVEY_COMPLETE: 'Welcome back to the %s skill. To get the next item on your list you can say "next item" or "next"',
    },
  },
  'en-US': {
    translation: {
      LANG_SKILL_NAME: 'Disaster Kit Ready (American)'
    },
  },
  'en-GB': {
    translation: {
      LANG_SKILL_NAME: 'Disaster Kit Ready (British)'
    },
  }
};

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
        attributes.surveyComplete = false;
        attributes.sessionState = 'SURVEY';  //SESSION STATES [SURVEY, LIST, COMPLETE]
        attributes.currentListItem = 1;

        speechText = requestAttributes.t('NEW_SESSION_MESSAGE', requestAttributes.t('SKILL_NAME'), surveyQuestions.length)+'<break time=".5s"/> ';
        card_text = stripTags(speechText);
    }else{
        const temp_survey_intent = attributes.temp_SurveyIntent;
        questionsRemaining = countEmptyFields(temp_survey_intent);
        if(questionsRemaining > 0){
            let nextSurveyQuestion = getNextListItem(questionsRemaining, surveyQuestions);
            let question_text = (questionsRemaining == 1) ? 'question' : 'questions';
            speechText = requestAttributes.t('RETURNING_SESSION_MESSAGE_SURVEY_INCOMPLETE', requestAttributes.t('SKILL_NAME'), questionsRemaining, question_text, question_text, nextSurveyQuestion);
            card_text = stripTags(speechText);
        }else{
            speechText = requestAttributes.t('RETURNING_SESSION_MESSAGE_SURVEY_COMPLETE', requestAttributes.t('SKILL_NAME'));
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
        let repromptText = 'You can say next or next item';
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

        const attributesManager = handlerInput.attributesManager;
        //const current_attributes = await attributesManager.setSessionAttributes;
        const current_attributes = await attributesManager.getPersistentAttributes() || {};
        //session attributes are not updated here
        current_attributes.sessionState = 'LIST';
        handlerInput.attributesManager.setPersistentAttributes(current_attributes);
        handlerInput.attributesManager.setSessionAttributes(current_attributes);

        await handlerInput.attributesManager.savePersistentAttributes();

        console.log('completed survey handler');
        const responseBuilder = handlerInput.responseBuilder;

        let speechOutput = 'Thank you for answering my questions. I am now ready to create your disaster kit list for your specific needs. ';
        speechOutput += 'To get the next item on your list you can say \"next item\" or \"next\"';

        return responseBuilder
            .speak(speechOutput)
            .getResponse();
    },
};

const HelloWorldIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'HelloWorldIntent';
  },
  handle(handlerInput) {
    const speechText = 'Hello World!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Hello World', speechText)
      .getResponse();
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
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak('Sorry, I can\'t understand the command. Please say again.')
      .reprompt('Sorry, I can\'t understand the command. Please say again.')
      .getResponse();
  },
};

//*** Helper Functions
function disambiguateSlot(handlerInput) {
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

function slotHasValue(request, slotName) {

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

function isSlotValid(request, slotName){
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

function getRandomArrayItem(myArray){
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

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    HelloWorldIntentHandler,
    HelpIntentHandler,
    InProgressSurveyHandler,
    CompletedSurveyHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .addRequestInterceptors(LocalizationInterceptor)
  .withPersistenceAdapter(dynamoDbPersistenceAdapter)
  .addErrorHandlers(ErrorHandler)
  .lambda();