const fs = require('fs');
const watch = require('node-watch');
const csv = require('csv');
    
var config;
var cache = {};

function quit(msg) {
  console.log('ERROR: ', msg);
  process.exit(1);
}

function selectColumns(data, colConfig) {  // restrict to relevant columns and rename them
  for (var i=0; i<data.length; i++) {
    var part = {};
    Object.keys(colConfig).forEach((oldColName) => {
      var newColName = colConfig[oldColName];
      part[newColName] = data[i][oldColName];
    });
    data[i] = part;        
  }
}

function writeCSV(data, fileName) {
  console.log('Writing '+fileName);
  csv.stringify(data, {header: true, quoted: true, record_delimiter:"\r\n"}, (err, output) => {
    if (err) quit('Unable to transform data back into CSV');
    fs.writeFileSync(fileName, output);
  })
}

function processPnp(data, projectPath) {
  selectColumns(data, config.pnp.columns); // restrict to relevant columns and rename them
  writeCSV(data, projectPath + config.pnp.outputFileName); // generate new pick and place file
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

  const matchBom = fileName.match(bomRegEx);
  const matchPnp = fileName.match(pnpRegEx);  
  if (matchPnp) {
    console.log('Processing '+fileName);

    // read file and split into lines
    console.log('Processing '+fileName);
    var lines = fs.readFileSync(fileName).toString().split(/\r?\n/);

    // remove empty lines
    var text = '';
    for (var i=0; i<lines.length; i++) if (lines[i].length > 5) text += lines[i] + "\r\n";

    // parse CSV
    csv.parse(text, {columns: true}, (err, data) => {
      if (err) quit('Unable to parse CSV');
      if (matchPnp) processPnp(data, matchPnp[1]);
    }); 
  }
});
