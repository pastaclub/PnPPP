const fs = require('fs');
const watch = require('node-watch');
const csv = require('csv');
    
var config;
var cache = {};

const quit = (msg) => {
  console.log('ERROR: ', msg);
  process.exit(1);
}

// read config
try {
  config = JSON.parse(fs.readFileSync('config.json'));
} catch (e) {
  quit('Error parsing config.json');
}

// watch for file changes
console.log('Watching '+config.baseDir+' for file changes...');
const pnpRegEx = new RegExp(config.pnp.filePattern);
const matchPnp = fileName.match(pnpRegEx);
watch(config.baseDir, {recursive: true}, function(ev, fileName) {
  if (ev != 'update') return; // we only care about update events
  console.log('%s changed.', fileName);

  // pick and place file
  if (matchPnp) {
    console.log('Processing '+fileName);
    var projectPath = matchPnp[1];

    // read file and split into lines
    var lines = fs.readFileSync(fileName).toString().split(/\r?\n/);

    // remove empty lines
    var text = '';
    for (var i=0; i<lines.length; i++) if (lines[i].length > 5) text += lines[i] + "\r\n";
 
    csv.parse(text, {columns: true}, (err, pnp) => {
      if (err) quit('Unable to parse pick and place file');
 
      // restrict to relevant columns and rename them
      for (var i=0; i<pnp.length; i++) {
        var part = {};
        Object.keys(config.pnp.columns).forEach((oldColName) => {
          var newColName = config.pnp.columns[oldColName];
          part[newColName] = pnp[i][oldColName];
        });
        pnp[i] = part;        
      }

      // generate new pick and place file
      const pnpOutputFileName = projectPath + config.pnp.outputFileName;
      console.log('Writing '+fileName);
      csv.stringify(pnp, {header: true, quoted: true, record_delimiter:"\r\n"}, (err, output) => {
        if (err) quit('Unable to transform pick and place data back into CSV');
        fs.writeFileSync(pnpOutputFileName, output);
      })
  });
  }
});
