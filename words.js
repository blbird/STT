'use strict';

const SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');
const fs = require('fs');
const {credential, STT_CUSTOM_MODEL_NAME, STT_BASE_MODEL_NAME} = require('./config');

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
    'customization_id': sttCustomModelId
  };

  speechToText.trainCustomization(params, function(error, response) {
    if (error)
      console.log('trainCustomization Error: ', error);
    else
      console.log('Success to add words');
  });
};

// check availability of training of stt custom model
const checkAndTrainSTT = (sttCustomModelId) => {  
  const params = {
    'customization_id': sttCustomModelId,
    interval: 10000
  };
  
  speechToText.whenCustomizationReady(params, (error, customization) => {
    if (error) {
      console.log('whenCustomizationReady Error: ', error);          
    } else {
      trainSTT(sttCustomModelId);
    }
  });
};

const makeWordsFromFile = (inputFile, callback) => {
  fs.readFile(inputFile, 'utf8', function(err, data) {
    if (err) {
      console.log('File read error : ', err);
      callback(null);
      return;
    }

    const allLines = data.split(/\r\n|\n/);

    // Reading line by line
    const words = allLines.map((line) => {
      if (line && line.length > 0) {
        const word = line.replace(/ /gi, '_');
        const newWord = {
          word,
          'display_as': line          
        };
        return newWord;
      }
      return null;
    }).filter((word) => word !== null);

    callback(words);
  });
};

const addWords = (inputFile) => {
  getCustomModelId(sttCustomModelId => {
    if (sttCustomModelId) {
      fs.readFile(inputFile, 'utf8', function(err, data) {
        if (data) {
          let wordsData;
          try {
            wordsData = JSON.parse(data);
          } catch(err) {
            console.log(err);
            return ;
          }

          const params = {
            'customization_id': sttCustomModelId,
            words: wordsData
          };
    
          speechToText.addWords(params, function(error, response) {
            if (error) {
              console.log('addWords Error: ', JSON.stringify(error));
            }
            else {
              checkAndTrainSTT(sttCustomModelId);
            }
          });
        } else {
          console.log('there is no word to train in ' + inputFile);    
        }
      });
    } else {
      console.log('there is no model for ' + sttCustomModelName);
    }
  });
};

const getWords = () => {
  getCustomModelId(sttCustomModelId => {
    if (sttCustomModelId) {
      const params = {
        'customization_id': sttCustomModelId
      };

      speechToText.getWords(params, function(error, words) {
        if (error)
          console.log('Error:', error);
        else
          console.log(JSON.stringify(words, null, 2));
      });
    } else {
      console.log('there is no model for ' + sttCustomModelName);
    }
  });
};

const speechToText = new SpeechToTextV1 (credential);

const command = process.argv[2];
switch(command) {
  case 'add': 
    const inputFile = process.argv[3];
    if (!inputFile) {
      console.log('node corpus add sentencefile')
    }
    addWords(inputFile);
    break;
  case 'list':
    getWords();
    break;
  default:
    console.log('node words [command] [arg]')
    console.log('node words add wordsfile')
    console.log('node words list')
    break;
}


