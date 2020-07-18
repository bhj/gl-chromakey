ChromaGL
========
Chroma key a `<video>` in realtime using the GPU

Requirements
------------
Browser with ([WebGL 2 support](https://caniuse.com/#feat=webgl2)). The method `hasWebGL()` is provided to test support.

API
---
`ChromaGL(source, target)`: Object constructor

- source = canvas/img/video object
- target = canvas object


`.hasWebGL()`: returns true if browser supports WebGL, else false


`.source(source)`: Set source containing video or image to key. Can be changed after object creation.  

- source = canvas/img/video object


`.target(target)`: Set target canvas on which to paint keyed image. Can be changed after object creation.

- target = canvas object


`.addChromaKey(keys, channel)`: add one or more chroma key configurations. returns array of key id's, in case you want to remove them later

- keys = array or single of key parameters, any of the following formats:
	- string: 'blue' or 'green' color preset
	- array of 3 numbers: RGB color
	- object: params for color/pre-rendered key
		- `color` (required): 'blue' or 'green' or array of 3 numbers
		- `threshold`: Euclidean distance cutoff
		- `fuzzy`: float >= 1.0, multiple of threshold as outer limit of feathering
		- `channel`: select an output channel (overrides `channel` parameter to method)
- channel: select an output channel 0 = red, 1 = blue, 2 = green


`.removeChromaKey(id)`  

- id = single or array of integers of keys to delete


`.setThreshold(id, threshold, fuzzy)`: Change chroma key parameters for distance threshold

- id = key to modify
- threshold = Euclidean distance cutoff
- fuzzy (optional) = float >= 1.0, multiple of threshold as outer limit of feathering


`.render(clear)`: Updates frame from video and paints to canvas  

- clear: true/false whether to clear the canvas first


`.paint()`: Re-paints current frame to canvas  


Notes
-----

To Do
-----
* Add WebGL framebuffer/texture to acceptable source media types
* Add WebGL framebuffer/texture as acceptable target instead of canvas
* Provide more complete examples
* Add method/option for scaling?
* Add method for modifying source/alpha dimensions?
* Allow external static image as alpha mask?
* Alternate color spaces (currently uses YUV)
* Add key mode: luminance
* Optimize fragment shader.
