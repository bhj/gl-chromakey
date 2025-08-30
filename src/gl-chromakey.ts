import fragmentShaderPaintSrc from './lib/shaders/fragmentShaderPaint.js'
import vertexShaderSrc from './lib/shaders/vertexShader.js'
import ShaderProgram from './lib/ShaderProgram.ts'
import FrameBuffer from './lib/FrameBuffer.ts'

type Key
  = 'auto'
    | [r: number, g: number, b: number]
    | {
      color: [r: number, g: number, b: number] | 'auto'
      /**
       * Color tolerance; float ranged 0-1. Higher values result in a larger range of colors being keyed.
       * @default 0.1
       */
      tolerance?: number
      /**
       * Edge smoothness; float ranged 0-1. Higher values result in more transparency near the key color.
       * @default 0.1
       */
      smoothness?: number
      /**
       * Spill suppression; float ranged 0-1. Higher values result in more desaturation near the key color.
       * @default 0.1
       */
      spill?: number
      /**
       * Enable debug visualization for the auto key color detection
       * @default false
       */
      debug?: boolean
    }

interface RenderOptions {
  /**
   * If true, skips chroma key processing and draws source frame verbatim
   * @default false
   */
  passthrough?: boolean
}

interface ExtendedWebGLBuffer extends WebGLBuffer {
  itemSize: number
  numItems: number
}

interface ExtendedWebGLTexture extends WebGLTexture {
  image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  width: number
  height: number
}

interface MediaData {
  ready: string
  load: string
  width: string
  height: string
  readyTarget?: boolean | number
}

type MediaElement = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement

const nodeData: Record<string, MediaData> = {
  video: {
    ready: 'readyState',
    load: 'canplay',
    width: 'videoWidth',
    height: 'videoHeight',
  },
  img: {
    ready: 'complete',
    load: 'load',
    width: 'width',
    height: 'height',
  },
  canvas: {
    ready: 'complete',
    load: 'load',
    width: 'width',
    height: 'height',
  },
}

class GLChromaKey {
  private _gl: WebGL2RenderingContext | null = null
  private _keys: Key[] = []
  private _media: MediaElement | null = null
  private _data: MediaData | null = null
  private _initialized = false
  private _mediaTexture: ExtendedWebGLTexture | null = null
  private _paintShader: ShaderProgram | null = null
  private _alphaFramebuffer: FrameBuffer | null = null
  private _downsampleCanvas: HTMLCanvasElement | null = null
  private _downsampleContext: CanvasRenderingContext2D | null = null
  private _vertexPositionBuffer: ExtendedWebGLBuffer | null = null
  private _vertexIndexBuffer: ExtendedWebGLBuffer | null = null
  private _texCoordBuffer: ExtendedWebGLBuffer | null = null
  private _vertexArrayObject: WebGLVertexArrayObject | null = null
  private _downsampleWidth = 16
  private _downsampleHeight = 16
  private _hasAutoKeys = false

  /**
   * Creates a new GLChromaKey instance
   * @param source Source video, image or canvas element to key
   * @param target Target canvas element on which to paint keyed image(s)
   */
  constructor (source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, target: HTMLCanvasElement | WebGL2RenderingContext) {
    if (!this.supportsWebGL2()) {
      throw new Error('Browser does not support WebGL 2')
    }

    this._keys = []
    this.source(source)
    this.target(target)

    this.buildWebGlBuffers()
    this._initialized = true

    this.checkReady()
  }

  private buildWebGlBuffers () {
    // For potential performance optimization: consider using line_strip or fan in the future
    const gl = this._gl!

    // Create and configure vertex position buffer for the quad (rectangle covering the canvas)
    const vertexPositionBuffer = gl.createBuffer() as ExtendedWebGLBuffer
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer)
    const vertexPositions = new Float32Array([
      -1, -1, 0, // bottom left
      1, -1, 0, // bottom right
      1, 1, 0, // top right
      -1, 1, 0, // top left
    ])
    gl.bufferData(gl.ARRAY_BUFFER, vertexPositions, gl.STATIC_DRAW)
    vertexPositionBuffer.itemSize = 3 // x, y, z coordinates
    vertexPositionBuffer.numItems = 4 // 4 vertices

