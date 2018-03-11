'use strict';

const SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');
const fs = require('fs');
const async = require('async');
const extend = require('extend');
const {credential, STT_CUSTOM_MODEL_NAME, STT_BASE_MODEL_NAME} = require('./config');

const speechToText = new SpeechToTextV1 (credential);

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

    const params = {
      name: STT_CUSTOM_MODEL_NAME,
      base_model_name: STT_BASE_MODEL_NAME,
      description: 'Custom language model',
      content_type: 'application/json',
    };

    speechToText.createAcousticModel(params, function(error, newModel) {
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

const getCustomModelId = (callback) => {
  speechToText.getCustomizations(null, (error, result) => {
    if (result) {      
      const custModel = result.customizations.find(custModel => custModel.name === STT_CUSTOM_MODEL_NAME);
      if (custModel) {
        console.log('custom model id : ' + custModel.customization_id);
        callback(custModel.customization_id);
        return;
      }
    }
  });
};


const whenCustomizationReady = function (params, callback) {
  const self = this;

  // check the customization status repeatedly until it's ready or available
  const options = extend(
    {
      interval: 5000,
      times: 30
    },
    params
  );
  options.errorFilter = function(err) {
    // if it's a timeout error, then getCustomization is called again after params.interval
    // otherwise the error is passed back to the user
    // if the params.times limit is reached, the error will be passed to the user regardless
    return err.code === SpeechToTextV1.ERR_TIMEOUT;
  };
  async.retry(
    options,
    function(next) {
      speechToText.getAcousticModel(params, function(err, customization) {
        if (err) {
          next(err);
        } else if (
          customization.status === 'pending' ||
          customization.status === 'training'
        ) {
          // if the loop times out, async returns the last error, which will be this one.
          err = new Error(
            'Customization is still pending, try increasing interval or times params'
          );
          err.code = SpeechToTextV1.ERR_TIMEOUT;
          next(err);
        } else if (
          customization.status === 'ready' ||
          customization.status === 'available'
        ) {
          next(null, customization);
        } else if (customization.status === 'failed') {
          next(new Error('Customization training failed'));
        } else {
          next(
            new Error(
              'Unexpected customization status: ' + customization.status
            )
          );
        }
      });
    },
    callback
  );
}

const trainAcousticModel = (acousticModelId) => {
  getCustomModelId(sttCustomModelId => {
    if (sttCustomModelId) {
      whenCustomizationReady({
        customization_id: acousticModelId,
        interval: 10000    
      }, (error, customization) => {
        if (error) {
          console.log('whenCustomizationReady Error: ', error);          
        } else {
          console.log('start training');          
          const params = {
            customization_id: acousticModelId,
            custom_language_model_id: sttCustomModelId,
          };
          speechToText.trainAcousticModel(params, function(error, response) {
            if (error)
              console.log('train Error: ', error);
            else
              console.log('Success to train acoustic data');
          });        
        }
      });
          
  
    }
    else {
      console.log('There is no custom model');
    }
  });
};

const addAudio = (audioName, contentType, containedContentType, inputFile) => {
  getAcousticCustomModelId(acousticModelId => {
    if (acousticModelId) {
      // const stream = fs.createReadStream(inputFile);        
      const params = {
        customization_id: acousticModelId,
        audio_name: audioName,
        content_type: contentType,
        'allow_overwrite': true,
        'audio_resource': fs.createReadStream(inputFile), 
      };

      if (containedContentType) {
        params.contained_content_type = containedContentType;
      }

      speechToText.addAudio(params, function(error, response) {
        if (error) {
          console.log('addCorpus Error: ', error);
        }
        else {
          trainAcousticModel(acousticModelId);
        }
      });
    } else {
      console.log('There is no model for ' + STT_BASE_MODEL_NAME);
    }
  });
};

const listAudio = () => {
  getAcousticCustomModelId(acousticModelId => {
    if (acousticModelId) {        
      const params = {
        customization_id: acousticModelId,
      };

      speechToText.listAudio(params, function(error, corpora) {
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
    const audioName = process.argv[3]
    const contentType = process.argv[4];
    let containedContentType;
    let inputFile;

    if (contentType === 'application/zip' || contentType === 'application/gzip') {
      containedContentType = process.argv[5];
      inputFile = process.argv[6]
      if (!containedContentType || !inputFile) {
        console.log('node acoustic add <audio name> <content type> <contained content type> <zipped audio file>')
      }
    }
    else {
      inputFile = process.argv[5];
      if (!inputFile) {
        console.log('node acoustic add <audio name> <content type> <audio file>')
      }
    }

    addAudio(audioName, contentType, containedContentType, inputFile);
    break;
  case 'list':
    listAudio();
    break;
  default:
    console.log('node acoustic [command] [arg]')
    console.log('node acoustic add <audio name> <content type> <contained content type> <zipped audio file>')
    console.log('node acoustic add <audio name> <content type> <audio file>')
    console.log('node acoustic list')
    break;
}

