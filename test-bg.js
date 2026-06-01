const fs = require('fs');
let code = fs.readFileSync('background.js', 'utf8');
// mock chrome API
const chrome = {
  action: { onClicked: { addListener: () => {} } },
  runtime: { onMessage: { addListener: () => {} } }
};
eval(code);

messageHandlers.fetchImageAsBase64('https://www.google.com/favicon.ico').then(console.log).catch(console.error);
