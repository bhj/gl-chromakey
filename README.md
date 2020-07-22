# gl-chromakey

Chroma key a video/image/canvas element in real time using the GPU

## Requirements

Browser with [WebGL 2 support](https://caniuse.com/#feat=webgl2). The `hasWebGL2()` method is provided to test support.

## Installation

```
$ npm i gl-chromakey
```

## Usage

### `new GLChroma(source, target)`

- `source`: Source video, image or canvas element to key
- `target`: Target canvas element on which to paint keyed image(s)

```js
const GLChroma = require('gl-chromakey')
const video = document.getElementById('my-video')
const canvas = document.getElementById('my-canvas')

// set source video and target canvas elements
const chroma = new GLChroma(video, canvas)

```

## Methods

### `.key([key] [, ...keyN])`

Sets one or more key colors, replacing any previously configured colors. Calling with no parameters clears all key colors.

- `key`: any of the following:
	- the string `'auto'`
	- array of color values like `[r, g, b]` (keys a single color with default `tolerance`)
	- array of objects with properties:
		- `color` (required): the string `'auto'` or an array of color values like `[r, g, b]`
		- `tolerance`: float ranged 0-1 (default=`0.3`)

### `.render(clear)`

Updates frame from source element and paints to canvas.

```js
let frameId

// methods for render loop
startChroma = () => {
  frameId = requestAnimationFrame(startChroma)
  chroma.render()
}
stopChroma = () => cancelAnimationFrame(frameId)

video.addEventListener('play', startChroma)
video.addEventListener('pause', stopChroma)
video.addEventListener('ended', stopChroma)
```

- clear: true/false whether to clear the canvas first

### `.source(source)`

Sets a new source video, image or canvas element to key.

- source = canvas/img/video object


### `.target(target)`

Sets a new target canvas on which to paint keyed image(s).

- target = canvas object


### `.paint()`

Re-paints current frame to canvas  

### `.hasWebGL2()`

Returns true if browser supports WebGL 2, else false.

## License

[ISC](https://opensource.org/licenses/ISC)
