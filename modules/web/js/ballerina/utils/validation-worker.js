import axios from 'axios';
import { WORKER_MESSAGE_TYPES } from './../views/constants';

let parserEndpoint;

function fetchParserEndpoint() {
    // PRODUCTION is a global variable set by webpack DefinePlugin
    // it will be set to "true" in the production build.
    let configUrl = '';
    if (PRODUCTION !== undefined && PRODUCTION) {
        configUrl = '/config';
    } else {
        // following is to support development mode where the config service is on 9091
        configUrl = 'http://localhost:9091/config';
    }
    return axios(configUrl)
        .then((response) => {
            return response.data.services ? response.data.services.parser.endpoint : undefined;
        });
}

fetchParserEndpoint()
    .then((endpoint) => {
        parserEndpoint = endpoint;
    });

// Respond to message from parent thread
onmessage = (event) => {
    const { data: { type, args: { fileName, filePath, content } } } = event;
    if (type === WORKER_MESSAGE_TYPES.VALIDATION_REQUEST) {
        if (parserEndpoint) {
            const payload = {
                fileName,
                filePath,
                content,
                includeProgramDir: true,
            };
            const headers = {
                'content-type': 'application/json; charset=utf-8',
            };
            axios.post(parserEndpoint, payload, { headers })
                .then((response) => {
                    postMessage({
                        type: WORKER_MESSAGE_TYPES.VALIDATION_RESPONSE,
                        args: {
                            errors: response.data.errors,
                        },
                    });
                });
        }
    }
};
