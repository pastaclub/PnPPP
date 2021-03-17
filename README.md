# PnPPP - Pick & Place Pre-Processor

PnPPP is a tool for automatically converting PCB assembly files to the format required by your fab or machine,
automatically rotate parts to the correct orientation and duplicate pick-and-place data with new positions
for the purpose of panelization.

The tool was developed to process output files from Altium CircuitStudio for use with JLCPCB's self-service
PCBA interface, but it can be configured flexibly and potentially be used with other CAD programs and
different fabs.

## Features

* Parse and re-generate BOM (bill of materials) and PNP (pick and place) files in CSV format
* Continuously scan sub directories of a given file path for changes and automatically process changed files
* Rename, re-order and delete columns in BOM and PNP files
* Strip empty lines from incoming CSV files to make them compliant (what were you thinking, Altium?)
* Move output files to alternate destination path
* Auto-rotation: rotate parts in pick-and-place file based on per-component setting in the BOM file
* Customizable through a config file in JSON format

## Auto-Rotation

I frequently ran into the problem that orientation of a part in my library was different than what the fab
(in my case JLCPCB) expected. As a result, the rotation of the part was wrong in the fab's preview. There
were two ways to fix this: either rotating the graphics in the footprint (which breaks the design) or manually
editing the generated pick-and-place file and adding an offset to the rotation of all affected components.

PnPPP solves this problem once and for all: PnPPP automatically rotates components where needed and
generates a modified pick-and-place file in the format the fab expects. In order to do this, PnPPP first
needs to know which components need to be rotated and by what offset. A different tool relies on a seperate
file which contains a list of all components to be rotated and the respective angles... from a logical point
of view however, I found it more appropriate to not have yet another file and instead specify this piece
of information directly in the component library. To achieve this, I am using a custom parameter named
`JlcRotation` on every schematic symbol that needs rotation. This parameter is exported as a column in the
BOM and then added by PnPPP to the rotation of all instances of the respective component.

Note that `Rotation` is a mandatory per-instance parameter (i.e. it can be different for each instance of
a component on the PCB), while `JlcRotation` is an optional per-symbol parameter (i.e. it is set only once
per each schematic symbol and applied to all instances of the part). The engineers at Altium in their
infinite wisdom provided no possibility for CircuitStudio users to configure which fields to export as part
of a pick-and-place file, therefore PnPPP pulls this information out of the BOM and then applies it on the
pick-and-place data.

So whenever you find the rotation of a part to be incorrect, you can simply open the schematic symbol in
your library, add a `JlcRotation` parameter, and let PnPPP do the work. From then on, whenever you use
the `Generate outputs` feature, PnPPP will know what to do and automatically fix your pick-and-place files.

By the way: you don't have to use the name `JlcRotation` for the parameter. You can configure a custom
parameter name in `config.json` so your library could even contain different rotation offsets for different
fabs.

## Installation

PnPPP is an application based on NodeJS. It was developed and tested on a Mac, processing files on a
network volume shared with the Windows PC running CircuitStudio.
PnPPP will most probably work just fine on a Linux or Windows PC with NodeJS - I just cannot give
specific installation instructions. The following is what works on Mac:

1. Install NodeJS (and npm, which is normally included) if you don't already have them
2. Clone the repository, and in that folder run `npm install` to install the dependencies

## Operation

1. Edit the `config.json` file (see Configuration)
2. Run `npm start`. It will keep running and process any changed files
3. Generate output files in CircuitStudio - PnPPP will automatically detect and process those
4. Abort PnPPP by pressing `ctrl+c`

*Important:* for Auto-Rotation and Panelization to work, make sure you (re-)generate BOTH a PNP and a BOM file
for a project at least once after PnPPP is started. It is NOT sufficient to generate just one of them, even if
the other one already exists. This is related to the non-deterministic order of processing changes and data
caching. You can easily ensure this by using the `Generate outputs` dialog in CircuitStudio and ticking the relevant checkboxes.

## Configuration (only required once)

- `baseDir`: Specify a base path, i.e. the topmost directory to scan. All your PCB projects should be sub-directories of that one. It does not matter how deep the tree is, as all sub folders will be scanned. Currently only absolute paths are supported for `baseDir`.
- `bom`, `pnp`: Specify regular expressions that match the filenames of BOM and PNP files. They are matched against absolute paths of the files changed. The default expressions in the config file match the default names that CircuitStudio uses. There must be two capture groups within a RegEx: the path to the PCB project and the name of the project that CircuitStudio puts into the filename.
- You can specify which columns of the file you want to appear in the output file and also change the column names. The property name in the JSON is the original
column name and the value is the new name.
- In the default config, the tool assumes that CircuitStudio is set up to output an additional column named "LCSC" in the PNP file (which is used by JLCPCB to identify the component to be populated). You can remove that line in the config if not used.
- `autoRotation`: you can configure whether autoRotation is enabled or not. If enabled, you have to specify the name of the parameter in the BOM file
which specifies the additional rotation of its instances.

## How to set up CircuitStudio

- In the Schematic editor, add the parameter LCSC to a symbol to associate the part number JLC will use for PCBA.
- In the Schematic editor, add the parameter JlcRotation to any symbol you want auto-rotated and set the desired angle.
- In the PCB editor, go to `Project > Generate outputs`
- In the BOM section, enable the checkbox and click on `Configure`
- In the list of columns on the left side, check `JlcRotation` (this is only shown if at least one component in your project uses it)
- Under File Format, select `CSV`, then click `OK`
- Back in the `Generate outputs` dialog, under `Assembly`, check `Pick and place` and also configure it to output `CSV`
- Now whenever you click `Generate` in this dialog, PnPPP will automatically process the output files. That is, if PnPPP is running of course, duh :)
