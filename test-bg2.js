const fs = require('fs');
let code = fs.readFileSync('background.js', 'utf8');
const chrome = {
  action: { onClicked: { addListener: () => {} } },
  runtime: { 
    onMessage: { addListener: () => {} },
    getURL: () => ''
  }
};
eval(code);
console.log("SUCCESS!");
