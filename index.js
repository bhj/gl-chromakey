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
  // todo: change this to line_strip or fan for speed?
  const gl = this._gl
  const vertexPositionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ]), gl.STATIC_DRAW)
  vertexPositionBuffer.itemSize = 3
  vertexPositionBuffer.numItems = 4

  const texCoordBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 1,
    1, 1,
    1, 0,
    0, 0
  ]), gl.STATIC_DRAW)
  texCoordBuffer.itemSize = 2
  texCoordBuffer.numItems = 4

  const vertexIndexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([
    0, 2, 1, 0, 3, 2 // Front face
  ]), gl.STATIC_DRAW)
  vertexIndexBuffer.itemSize = 1
  vertexIndexBuffer.numItems = 6

  this._vertexPositionBuffer = vertexPositionBuffer
  this._vertexIndexBuffer = vertexIndexBuffer
  this._texCoordBuffer = texCoordBuffer
}

function setUpShaders () {
  const gl = this._gl
  let keyFunctions = ''

  this._keys.forEach(k => {
    const color = (k.color === 'auto') ? 'auto()' : `vec3(${k.color[0] / 255},${k.color[1] / 255},${k.color[2] / 255})`
    const tolerance = isNaN(k.tolerance) ? 0.3 : k.tolerance.toFixed(1)

    keyFunctions += `pixel.a = distAlpha(${color}, ${tolerance});\n`
    if (k.debug) keyFunctions += 'debug();\n'
  })

  if (this._alphaShader) this._alphaShader.unload()
  if (this._paintShader) this._paintShader.unload()
  if (this._alphaFramebuffer) this._alphaFramebuffer.unload()

  this._alphaShader = new ShaderProgram(gl, vertexShaderSrc, fragmentShaderAlphaSrc)
  this._paintShader = new ShaderProgram(gl, vertexShaderSrc, fragmentShaderPaintSrc.replace('%keys%', keyFunctions))

  // holds downsampled image for auto-keying
  this._alphaFramebuffer = new FrameBuffer(gl, 16, 16)
}

function initializeTextures () {
  const gl = this._gl

  // this assumes media has been loaded
  function loadTexture (media) {
    const texture = gl.createTexture()

    texture.image = media

    gl.bindTexture(gl.TEXTURE_2D, texture)

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)

    texture.height = texture.image.height
    texture.width = texture.image.width
    return texture
  }

  this._mediaTexture = loadTexture(this._media)
}

function drawScreen (shader, sourceTexture, alphaTexture) {
  const gl = this._gl
  shader.useProgram()

  /* todo: do this all only once at the beginning, since we only have one model */
  gl.enableVertexAttribArray(shader.location_position)
  gl.enableVertexAttribArray(shader.location_texCoord)

  gl.bindBuffer(gl.ARRAY_BUFFER, this._texCoordBuffer)
  gl.vertexAttribPointer(shader.location_texCoord, this._texCoordBuffer.itemSize, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexPositionBuffer)
  gl.vertexAttribPointer(shader.location_position, this._vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._vertexIndexBuffer)

  // set up textures
  if (sourceTexture) {
    shader.set_source(0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
  }

  if (alphaTexture) {
    shader.set_alpha(1)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, alphaTexture)
  }

  /* do this every time */
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.enable(gl.BLEND)
  gl.disable(gl.DEPTH_TEST)

  // draw!
  gl.drawElements(gl.TRIANGLES, this._vertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0)
}

function checkReady (callback) {
  if (!this._initialized) {
    return
  }

  if (!this._data.ready || !this._data.load || this._media[this._data.ready] === this._data.readyTarget ||
      (this._data.readyTarget === undefined && this._media[this._data.ready])) {
    initializeTextures.apply(this)
    setUpShaders.apply(this)
    this.render()
    if (typeof callback === 'function') {
      callback()
    }
  } else {
    setTimeout(() => {
      checkReady.apply(this, callback)
    }, 0)
  }
}

class ChromaGL {
  constructor (source, target) {
    if (!this.hasWebGL2()) {
      throw new Error('Browser does not support WebGL 2')
    }

    this._keys = []
    this.source(source)
    this.target(target)

    buildWebGlBuffers.apply(this)
    this._initialized = true

    checkReady.call(this)
  }

  hasWebGL2 () {
    try {
      return !!window.WebGLRenderingContext && !!document.createElement('canvas').getContext('webgl2')
    } catch (e) {
      return false
    }
  }

  source (source) {
    if (!source || !source.tagName) {
      throw new Error('Missing source element')
    }

    this._data = nodeData[source.tagName.toLowerCase()]

    if (!this._data) {
      throw new Error('Unsupported source media type')
    }

    this._media = source
    checkReady.call(this)

    return this
  }

  target (target) {
    if (target instanceof HTMLCanvasElement) {
      this._gl = target.getContext('webgl2')
    } else if (target instanceof WebGLRenderingContext) {
      this._gl = target
    } else {
      throw new Error('Target must be an HTMLCanvasElement (or its WebGLRenderingContext)')
    }

    setUpShaders.apply(this)

    return this
  }

  render () {
    if (!this._mediaTexture || !this._mediaTexture.image || !this._media[this._data.ready]) {
      return
    }

    const gl = this._gl

    // refresh source image
    gl.bindTexture(gl.TEXTURE_2D, this._mediaTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._mediaTexture.image)
    gl.bindTexture(gl.TEXTURE_2D, null)

    this.paint()
  }

  paint () {
    if (!this._alphaShader || !this._media[this._data.ready]) {
      return
    }

    const gl = this._gl

    // downsample image to a 16x16 framebuffer used for auto-keying
    gl.viewport(0, 0, 16, 16)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._alphaFramebuffer.framebuffer)
    gl.clear(gl.COLOR_BUFFER_BIT)
    drawScreen.call(this, this._alphaShader, this._mediaTexture, null)

    // draw final image to canvas
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    drawScreen.call(this, this._paintShader, this._mediaTexture, this._alphaFramebuffer.texture)

    return this
  }

  key (...keys) {
    this._keys = []

    if (Array.isArray(keys[0]) && Array.isArray(keys[0][0])) {
      keys = keys[0]
    }

    // validate
    keys.forEach(key => {
      if (Array.isArray(key)) {
        if (key.length !== 3) throw new Error('Key color must be \'auto\' or an array like [r, g, b]')
        if (key.some(c => isNaN(c))) throw new Error('Invalid key color component')
        key = { color: key }
      } else if (typeof key === 'object') {
        if (Array.isArray(key.color) && key.color.length === 3) {
          if (key.color.some(c => isNaN(c))) throw new Error('Invalid key color component')
        } else if (key.color !== 'auto') {
          throw new Error('Key color must be \'auto\' or an array like [r, g, b]')
        }
      } else if (key === 'auto') {
        key = { color: 'auto' }
      } else {
        throw new Error('Unsupported chroma key type')
      }

      this._keys.push(key)
    })

    setUpShaders.apply(this)
    this.render()
  }

  unload () {
    if (!this._gl || !this._alphaShader || !this._paintShader || !this._alphaFramebuffer) return

    this._alphaShader.unload()
    this._paintShader.unload()
    this._alphaFramebuffer.unload()
    this._gl.deleteBuffer(this._vertexPositionBuffer)
    this._gl.deleteBuffer(this._vertexIndexBuffer)
    this._gl.deleteBuffer(this._texCoordBuffer)
    this._gl.deleteTexture(this._mediaTexture)
  }
}

export default ChromaGL
