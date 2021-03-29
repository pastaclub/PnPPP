const fs = require('fs');
const watch = require('node-watch');
const csv = require('csv');
    
var config;
var cache = {};

function readConfig() {
  var config;
  try {
    config = JSON.parse(fs.readFileSync('config.json'));
  } catch (e) {
    quit('Error parsing config.json');
  }
  return config;
}

function quit(msg) {
  console.log('ERROR: ', msg);
  process.exit(1);
}

function selectColumns(data, colConfig) {  // restrict to relevant columns and rename them
  var data2 = [];
  for (var i=0; i<data.length; i++) {
    var part = {};
    Object.keys(colConfig).forEach((oldColName) => { // copy relevant columns
      var newColName = colConfig[oldColName];
      part[newColName] = data[i][oldColName];
    });
    part.autoRotation = data[i][config.autoRotation.parameter]; // copy auto-rotation parameter
    data2[i] = part;
  }
  return data2;
}

function removeExtraFields(data) { // remove extra fields not wanted in CSV output
  var data2 = [];
  data.forEach((item) => {
    item = Object.assign({}, item); // copy
    delete item.autoRotation;
    if (item.Designator != config.panelization.designator) data2.push(item);
  });
  return data2;
}

function writeCSV(data, fileName) {
  console.log('Writing '+fileName);
  csv.stringify(data, {header: true, quoted: true, record_delimiter:"\r\n"}, (err, output) => {
    if (err) quit('Unable to transform data back into CSV');
    fs.writeFileSync(fileName, output);
  })
}

function processBom(data, projectPath) {
  data = selectColumns(data, config.bom.columns); // restrict to relevant columns and rename them
  cache['bom_'+projectPath] = data;
  data = removeExtraFields(data);
  if (cache['pnp_'+projectPath]) crossProcess(projectPath); // if we also have PNP, cross-process
  else writeCSV(data, projectPath + config.bom.outputFileName); // otherwise just generate new BOM file
}

function processPnp(data, projectPath) {
  data = selectColumns(data, config.pnp.columns); // restrict to relevant columns and rename them
  cache['pnp_'+projectPath] = data;
  data = removeExtraFields(data);
  if (cache['bom_'+projectPath]) crossProcess(projectPath); // if we also have BOM, cross-process
  else writeCSV(data, projectPath + config.pnp.outputFileName); // otherwise just generate new pick and place file
}

function parseValue(str) {
  var value = parseFloat(str);
  var unit = str.substr(value.toString(10).length);
  return {value, unit};
}

function crossProcess(projectPath) { // combine info from BOM and PNP
  var bom = cache['bom_'+projectPath];
  var pnp = cache['pnp_'+projectPath];
  var bom2 = [];
  var pnp2 = [];

  // get panelization data from BOM
  var panel;
  bom.forEach((bomItem) => {
    if (bomItem.Designator == config.panelization.designator) {
      panel = bomItem.Comment.split(',');
      panel.forEach((value, index) => {
        panel[index] = parseFloat(value);
      });
      panel = {
        columns:  panel[0],
        rows:     panel[1],
        xOffset:  panel[2],
        yOffset:  panel[3],
        xSpacing: panel[4],
        ySpacing: panel[5]
      }
    }
  });
  if (panel) console.log('Panelization data found for a '+panel.columns+'x'+panel.rows+' panel');
  else console.log('No '+config.panelization.designator+' designator in BOM => Panelization disabled for this project');

  // build map of pnp items
  var pnpMap = {};
  pnp.forEach((pnpItem) => {
    pnpMap[pnpItem.Designator] = pnpItem;
  });

  // iterate over BOM
  var rotateCount = 0;
  bom.forEach((bomItem) => {
    bomItem = Object.assign({}, bomItem); // copy item (to prevent mutating the cached original)
    var designators = bomItem.Designator.split(', '); // get all designators for current BOM item
    var designators2 = [];
    designators.forEach((designator, index) => {  // iterate over all instances of current item
      var pnpItem = pnpMap[designator];
      if (pnpItem) {
        pnpItem = Object.assign({}, pnpItem); // copy item (to prevent mutating the cached original)

        // auto-rotation
        if (config.autoRotation.enabled) {
          var oldRotation = (parseFloat(pnpItem.Rotation) + 360) % 360;
          pnpItem.Rotation = (oldRotation + (parseFloat(bomItem.autoRotation) || 0) + 360) % 360;
          if (pnpItem.Rotation != oldRotation) {
            console.log('Auto-rotating '+designator+': '+oldRotation+' -> '+pnpItem.Rotation);
            rotateCount++;
          }
          pnpItem.Rotation = pnpItem.Rotation.toFixed(2);
        }

        // panelization
        if (panel) {
          for (var y=0; y<panel.rows; y++)
            for (var x=0; x<panel.columns; x++) {
              var pnpItem2 = Object.assign({}, pnpItem);
              pnpItem2.Designator = pnpItem.Designator + '_PX' + x + 'Y' + y;
              designators2.push(pnpItem2.Designator);
              var vx = parseValue(pnpItem[config.panelization.xName]);
              var vy = parseValue(pnpItem[config.panelization.yName]);
              pnpItem2[config.panelization.xName] = (panel.xOffset + x * panel.xSpacing + vx.value).toFixed(4) + vx.unit;
              pnpItem2[config.panelization.yName] = (panel.xOffset + y * panel.ySpacing + vy.value).toFixed(4) + vy.unit;
              pnp2.push(pnpItem2);
          }
        } else pnp2.push(pnpItem);

      }
    });
    if ((panel) && (bomItem.Designator != config.panelization.designator)) {
      bomItem.Designator = designators2.join(', '); // replace designators in BOM with panelized list (but not the PnPPP_Panel itself)
    }
    bom2.push(bomItem);
  });
  console.log(rotateCount + ' components were auto-rotated.');

  bom2 = removeExtraFields(bom2);
  pnp2 = removeExtraFields(pnp2);
  writeCSV(bom2, projectPath + config.bom.outputFileName);
  writeCSV(pnp2, projectPath + config.pnp.outputFileName);
}

function detectFileChanges() {
  // watch for file changes
  console.log('Watching '+config.baseDir+' for file changes...');
  const bomRegEx = new RegExp(config.bom.filePattern);
  const pnpRegEx = new RegExp(config.pnp.filePattern);
  watch(config.baseDir, {recursive: true}, function(ev, fileName) {
    if (ev != 'update') return; // we only care about update events

    const matchBom = fileName.match(bomRegEx);
    const matchPnp = fileName.match(pnpRegEx);  
    if (matchBom || matchPnp) {
  
      // read file and split into lines
      console.log('Parsing '+fileName);
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
}

// --- MAIN PROGRAM ---
config = readConfig();
detectFileChanges();
