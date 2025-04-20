import fragmentShaderAlphaSrc from './lib/shaders/fragmentShaderAlpha'
import fragmentShaderPaintSrc from './lib/shaders/fragmentShaderPaint'
import vertexShaderSrc from './lib/shaders/vertexShader'
import ShaderProgram from './lib/ShaderProgram'
import FrameBuffer from './lib/FrameBuffer'

const nodeData = {
  video : {
    ready: 'readyState',
    load: 'canplay',
    width: 'videoWidth',
    height: 'videoHeight'
  },
  img : {
    ready: 'complete',
    load: 'load',
    width: 'width',
    height: 'height'
  },
  canvas: {
    ready: 'complete',
    load: 'load',
    width: 'width',
    height: 'height'
  }
}

function buildWebGlBuffers () {
  // For potential performance optimization: consider using line_strip or fan in the future
  const gl = this._gl

  // Create and configure vertex position buffer for the quad (rectangle covering the canvas)
  const vertexPositionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer)
  const vertexPositions = new Float32Array([
    -1, -1, 0, // bottom left
    1, -1, 0, // bottom right
    1, 1, 0, // top right
    -1, 1, 0 // top left
  ])
  gl.bufferData(gl.ARRAY_BUFFER, vertexPositions, gl.STATIC_DRAW)
  vertexPositionBuffer.itemSize = 3 // x, y, z coordinates
  vertexPositionBuffer.numItems = 4 // 4 vertices

  // Create and configure texture coordinate buffer (maps texture to vertices)
  const texCoordBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  const textureCoords = new Float32Array([
    0, 1, // bottom left
    1, 1, // bottom right
    1, 0, // top right
    0, 0 // top left
  ])
  gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW)
  texCoordBuffer.itemSize = 2 // u, v coordinates
  texCoordBuffer.numItems = 4 // 4 vertices

  // Create and configure index buffer (defines triangles using vertex indices)
  const vertexIndexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer)
  const triangleIndices = new Uint16Array([
    0, 2, 1, // first triangle
    0, 3, 2 // second triangle
  ])
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangleIndices, gl.STATIC_DRAW)
  vertexIndexBuffer.itemSize = 1 // single index per vertex
  vertexIndexBuffer.numItems = 6 // 6 indices (2 triangles × 3 vertices)

  // Store buffers for later use
  this._vertexPositionBuffer = vertexPositionBuffer
  this._vertexIndexBuffer = vertexIndexBuffer
  this._texCoordBuffer = texCoordBuffer
}

function setUpShaders () {
  const gl = this._gl
  let keyFunctions = ''

  // Generate GLSL code for each chroma key
  this._keys.forEach(key => {
    // Convert RGB values to normalized 0-1 range for GLSL or use auto-detection
    const color = (key.color === 'auto')
      ? 'auto()'
      : `vec3(${key.color[0] / 255}, ${key.color[1] / 255}, ${key.color[2] / 255})`

    // Use default values if not specified
    const tolerance = isNaN(key.tolerance) ? 0.3 : key.tolerance.toFixed(3)
    const amount = isNaN(key.amount) ? 1 : key.amount.toFixed(3)

    // Add alpha calculation for this key
    keyFunctions += `pixel.a = distAlpha(${color}, ${tolerance}, ${amount});\n`

    // Add debug visualization if requested
    if (key.debug) {
      keyFunctions += 'debug();\n'
    }
  })

  // Clean up any existing resources
  if (this._alphaShader) this._alphaShader.unload()
  if (this._paintShader) this._paintShader.unload()
  if (this._alphaFramebuffer) this._alphaFramebuffer.unload()

  // Create shader programs with source code
  this._alphaShader = new ShaderProgram(gl, vertexShaderSrc, fragmentShaderAlphaSrc)
  this._paintShader = new ShaderProgram(
    gl,
    vertexShaderSrc,
    fragmentShaderPaintSrc.replace('%keys%', keyFunctions)
  )

  // Create framebuffer for downsampled image used in auto-keying
  this._alphaFramebuffer = new FrameBuffer(gl, 16, 16)
}

function initializeTextures () {
  const gl = this._gl

  /**
   * Creates and configures a WebGL texture from a media element
   * @param {HTMLElement} media - The media element (video/image/canvas)
   * @returns {WebGLTexture} The configured texture object
   */
  function loadTexture (media) {
    const texture = gl.createTexture()
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
  this._mediaTexture = loadTexture(this._media)
}

function drawScreen (shader, sourceTexture, alphaTexture) {
  const gl = this._gl
  shader.useProgram()

  // Set up vertex attributes for drawing
  // TODO: This could be optimized to run only once since we have a single model
  gl.enableVertexAttribArray(shader.location_position)
  gl.enableVertexAttribArray(shader.location_texCoord)

  // Bind and configure texture coordinates
  gl.bindBuffer(gl.ARRAY_BUFFER, this._texCoordBuffer)
  gl.vertexAttribPointer(
    shader.location_texCoord,
    this._texCoordBuffer.itemSize,
    gl.FLOAT,
    false, // no normalization
    0, // stride (0 = tightly packed)
    0 // offset
  )

  // Bind and configure position vertices
  gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexPositionBuffer)
  gl.vertexAttribPointer(
    shader.location_position,
    this._vertexPositionBuffer.itemSize,
    gl.FLOAT,
    false, // no normalization
    0, // stride (0 = tightly packed)
    0 // offset
  )

  // Bind index buffer for triangle drawing
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._vertexIndexBuffer)

  // Set up source texture if provided
  if (sourceTexture) {
    shader.set_source(0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
  }

  // Set up alpha texture if provided
  if (alphaTexture) {
    shader.set_alpha(1)
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
    this._vertexIndexBuffer.numItems,
    gl.UNSIGNED_SHORT,
    0
  )
}

