'use strict';

const mic = require('mic');
const SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');
const readline = require('readline');
const {credential, STT_CUSTOM_MODEL_NAME, STT_BASE_MODEL_NAME} = require('./config');

// create STT module
const speechToText = new SpeechToTextV1(credential);

// initialize mic device
const newMicDevice = function(recognizeStream) {
	const micInstance = mic({ 'rate': '16000', 'channels': '1', 'debug': false, 'exitOnSilence': 10 });
	const micInputStream = micInstance.getAudioStream();

	micInputStream.on('data', function(data) {
		process.stdout.write('#');
	});

	micInputStream.on('error', function(err) {
		console.log('Error in Input Stream: ' + err);
	});

	micInputStream.on('startComplete', function() {
		console.log('Got SIGNAL startComplete');
	});

	micInputStream.on('stopComplete', function() {
		console.log('\nGot SIGNAL stopComplete');
	});

	micInputStream.on('silence', function() {
		console.log('\nThere is no recognized data');
		micInstance.stop();
		recognizeStream.stop();		
	});

	return micInstance;
};

// get acoustic customization model id
const getAcousticCustomModelId = (callback) => {
  speechToText.listAcousticModels(null, (error, result) => {
    if (result) {      
      const custModel = result.customizations.find(custModel => custModel.name === STT_CUSTOM_MODEL_NAME);
      if (custModel) {
        console.log('acoustic model id : ' + custModel.customization_id);
        callback(custModel.customization_id);
        return;
      }
    }
  });
};

// Get customization id for a specific model name
const getCustomizationId = function(callback) {
	speechToText.getCustomizations(null, (error, result) => {
		const custModel = result  && result.customizations ? result.customizations.find(custModel => custModel.name === STT_CUSTOM_MODEL_NAME) : null;

		if (custModel) {
			callback(custModel.customization_id);
			return;
		}
		callback(null);
	});
}

// get input stream from mic and recognize stream
const startRecording = function() {
	const params = {
		'content-type': 'audio/l16; rate=16000; channels=1',
		model: STT_BASE_MODEL_NAME,
		timestamps: true,
		smart_formatting: true
	};

	getAcousticCustomModelId(acousticId => {
		if (acousticId) {
			params.acoustic_customization_id = acousticId;
			console.log('acoustic id : ' + params.acoustic_customization_id);
		}

		getCustomizationId(customId => {
			if (customId) {
				params.customization_id = customId;
				console.log('custom id : ' + params.customization_id);
			}

			// create stream
			const recognizeStream = speechToText.createRecognizeStream(params);

			const micInstance = newMicDevice(recognizeStream);

			// event for getting transcirpt
			recognizeStream.on('data', function(event) { 
				let resultTranscript = event.toString();

				micInstance.stop();
				recognizeStream.stop();
			
				console.log('transcript : ' + resultTranscript);		
			});

			recognizeStream.on('error', function(event) { 
				console.log('STT error : ', event);
			});
			
			recognizeStream.on('close', function(event) { 
				rl.setPrompt('Please press enter key >>> ');
				rl.prompt();		
			});

			micInstance.getAudioStream().pipe(recognizeStream);
			micInstance.start();
		});
	});
};

// wait for enter key
const rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt('Please press enter key >>> ');
rl.prompt();
rl.on('line', (line) => {
	console.log('start');
	startRecording();
});

