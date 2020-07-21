ChromaGL
========
Chroma key a `<video>` in realtime using the GPU

Requirements
------------
Browser with ([WebGL 2 support](https://caniuse.com/#feat=webgl2)). The `hasWebGL2()` method is provided to test support.

API
---
`ChromaGL(source, target)`: Object constructor

- source = Source video, image or canvas element to key
- target = Target canvas element on which to paint keyed image(s)


`.hasWebGL2()`: returns true if browser supports WebGL 2, else false


`.source(source)`: Sets a new source video, image or canvas element to key.

- source = canvas/img/video object


`.target(target)`: Sets a new target canvas on which to paint keyed image(s).

- target = canvas object


`.key([key] [, ...keyN])`: Sets one or more key configurations, replacing any previous key(s). Calling without parameters will clear all keys.

- key = any of the following:
	- the string `'auto'`
	- array of color values like `[r, g, b]` (single key color with default `tolerance`)
	- array of objects with properties:
		- `color` (required): the string `'auto'` or an array of color values like `[r, g, b]`
		- `tolerance`: float ranged 0-1 (default=`0.3`)


`.render(clear)`: Updates frame from video and paints to canvas  

- clear: true/false whether to clear the canvas first


`.paint()`: Re-paints current frame to canvas  


To Do
-----
* Add WebGL framebuffer/texture to acceptable source media types
* Add WebGL framebuffer/texture as acceptable target instead of canvas
* Provide more complete examples
* Allow external static image as alpha mask?
* Alternate color spaces (currently uses YUV)
* Optimize fragment shader