function checkReady (callback) {
  // Skip if initialization hasn't completed
  if (!this._initialized) {
    return
  }

  // Check if the media element is ready
  const isMediaReady = !this._data.ready ||
                       !this._data.load ||
                       this._media[this._data.ready] === this._data.readyTarget ||
                       (this._data.readyTarget === undefined && this._media[this._data.ready])

  if (isMediaReady) {
    // Media is ready; initialize textures and render
    initializeTextures.apply(this)
    setUpShaders.apply(this)
    this.render()

    // Call callback if provided
    if (typeof callback === 'function') {
      callback()
    }
  } else {
    // Media not ready; check again on next tick
    setTimeout(() => {
      checkReady.apply(this, [callback])
    }, 0)
  }
}

class ChromaGL {
  constructor (source, target) {
    // Check browser compatibility first
    if (!this.hasWebGL2()) {
      throw new Error('Browser does not support WebGL 2')
    }

    this._keys = [] // Initialize empty keys array

    // Set up source and target elements
    this.source(source)
    this.target(target)

    // Create WebGL buffers and mark as initialized
    buildWebGlBuffers.apply(this)
    this._initialized = true

    // Check if media is ready and initialize if so
    checkReady.call(this)
  }

  hasWebGL2 () {
    try {
      return !!(window.WebGLRenderingContext && document.createElement('canvas').getContext('webgl2'))
    } catch (e) {
      return false
    }
  }

  source (source) {
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
    checkReady.call(this)

    return this // Enable method chaining
  }

  target (target) {
    // Get WebGL context from canvas or use provided context
    if (target instanceof HTMLCanvasElement) {
      this._gl = target.getContext('webgl2')
    } else if (target instanceof WebGLRenderingContext) {
      this._gl = target
    } else {
      throw new Error('Target must be an HTMLCanvasElement (or its WebGLRenderingContext)')
    }

    // Set up shaders with the new GL context
    setUpShaders.apply(this)

    return this // Enable method chaining
  }

  render () {
    // Skip if media or media texture is not ready
    if (!this._mediaTexture || !this._mediaTexture.image || !this._media[this._data.ready]) {
      return this
    }

    const gl = this._gl

    // Update texture with latest media frame (important for video sources)
    gl.bindTexture(gl.TEXTURE_2D, this._mediaTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._mediaTexture.image)
    gl.bindTexture(gl.TEXTURE_2D, null)

    // Draw the updated frame to the output canvas
    this.paint()

    return this // Enable method chaining
  }

  paint () {
    // Skip if not ready
    if (!this._alphaShader || !this._media[this._data.ready]) {
      return this
    }

    const gl = this._gl

    // STEP 1: Downsample source image to a 16x16 texture for auto-keying
    // This low-res version is used by the auto() function in the shader
    gl.viewport(0, 0, 16, 16)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._alphaFramebuffer.framebuffer)
    gl.clear(gl.COLOR_BUFFER_BIT)
    drawScreen.call(this, this._alphaShader, this._mediaTexture, null)

    // STEP 2: Render final image to canvas with chroma keying applied
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    drawScreen.call(this, this._paintShader, this._mediaTexture, this._alphaFramebuffer.texture)

    return this // Enable method chaining
  }

  key (...keys) {
    // Reset existing keys
    this._keys = []

    // Handle case when passing an array of arrays as first argument
    if (keys.length === 1 && Array.isArray(keys[0]) && Array.isArray(keys[0][0])) {
      keys = keys[0]
    }

    // Process and validate each key
    keys.forEach(key => {
      // Case 1: RGB array [r, g, b]
      if (Array.isArray(key)) {
        if (key.length !== 3) {
          throw new Error('Key color must be \'auto\' or an array like [r, g, b]')
        }
        if (key.some(c => isNaN(c))) {
          throw new Error('Invalid key color component')
        }
        // Convert to object format
        key = { color: key }
      }
      // Case 2: Object with color property
      else if (typeof key === 'object') {
        if (Array.isArray(key.color) && key.color.length === 3) {
          if (key.color.some(c => isNaN(c))) {
            throw new Error('Invalid key color component')
          }
        } else if (key.color !== 'auto') {
          throw new Error('Key color must be \'auto\' or an array like [r, g, b]')
        }
      }
      // Case 3: String 'auto'
      else if (key === 'auto') {
        // Convert to object format
        key = { color: 'auto' }
      }
      // Case 4: Invalid input
      else {
        throw new Error('Unsupported chroma key type')
      }

      // Add validated key to the collection
      this._keys.push(key)
    })

    // Rebuild shaders with new keys and render
    setUpShaders.apply(this)
    this.render()

    return this // Enable method chaining
  }

  unload () {
    // Skip if resources aren't initialized
    if (!this._gl || !this._alphaShader || !this._paintShader || !this._alphaFramebuffer) {
      return this
    }

    // Clean up shader programs
    this._alphaShader.unload()
    this._paintShader.unload()

    // Clean up framebuffer
    this._alphaFramebuffer.unload()

    // Clean up GL buffers
    this._gl.deleteBuffer(this._vertexPositionBuffer)
    this._gl.deleteBuffer(this._vertexIndexBuffer)
    this._gl.deleteBuffer(this._texCoordBuffer)

    // Clean up texture
    this._gl.deleteTexture(this._mediaTexture)

    return this // Enable method chaining
  }
}

export default ChromaGL