    // Create and configure texture coordinate buffer (maps texture to vertices)
    const texCoordBuffer = gl.createBuffer() as ExtendedWebGLBuffer
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
    const textureCoords = new Float32Array([
      0, 1, // bottom left
      1, 1, // bottom right
      1, 0, // top right
      0, 0, // top left
    ])
    gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW)
    texCoordBuffer.itemSize = 2 // u, v coordinates
    texCoordBuffer.numItems = 4 // 4 vertices

    // Create and configure index buffer (defines triangles using vertex indices)
    const vertexIndexBuffer = gl.createBuffer() as ExtendedWebGLBuffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer)
    const triangleIndices = new Uint16Array([
      0, 2, 1, // first triangle
      0, 3, 2, // second triangle
    ])
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangleIndices, gl.STATIC_DRAW)
    vertexIndexBuffer.itemSize = 1 // single index per vertex
    vertexIndexBuffer.numItems = 6 // 6 indices (2 triangles × 3 vertices)

    // Store buffers for later use
    this._vertexPositionBuffer = vertexPositionBuffer
    this._vertexIndexBuffer = vertexIndexBuffer
    this._texCoordBuffer = texCoordBuffer

    // Create VAO to encapsulate vertex setup (optimization for repeated draws)
    this._vertexArrayObject = gl.createVertexArray()
  }

  private setUpShaders () {
    const gl = this._gl!
    let keyFunctions = ''
    this._hasAutoKeys = false

    this._keys.forEach((key: Key) => {
      // Convert RGB values to normalized 0-1 range for GLSL or use auto-detection
      const keyObj = typeof key === 'string' ? { color: key } : Array.isArray(key) ? { color: key } : key

      if (keyObj.color === 'auto') {
        this._hasAutoKeys = true
      }

      const color = (keyObj.color === 'auto')
        ? 'auto()'
        : `vec3(${keyObj.color[0] / 255}, ${keyObj.color[1] / 255}, ${keyObj.color[2] / 255})`

      const tolerance = isNaN(keyObj.tolerance as number) ? 0.1 : (keyObj.tolerance as number).toFixed(3)
      const smoothness = isNaN(keyObj.smoothness as number) ? 0.1 : (keyObj.smoothness as number).toFixed(3)
      const spill = isNaN(keyObj.spill as number) ? 0.1 : (keyObj.spill as number).toFixed(3)

      keyFunctions += `pixel = ProcessChromaKey(vTexCoord, ${color}, ${tolerance}, ${smoothness}, ${spill});\n`

      if (keyObj.debug) {
        keyFunctions += 'debug();\n'
      }
    })

    // Clean up any existing resources
    if (this._paintShader) this._paintShader.unload()
    if (this._alphaFramebuffer) this._alphaFramebuffer.unload()
    this._downsampleCanvas = null
    this._downsampleContext = null

    // Create shader program with source code
    this._paintShader = new ShaderProgram(
      gl,
      vertexShaderSrc as string,
      (fragmentShaderPaintSrc as string).replace('%keys%', keyFunctions),
    )

    // Create framebuffers for auto-keying if needed
    if (this._hasAutoKeys) {
      this.calculateDownsampleSize()

      // Create framebuffer for downsampled image used in auto-keying
      this._alphaFramebuffer = new FrameBuffer(gl, this._downsampleWidth, this._downsampleHeight)

      // Create downsample canvas for auto-keying
      this._downsampleCanvas = document.createElement('canvas')
      this._downsampleCanvas.width = this._downsampleWidth
      this._downsampleCanvas.height = this._downsampleHeight
      this._downsampleContext = this._downsampleCanvas.getContext('2d')
    } else {
      this._alphaFramebuffer = null
      this._downsampleCanvas = null
      this._downsampleContext = null
    }

    // Set up VAO with vertex attributes for optimized drawing
    if (this._vertexArrayObject && this._paintShader) {
      // Bind VAO to capture vertex setup
      gl.bindVertexArray(this._vertexArrayObject)

      // Set up vertex attributes (this will be cached in the VAO)
      const shader = this._paintShader

      // Enable vertex attribute arrays
      gl.enableVertexAttribArray(shader.location_position)
      gl.enableVertexAttribArray(shader.location_texCoord)

      // Bind and configure texture coordinates
      gl.bindBuffer(gl.ARRAY_BUFFER, this._texCoordBuffer)
      gl.vertexAttribPointer(
        shader.location_texCoord,
        this._texCoordBuffer!.itemSize,
        gl.FLOAT,
        false, // no normalization
        0, // stride (0 = tightly packed)
        0, // offset
      )

      // Bind and configure position vertices
      gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexPositionBuffer)
      gl.vertexAttribPointer(
        shader.location_position,
        this._vertexPositionBuffer!.itemSize,
        gl.FLOAT,
        false, // no normalization
        0, // stride (0 = tightly packed)
        0, // offset
      )

      // Bind index buffer
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._vertexIndexBuffer)

      // Unbind VAO to avoid accidental modifications
      gl.bindVertexArray(null)
    }
  }

  private calculateDownsampleSize () {
    if (!this._media || !this._data) return

    // Get source dimensions
    const sourceWidth = (this._media as unknown as Record<string, number>)[this._data.width] || 16
    const sourceHeight = (this._media as unknown as Record<string, number>)[this._data.height] || 16

    // Calculate aspect ratio
    const aspectRatio = sourceWidth / sourceHeight

    // Target area of roughly 256 pixels (16x16) but with correct aspect ratio
    const targetArea = 256

    if (aspectRatio >= 1) {
      // Landscape or square
      this._downsampleWidth = Math.round(Math.sqrt(targetArea * aspectRatio))
      this._downsampleHeight = Math.round(this._downsampleWidth / aspectRatio)
    } else {
      // Portrait
      this._downsampleHeight = Math.round(Math.sqrt(targetArea / aspectRatio))
      this._downsampleWidth = Math.round(this._downsampleHeight * aspectRatio)
    }

    // Ensure minimum of 8x8 and maximum of 64x64 for performance
    this._downsampleWidth = Math.max(8, Math.min(64, this._downsampleWidth))
    this._downsampleHeight = Math.max(8, Math.min(64, this._downsampleHeight))
  }

  private initializeTextures () {
    const gl = this._gl!

    /**
     * Creates and configures a WebGL texture from a media element
     * @param {HTMLElement} media - The media element (video/image/canvas)
     * @returns {WebGLTexture} The configured texture object
     */
    const loadTexture = (media: MediaElement): ExtendedWebGLTexture => {
      const texture = gl.createTexture() as ExtendedWebGLTexture
      texture.image = media

      // Configure the texture
      gl.bindTexture(gl.TEXTURE_2D, texture)

      // Load the image data into the texture
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image)

      // Configure texture parameters
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      // Unbind texture when done
      gl.bindTexture(gl.TEXTURE_2D, null)

      // Store dimensions for convenience
      texture.height = texture.image.height
      texture.width = texture.image.width

      return texture
    }

    // Create texture from the media element
    this._mediaTexture = loadTexture(this._media!)
  }

  private drawScreen (shader: ShaderProgram, sourceTexture: WebGLTexture | null, alphaTexture: WebGLTexture | null) {
    const gl = this._gl!
    shader.useProgram()

    // Use VAO to bind all vertex attributes at once
    gl.bindVertexArray(this._vertexArrayObject)

    // Set up source texture if provided
    if (sourceTexture) {
      shader.set_source(0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
    }

    // Set up alpha texture if provided
    if (alphaTexture) {
      // Only set alpha uniform if the shader supports it
      if (shader.set_alpha) {
        shader.set_alpha(1)
      }
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, alphaTexture)
    }

    // Configure blending for alpha transparency
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.enable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)

    // Draw the triangles using the indices
    gl.drawElements(
      gl.TRIANGLES,
      this._vertexIndexBuffer!.numItems,
      gl.UNSIGNED_SHORT,
      0,
    )

    // Unbind VAO for clean state
    gl.bindVertexArray(null)
  }

  private checkReady () {
    // Skip if initialization hasn't completed
    if (!this._initialized) {
      return
    }

    const isMediaReady = !this._data!.ready
      || !this._data!.load
      || (this._media as unknown as Record<string, unknown>)[this._data!.ready] === this._data!.readyTarget
      || (this._data!.readyTarget === undefined && (this._media as unknown as Record<string, unknown>)[this._data!.ready])

    if (isMediaReady) {
      // Initialize textures and render
      this.initializeTextures()
      this.setUpShaders()
      this.render()
    } else {
      // Check again on next tick
      setTimeout(() => {
        this.checkReady()
      }, 0)
    }
  }

  /**
   * Returns true if browser supports WebGL 2, else false.
   */
  supportsWebGL2 () {
    try {
      return !!(window.WebGLRenderingContext && document.createElement('canvas').getContext('webgl2'))
    } catch {
      return false
    }
  }

  /**
   * Sets a new source video, image or canvas element to key.
   */
  source (source: MediaElement) {
    // Validate source element
    if (!source || !source.tagName) {
      throw new Error('Missing source element')
    }

    // Get media type data based on tag name
    const tagName = source.tagName.toLowerCase()
    this._data = nodeData[tagName]

    if (!this._data) {
      throw new Error('Unsupported source media type')
    }

    // Store source element and check if it's ready
    this._media = source
    this.checkReady()

    return this // Enable method chaining
  }

  /**
   * Sets a new target canvas on which to paint keyed image(s). The context webgl2 will be used.
   */
  target (target: HTMLCanvasElement | WebGL2RenderingContext) {
    // Get WebGL context from canvas or use provided context
    if (target instanceof HTMLCanvasElement) {
      this._gl = target.getContext('webgl2')
    } else if (target instanceof WebGL2RenderingContext) {
      this._gl = target
    } else {
      throw new Error('Target must be an HTMLCanvasElement (or its WebGL2RenderingContext)')
    }

    // Validate that we have a valid WebGL context
    if (!this._gl) {
      throw new Error('Failed to get WebGL2 context from canvas')
    }

    // Set up shaders with the new GL context
    this.setUpShaders()

    return this // Enable method chaining
  }

  /**
   * Returns the coordinates of a bounding box around non-transparent pixels in the form [x1, y1, x2, y2]
   */
  getContentBounds (): [x1: number, y1: number, x2: number, y2: number] {
    const gl = this._gl!
    const canvas = gl.canvas
    const width = canvas.width
    const height = canvas.height

    // Read pixel data from the canvas
    const pixels = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

    let minX = width, minY = height, maxX = -1, maxY = -1

    // Scan pixels to find non-transparent bounds
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4
        const alpha = pixels[pixelIndex + 3] // Alpha channel

        if (alpha > 0) { // Non-transparent pixel found
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }

    // Return original coordinates if no non-transparent pixels found
    if (maxX === -1) {
      return [0, 0, width - 1, height - 1]
    }

    // Convert from WebGL coordinates (bottom-left origin) to Canvas 2D coordinates (top-left origin)
    // WebGL y=0 is bottom, Canvas 2D y=0 is top, so we need to flip the y coordinates
    const flippedMinY = height - 1 - maxY
    const flippedMaxY = height - 1 - minY

    // [x1, y1, x2, y2]
    return [minX, flippedMinY, maxX, flippedMaxY]
  }

  /**
   * Updates frame from source element and paints to target canvas
   * @param options Render options object
   */
  render (options: RenderOptions = {}) {
    const { passthrough = false } = options

    // Skip if media or media texture is not ready
    if (!this._mediaTexture || !this._mediaTexture.image || !this._paintShader || !(this._media as unknown as Record<string, unknown>)[this._data!.ready]) {
      return this
    }

    const gl = this._gl!

    // Update texture with latest media frame (important for video sources)
    gl.bindTexture(gl.TEXTURE_2D, this._mediaTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._mediaTexture.image)
    gl.bindTexture(gl.TEXTURE_2D, null)

    if (passthrough) {
      // Skip chroma key processing and draw source frame verbatim
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      this.drawScreen(this._paintShader, this._mediaTexture, null)

      return this
    }

    // Only downsample source image if auto-keying is needed
    if (this._hasAutoKeys && this._alphaFramebuffer && this._downsampleCanvas && this._downsampleContext) {
      // Draw the media element downsampled to the reusable canvas
      this._downsampleContext.drawImage(this._media!, 0, 0, this._downsampleWidth, this._downsampleHeight)

      // Upload the downsampled canvas directly to the alpha framebuffer's texture
      gl.bindTexture(gl.TEXTURE_2D, this._alphaFramebuffer.texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._downsampleCanvas)
      gl.bindTexture(gl.TEXTURE_2D, null)
    }

    // Render final image to canvas with chroma keying applied
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.drawScreen(this._paintShader!, this._mediaTexture, this._alphaFramebuffer?.texture || null)

    return this // Enable method chaining
  }

  /**
   * Sets one or more key colors in RGB, replacing any prior settings. Calling without parameters
   * clears all key colors. The auto key color mode downsamples the source image, grabs each corner
   * pixel, and keys on the two pixels with the most similar color. It works best on videos or images
   * with simplistic backgrounds, and can cause flickering if the algorithm gets it wrong. Use with
   * caution.
   *
   * @param keys - One or more key configurations. Each key can be:
   * - `'auto'` - Automatic color detection
   * - `[r, g, b]` - RGB color array (0-255 range)
   * - Object with properties:
   *   - `color: [r, g, b] | 'auto'` - Color to key
   *   - `tolerance?: number` - Color tolerance (0-1, default: 0.1)
   *   - `smoothness?: number` - Edge smoothness (0-1, default: 0.1)
   *   - `spill?: number` - Spill suppression (0-1, default: 0.1)
   *   - `debug?: boolean` - Enable debug visualization (default: false)
   */
  key (...keys: (Key | Key[])[]) {
    // Reset existing keys
    this._keys = []

    // Handle case when passing an array of arrays as first argument
    if (keys.length === 1 && Array.isArray(keys[0]) && Array.isArray((keys[0] as Key[])[0])) {
      keys = keys[0] as Key[]
    }

    // Process and validate each key
    keys.forEach((key) => {
      // Case 1: RGB array [r, g, b]
      if (Array.isArray(key) && typeof key[0] === 'number') {
        if (key.length !== 3) {
          throw new Error('Key color must be \'auto\' or an array like [r, g, b]')
        }
        if ((key as number[]).some((c: number) => isNaN(c))) {
          throw new Error('Invalid key color component')
        }
        // Convert to object format
        const keyObj = { color: key as [number, number, number] }
        this._keys.push(keyObj)
      } else if (typeof key === 'object' && key !== null && !Array.isArray(key)) {
        // Case 2: Object with color property
        const keyObj = key as { color: [number, number, number] | 'auto', tolerance?: number, smoothness?: number, spill?: number, debug?: boolean }
        if (Array.isArray(keyObj.color) && keyObj.color.length === 3) {
          if ((keyObj.color as number[]).some((c: number) => isNaN(c))) {
            throw new Error('Invalid key color component')
          }
        } else if (keyObj.color !== 'auto') {
          throw new Error('Key color must be \'auto\' or an array like [r, g, b]')
        }

        // Validate
        if (keyObj.tolerance !== undefined && (isNaN(keyObj.tolerance) || keyObj.tolerance < 0)) {
          throw new Error('Tolerance must be a non-negative number')
        }
        if (keyObj.smoothness !== undefined && (isNaN(keyObj.smoothness) || keyObj.smoothness < 0)) {
          throw new Error('Smoothness must be a non-negative number')
        }
        if (keyObj.spill !== undefined && (isNaN(keyObj.spill) || keyObj.spill < 0)) {
          throw new Error('Spill must be a non-negative number')
        }

        this._keys.push(keyObj as Key)
      } else if (key === 'auto') {
        // Case 3: String 'auto': convert to object format
        this._keys.push({ color: 'auto' })
      } else {
        throw new Error('Unsupported chroma key type')
      }
    })

    // Rebuild shaders with new keys and render
    this.setUpShaders()
    this.render()

    return this // Enable method chaining
  }

  /**
   * Unload all shader and buffers
   */
  unload () {
    // Skip if resources aren't initialized
    if (!this._gl || !this._paintShader) {
      return this
    }

    // Clean up shader programs
    this._paintShader.unload()

    // Clean up framebuffers
    if (this._alphaFramebuffer) {
      this._alphaFramebuffer.unload()
    }

    // Clean up downsample canvas
    this._downsampleCanvas = null
    this._downsampleContext = null

    // Clean up GL buffers
    this._gl.deleteBuffer(this._vertexPositionBuffer)
    this._gl.deleteBuffer(this._vertexIndexBuffer)
    this._gl.deleteBuffer(this._texCoordBuffer)

    // Clean up VAO
    if (this._vertexArrayObject) {
      this._gl.deleteVertexArray(this._vertexArrayObject)
    }

    // Clean up texture
    this._gl.deleteTexture(this._mediaTexture)

    return this // Enable method chaining
  }
}

export default GLChromaKey
