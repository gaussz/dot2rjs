#dot2rjs

dot-watcher can watch and precompile doT.js templates file to Requirejs module file
but it just support the .jst templates file and inline defines, does not support the .def or the .dot predefine file

### Installation:

```	
npm install -g dot2rjs
```

###Usage:  

```
dot2rjs [-w] [-o <output folder>] <src path|template file>
```

###Options:

		-h, --help             output usage information
    -V, --version          output the version number
    -o, --output <folder>  output folder path. if this option is off, the compiled .js file will save to the folder 
    											 which the sources template file in
    -w, --watch            watch the rebuild on the source folder and rebuild if the source template file was changed
	

###Example:
	
Create a doT.js template (src/ui/sample.jst).
	<div>Hi {{=it.name}}!</div>
	<div>{{=it.age || ''}}</div>

dot2rjs -o lib/ src/ -w
	
then you will get lib/ui/sample.js.
if you not specified the --output option, you will find the precompiled js in src/ui/

in your web application, you can use the precompiled js in this way:
```
define(['ui/sample'],function(sampleui){
	container.innerHTML = sampleui({
  	name: "guoshun",
  	age : "32" 
	});	
});
```
