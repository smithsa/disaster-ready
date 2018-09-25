# Disaster Ready (Alexa Skill)

Disaster Ready, a skill built for the Amazon Alexa Tech for Social Good Challenge, walks users through assembling an emergency supply kit for disasters or other emergencies. First, the skill gives a short survey, so the unique needs of the user’s home can be considered when their list is created. Then a custom emergency supply kit list is generated in their Alexa App.

The user can access and manage the list through the skill or on their mobile phone in the Alexa app. Having the emergency supply list on their phone in their todo lists section serves as a reminder to the user that they are building kit and allows them to work on it outside of the skill. When the user uses the skill, supply list items are listed off one by one and recommendations for each item are given as well. In addition, the user can check or uncheck the item on the list or receive more detailed information about how and when they might use the supply item in cases of an emergency or a disaster.

![disaster ready screenshot](https://s3.amazonaws.com/disasterready/in-use-screenshot.jpg)

[View Demo](https://youtu.be/Opmnp5Y1HdU)

## Prerequisites
*  [Node.js (4.5 or greater)](https://nodejs.org)
*  [Node Package Manager (npm)](https://www.npmjs.com/)
*  [AWS Account](https://aws.amazon.com/getting-started/) - You will need to use [Lambda](https://aws.amazon.com/lambda/), [DynamoDB](https://aws.amazon.com/dynamodb/), and access to the [Alexa Skills Kit Developer Console](https://developer.amazon.com/alexa/console/ask)

## Installation

1. Set up AWS IAM user. An AWS account is required since the skill will use Lambda. Additionally, you will need an AWS IAM user. Ensure that your AWS credentials are set up with the appropriate permissions on the computer to which you are installing ASK CLI. For more information on this step see Amazon's documentation: [Set Up Credentials for an Amazon Web Services (AWS) Account](https://developer.amazon.com/docs/smapi/set-up-credentials-for-an-amazon-web-services-account.html).

2. Install ASK CLI. Please reference Amazon's ["Quick Start Alexa Skills Kit Command Line Interface"](https://developer.amazon.com/docs/smapi/quick-start-alexa-skills-kit-command-line-interface.html) if you are having trouble with this step.
	'''npm install -g ask-cli'''

3. Initialize ASK CLI
	'''ask init'''

4. Create a new skill project. The newly created skill project folder will contain all necessary files to deploy it with minimal changes. You will replace these files with those in the repository eventually. 
	'''ask new'''

5. Clone the Disaster Ready project
	'''git clone git@github.com:smithsa/disaster-ready.git'''

6. Copy contents of the newly cloned repository into the project you created at step 4.

7. Ensure the name of the skill you used for step 4 matches in "skill.json." Additionally, set invocation name in models/en-US.json.

8. Deploy the code to AWS Lambda
	'''ask deploy'''

## Usage

You can test and run the skill through the command line or the Alexa Skills Kit Developer Console.

**Command Line**
Run the command below. For more information on this command refer to Alexa's [Simulate Command Documentaiton](https://developer.amazon.com/docs/smapi/ask-cli-command-reference.html#simulate-command)
'''ask simulate -t [insert command here]'''

**Alexa Skills Kit Developer Console**
You can navigate to the [Alexa Skills Kit Developer Console](https://developer.amazon.com/alexa/console/ask). Select the skill you are workig on, and select the "Test" tab menu item at the top of the page. You can open the skill by typing "open [your skill name]." You can enter any other commands as well.

Refer to Amazon's [Alexa Skills Kit Developer Console: Test](https://www.youtube.com/watch?v=lYImJ2H__BY) video from more instruction on how to test withing the console.

To understand the commands you can give the skill watch the [view demo](https://youtu.be/Opmnp5Y1HdU).

## Built With
*  [ASK SDK v2](https://github.com/alexa/alexa-skills-kit-sdk-for-nodejs)
*  [Node](https://nodejs.org)
*  [AWS Lambda](https://aws.amazon.com/lambda/)
*  [AWS DynamoDB](https://aws.amazon.com/dynamodb/)
