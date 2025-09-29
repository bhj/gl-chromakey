# gl-chromakey

Chroma key a video/image/canvas element in real time using the GPU via [WebGL 2](https://caniuse.com/#feat=webgl2).

- Supports multiple key colors with adjustable tolerance, edge smoothness and spill correction
- Supports automatic background color detection (best with solid backgrounds)
- Designed for [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame) (when used with video)
- No dependencies

## Installation

```
$ npm i gl-chromakey
```

## API

### `new GLChroma(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, target: HTMLCanvasElement | WebGL2RenderingContext)`

- `source`: Source video, image or canvas element to key
- `target`: Target canvas element on which to paint keyed image(s)

```js
import GLChroma from 'gl-chromakey'

const video = document.getElementById('source-video')
const canvas = document.getElementById('target-canvas')

// initialize with source video and target canvas
const chroma = new GLChroma(video, canvas)

```

### `.key(...keys: Key[]): GLChromaKey`

Sets one or more key colors, **replacing any prior settings**. Calling without parameters clears all keys.

- `key`: any of the following:
	- the string `'auto'`
	- an RGB color in array form `[r, g, b]`
	- an object with properties:
		- `color` (required): the string `'auto'` or an RGB color in the form `[r, g, b]`
		- `tolerance`: Color tolerance; float ranged 0-1. Higher values result in a larger range of colors being keyed (default=`0.1`)
		- `smoothness`: Edge smoothness; float ranged 0-1. Higher values result in more transparency near the key color (default=`0.1`)
		- `spill`: Spill suppression; float ranged 0-1. Higher values result in more desaturation near the key color (default=`0.1`)

The auto key color mode downsamples the source image, grabs each corner pixel, and keys on the two pixels with the most similar color. It works best on videos or images with simplistic backgrounds, and can cause flickering if the algorithm gets it wrong. Use with caution.

**Examples:**

```js
// auto-detect background color
chroma.key('auto')

// which is equivalent to:
chroma.key({ 
  color: 'auto', 
  tolerance: 0.1,
  smoothness: 0.1,
  spill: 0.1
})
```

```js
// specify a very, very greenscreen
chroma.key([0, 255, 0])

// which is equivalent to:
chroma.key({ 
  color: [0, 255, 0], 
  tolerance: 0.1,
  smoothness: 0.1,
  spill: 0.1
})
```

### `.render(options?: RenderOptions): GLChromaKey`

Processes the source element's current frame and paints to the target canvas. 

 - `options`: optional object with render settings:
   - `passthrough`: Boolean to skip chroma key processing and draw the source frame verbatim (default=`false`)

The following excerpt shows usage with a video element and a [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame) loop:

```js
let frameId

// methods for render loop
const startChroma = () => {
  frameId = requestAnimationFrame(startChroma)
  chroma.render()
}
const stopChroma = () => cancelAnimationFrame(frameId)

// follow <video> element events
video.addEventListener('play', startChroma)
video.addEventListener('pause', stopChroma)
video.addEventListener('ended', stopChroma)
```

### `.source(el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): GLChromaKey`

Sets a new source video, image or canvas element to key.

- `el`: the new video/image/canvas element

### `.target(canvas: HTMLCanvasElement | WebGL2RenderingContext): GLChromaKey`

Sets a new target canvas on which to paint keyed image(s). The context `webgl2` will be used.

- `canvas`: the new [`HTMLCanvasElement`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas) element

## Utility methods

### `.getContentBounds(): [x1: number, y1: number, x2: number, y2: number]`

Returns the coordinates of a bounding box around the non-transparent pixels in the target canvas. Meant to be called immediately after `render()`.

### `.supportsWebGL2(): boolean`

Returns whether the browser [supports WebGL 2](https://caniuse.com/#feat=webgl2).

## Demo & Development

1. Clone the repo
2. Place your video file in the `public` folder
3. Update the `videoUrl` in `src/demo.js`, and optionally the video or canvas attributes in `index.html`
4. `npm i`
5. `npm run dev`


## Acknowledgements

- Based on [work by Brian Chirls](https://github.com/brianchirls/ChromaGL)
