/* eslint-disable  func-names */
/* eslint-disable  no-console */
//TODO Add auto-scaling for Dynamo
//TODO register for aws credits
const Alexa = require('ask-sdk-core');
const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
const dynamoDbPersistenceAdapter = new DynamoDbPersistenceAdapter({ tableName : 'disaster_ready_session_data', createTable: true });

//Example of persistence attributes
//https://github.com/alexa/skill-sample-nodejs-highlowgame/blob/master/lambda/custom/index.js
//Perhaps use these methods attached to this for the save and retrieve: dynamoDbPersistenceAdapter

// const PersistentAttributesHandler = {
//   canHandle(handlerInput) {
//     return new Promise((resolve, reject) => {
//       handlerInput.attributesManager.getPersistentAttributes()
//         .then((attributes) => {
//           resolve(attributes.foo === 'bar');
//         })
//         .catch((error) => {
//           reject(error);
//         })
//     });
//   },
//   handle(handlerInput) {
//     return new Promise((resolve, reject) => {
//       handlerInput.attributesManager.getPersistentAttributes()
//         .then((attributes) => {
//           attributes.foo = 'bar';
//           handlerInput.attributesManager.setPersistentAttributes(attributes);

//           return handlerInput.attributesManager.savePersistentAttributes();
//         })
//         .then(() => {
//           resolve(handlerInput.responseBuilder
//             .speak('Persistent attributes updated!')
//             .getResponse());
//         })
//         .catch((error) => {
//           reject(error);
//         });
//     });
//   },
// };
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.setPersistentAttributes(handlerInput.requestEnvelope.session);
    const sessionAttributes2 = attributesManager.getPersistentAttributes();
    const userId  = handlerInput.requestEnvelope.session.user;
    console.log('atts', userId);
    console.log('session', sessionAttributes2);
    const speechText = 'Welcome to the Alexa Skills Kit, you can say hello!';

    // const attributes = await attributesManager.getPersistentAttributes() || {};
    // if (Object.keys(attributes).length === 0) {
    //   attributes.endedSessionCount = 0;
    //   attributes.gamesPlayed = 0;
    //   attributes.gameState = 'ENDED';
    // }

    // attributesManager.setSessionAttributes(attributes);

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('Hello World', speechText)
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

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    HelloWorldIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .withPersistenceAdapter(dynamoDbPersistenceAdapter)
  .addErrorHandlers(ErrorHandler)
  .lambda();