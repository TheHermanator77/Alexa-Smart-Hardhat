/* *
 * This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
 * Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
 * session persistence, api calls, and more.
 * */
const Alexa = require('ask-sdk-core');
const https = require('https');
const API_BASE_URL = "https://smart-hardhat.onrender.com";
const API_KEY = "hardhat123";

/*
  Helper function: GET latest helmet impact data from backend
*/
function getLatestHelmetData() {
    return new Promise((resolve, reject) => {
        const url = `${API_BASE_URL}/api/impact/latest`;

        https.get(url, {
            headers: {
                "x-api-key": API_KEY
            }
        }, (res) => {

            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                // If the response is empty, return an empty object
                if (!data) {
                    resolve({});
                    return;
                }

                try {
                    const parsed = JSON.parse(data);

                    // If the backend returned an error, treat as empty
                    if (parsed.error) {
                        resolve({});
                    } else {
                        resolve(parsed);
                    }
                } catch (err) {
                    // Catch JSON parsing errors and resolve empty object instead of crashing
                    resolve({});
                }
            });

        }).on('error', err => {
            // Network errors still reject
            reject(err);
        });
    });
}

function sendRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            method,
            headers: {
                "Content-Type": "application/json",
                "x-api-key": API_KEY
            }
        };

        const req = https.request(`${API_BASE_URL}${path}`, options, (res) => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    resolve(data ? JSON.parse(data) : {});
                } catch (err) {
                    resolve({});
                }  

            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Smart Hard Hat online. You can ask for helmet status, report impacts, update nickname or clear helmet data.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const GetHelmetStatusIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetHelmetStatusIntent';
    },

    async handle(handlerInput) {
        const data = await getLatestHelmetData();
        console.log("BACKEND DATA:", JSON.stringify(data));
        let speakOutput = 'Helmet data is currently unavailable.';

        if (data && Object.keys(data).length > 0) {
            let impactDescription = "unknown";

            if (data.impact === 1) impactDescription = "light";
            else if (data.impact === 2) impactDescription = "hard";
            else if (data.impact === 3) impactDescription = "severe";
            
            speakOutput = `The latest recorded impact was ${impactDescription}.`;


            if (data.g_force !== undefined) {
                speakOutput += ` The measured g force was ${data.g_force}.`;
            }

            if (data.light_state === 'dark') {
                speakOutput += ' Lighting conditions are dark.';
            }
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const ReportImpactIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ReportImpactIntent';
    },
    async handle(handlerInput) {
        try {
            const result = await sendRequest("POST", "/api/impact", {
                impact: 1,
                light: "normal",
                g_force: 2.5,
                light_raw: 512
            });

            if (result.error) {
                return handlerInput.responseBuilder
                    .speak("Failed to record impact. Please try again later.")
                    .getResponse();
            }

            return handlerInput.responseBuilder
                .speak("Impact has been recorded.")
                .getResponse();
        } catch (err) {
            return handlerInput.responseBuilder
                .speak("Unable to contact the helmet backend at this time.")
                .getResponse();
        }
    }
};

const ToggleHeadlampIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ToggleHeadlampIntent';
    },
   async handle(handlerInput) {
    const state = handlerInput.requestEnvelope.request.intent.slots.state.value;
    const speakOutput = `Turning the helmet light ${state}.`;

    return handlerInput.responseBuilder
        .speak(speakOutput)
        .getResponse();
    }
};

const ResetHelmetIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ResetHelmetIntent';
    },
    async handle(handlerInput) {
        try {
            const result = await sendRequest("DELETE", "/api/events");

            if (result.error) {
                return handlerInput.responseBuilder
                    .speak("Failed to clear helmet data. Please try again later.")
                    .getResponse();
            }

            return handlerInput.responseBuilder
                .speak("Helmet impact history has been cleared.")
                .getResponse();
        } catch (err) {
            return handlerInput.responseBuilder
                .speak("Unable to contact the helmet backend at this time.")
                .getResponse();
        }
    }
};

const UpdateNicknameIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'UpdateNicknameIntent';
    },
    async handle(handlerInput) {
        const nickname = handlerInput.requestEnvelope.request.intent.slots.nickname
            && handlerInput.requestEnvelope.request.intent.slots.nickname.value;

        const owner_name = handlerInput.requestEnvelope.request.intent.slots.owner_name
            && handlerInput.requestEnvelope.request.intent.slots.owner_name.value;

        if (!nickname && !owner_name) {
            return handlerInput.responseBuilder
                .speak("No nickname or owner name was provided.")
                .getResponse();
        }

        try {
            const result = await sendRequest("PUT", "/api/hardhat", { nickname, owner_name });

            if (result.error) {
                return handlerInput.responseBuilder
                    .speak("Failed to update helmet info. Please try again later.")
                    .getResponse();
            }

            return handlerInput.responseBuilder
                .speak("Helmet information has been updated.")
                .getResponse();
        } catch (err) {
            return handlerInput.responseBuilder
                .speak("Unable to contact the helmet backend at this time.")
                .getResponse();
        }
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can ask about helmet status, report an impact, turn the headlamp on or off, or reset the helmet data.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye. Stay safe.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I did not understand that. Try one of these commands: "what is the helmet status?", "report an impact", "turn headlamp on" or "clear data".';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        return handlerInput.responseBuilder.getResponse();
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Sorry, I had trouble accessing helmet data.';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        GetHelmetStatusIntentHandler,
        ReportImpactIntentHandler,
        ToggleHeadlampIntentHandler,
        ResetHelmetIntentHandler,
        UpdateNicknameIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler
    )
    .addErrorHandlers(ErrorHandler)
    .withCustomUserAgent('sample/smart-hard-hat/v1.0')
    .lambda();