# PnPPP - Pick & Place Pre-Processor

PnPPP is a tool for automatically converting PCB assembly files to the format required by your Fab or machine.
The tool was developed to process output files from Altium CircuitStudio for use with JLCPCB's self-service
PCBA interface, but it can be configured flexibly and potentially be used with other tools and fabs.

PnPPP parses and re-generates BOM (bill of materials) and PNP (pick and place) files in CSV format.

## Features:

* Continuously scan sub directories of a given file path for changes and automatically process changed files
* Rename, re-order and delete columns in BOM and PNP files
* Strip empty lines from incoming CSV files
* Move output files to alternate destination path
* Customizable through a config file in JSON format

## Installation:

PnPPP was developed and tested on a Mac, processing files on a network volume shared with the Windows PC running CircuitStudio.
PnPPP will most probably work fine under Windows once you have NodeJS installed - I just cannot tell you how.

1. Install NodeJS and NPM if you don't have them already
2. Clone the repository, change to the directory and run `npm install` to install the dependencies

## Operation

1. Edit the `config.json` file.
    - You have to specify a base path, i.e. the topmost directory to scan. All your PCB projects should be sub-directories of that one. It does not matter how deep the tree is, as all sub folders will be scanned.
    - You also have to specify regular expressions that specify the filenames of BOM and PNP files. They are matched against absolute paths of the files changed. The default expressions in the config file match the default names that CircuitStudio uses. There are two capture groups within a RegEx: the path to the PCB project and the name of the project that CircuitStudio puts into the filename.
    - You can specify which columns of the file you want to appear in the output file and also change the column names.
    - In the default config, the tool assumes that CircuitStudio is set up to output an additional column named "LCSC" in the PNP file (which is used by JLCPCB to identify the component to be populated). You can remove that line in the config if not used.
2. Run `npm start`. It will keep running and process any changes until you abort it with `ctrl+c`
3. Generate output files in CircuitStudio - PnPPP will automatically detect and process those.
    - *Important:* after running the tool, you will need to update BOTH a PNP and a BOM file for a project at least once, i.e. it is not sufficient to generate only a PNP file. This is due to the fact that the order in which file changes are detected is non-deterministic and PnPPP will wait for both files to be present, so it can use
    information from one file in the other (which is necessary for auto-rotation and panelization). You can easily ensure this by using the `Generate outputs` dialog in CircuitStudio and ticking the relevant checkboxes.