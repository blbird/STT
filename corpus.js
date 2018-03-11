'use strict';

const SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');
const fs = require('fs');
const {credential, STT_CUSTOM_MODEL_NAME, STT_BASE_MODEL_NAME} = require('./config');

const speechToText = new SpeechToTextV1 (credential);

const getCustomModelId = (callback) => {
  speechToText.getCustomizations(null, (error, result) => {
    if (result) {      
      const custModel = result.customizations.find(custModel => custModel.name === STT_CUSTOM_MODEL_NAME);
      if (custModel) {
        console.log('id : ' + custModel.customization_id);
        callback(custModel.customization_id);
        return;
      }
    }

    const params = {
      name: STT_CUSTOM_MODEL_NAME,
      base_model_name: STT_BASE_MODEL_NAME,
      description: 'Custom language model'
    };

    speechToText.createCustomization(params, function(error, newModel) {
      if (error) {
        console.log('Error:', error);
        callback(null);
      }
      else {
        callback(newModel.customization_id);
      }
    });
  });
};

const trainSTT = (sttCustomModelId) => { 
  const params = {
    customization_id: sttCustomModelId
  };

  speechToText.trainCustomization(params, function(error, response) {
    if (error)
      console.log('train Error: ', error);
    else
      console.log('Success to add corpus');
  });
};

// check availability of training of stt custom model
const checkAndTrainSTT = (sttCustomModelId) => {  
  const params = {
    customization_id: sttCustomModelId,
    interval: 10000
  };
  
  speechToText.whenCustomizationReady(params, (error, customization) => {
    if (error) {
      console.log('whenCustomizationReady Error: ', error);          
    } else {
      console.log('start training');          
      trainSTT(sttCustomModelId);
    }
  });
};

const addCorpus = (corpusName, inputFile) => {
  getCustomModelId(sttCustomModelId => {
    if (sttCustomModelId) {
      // const stream = fs.createReadStream(inputFile);        
      const params = {
        customization_id: sttCustomModelId,
        name: corpusName,
        'corpus_file': fs.createReadStream(inputFile), 
        'allow_overwrite': true,
      };
      speechToText.addCorpus(params, function(error, response) {
        if (error) {
          console.log('addCorpus Error: ', JSON.stringify(error));
        }
        else {
          checkAndTrainSTT(sttCustomModelId);
        }
      });
    } else {
      console.log('There is no model for ' + STT_BASE_MODEL_NAME);
    }
  });
};

const listCorpus = () => {
  getCustomModelId(sttCustomModelId => {
    if (sttCustomModelId) {        
      const params = {
        customization_id: sttCustomModelId,
      };

      speechToText.listCorpora(params, function(error, corpora) {
        if (error)
          console.log('Error:', error);
        else
          console.log(JSON.stringify(corpora, null, 2));
      });
    } else {
      console.log('There is no model for ' + STT_BASE_MODEL_NAME);
    }
  });
}

const command = process.argv[2];
switch(command) {
  case 'add': 
    const corpusName = process.argv[3];
    const inputFile = process.argv[4];
    if (!corpusName || !inputFile) {
      console.log('node corpus add <corpus name> <corpus file>')
    }
    addCorpus(corpusName, inputFile);
    break;
  case 'list':
    listCorpus();
    break;
  default:
    console.log('node corpus [command] [arg]')
    console.log('node corpus add <corpus name> <corpus file>')
    console.log('node corpus list')
    break;
}

