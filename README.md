# gl-chromakey

Chroma key a video/image/canvas element in real time using the GPU. Based on [work by Brian Chirls](https://github.com/brianchirls/ChromaGL).

- Supports multiple key colors and adjustable tolerances
- Supports automatic background color keying
- Designed for [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame) (when used with video)
- Uses [WebGL 2](https://caniuse.com/#feat=webgl2) (`hasWebGL2()` is provided to test browser support)
- No dependencies

## Installation

```
$ npm i gl-chromakey
```

## API

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

### `.hasWebGL2()`

Returns true if browser supports WebGL 2, else false.

### `.key([key] [, ...keyN])`

Sets one or more key colors in RGB, **replacing any prior settings**. Calling without parameters clears all key colors.

- `key`: any of the following:
	- the string `'auto'`
	- array of color values like `[r, g, b]` (keys a single color with default `tolerance`)
	- array of objects with properties:
		- `color` (required): the string `'auto'` or an array of color values like `[r, g, b]`
		- `tolerance`: float ranged 0-1 (default=`0.3`)

Some examples:

```js
// detect background color per-frame (works best with solid backgrounds)
chroma.key('auto')
chroma.key({ color: 'auto', tolerance: 0.3 }) // equivalent to above

// a screen that's green
chroma.key([0, 255, 0])

// screens that are green and very blue indeed
chroma.key([0, 255, 0], [0, 255, 255])
```

### `.paint()`

Re-paints current frame to canvas.

### `.render()`

Updates frame from source element and paints to target canvas. The following excerpt shows its use with a video element and a [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame) loop to update the video frames:

```js
let frameId

// methods for render loop
startChroma = () => {
  frameId = requestAnimationFrame(startChroma)
  chroma.render()
}
stopChroma = () => cancelAnimationFrame(frameId)

// link to <video> element
video.addEventListener('play', startChroma)
video.addEventListener('pause', stopChroma)
video.addEventListener('ended', stopChroma)
```

### `.source(el)`

Sets a new source video, image or canvas element to key.

- `el`: the new video/image/canvas element

### `.target(canvas)`

Sets a new target canvas on which to paint keyed image(s). The context `webgl2` will be used.

- `canvas`: the new [`HTMLCanvasElement`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas) element

## License

[ISC](https://opensource.org/licenses/ISC)
