import fragmentShaderAlphaSrc from './lib/shaders/fragmentShaderAlpha'
import fragmentShaderPaintSrc from './lib/shaders/fragmentShaderPaint'
import vertexShaderSrc from './lib/shaders/vertexShader'
import ShaderProgram from './lib/ShaderProgram'

let keyCount = 0

const nodeData = {
  video : {
    ready: 'readyState',
    //      readyTarget: 2,
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

const colors = {
  green: [0, 255, 0],
  blue: [50, 70, 135]
}

function buildWebGlBuffers () {
  // todo: change this to line_strip or fan for speed?
  const gl = this._context
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
  const gl = this._context

  let i; let key; let keyFunctions = ''
  let hasPreCalc = false
  for (i in this._keys) {
    if (this._keys.hasOwnProperty(i)) {
      key = this._keys[i]
      if (key.mode === 'chroma') {
        const r = key.color[0]
        const g = key.color[1]
        const b = key.color[2]

        let fuzzy = key.fuzzy
        if (Math.floor(fuzzy) === fuzzy) {
          fuzzy += '.0'
        }

        let thresh = key.threshold * key.threshold
        if (Math.floor(thresh) === thresh) {
          thresh += '.0'
        }

        // convert target color to YUV
        keyFunctions += `pixel = distAlpha(${key.channel}, vec3(${0.2126 * r + 0.7152 * g + 0.0722 * b},${-0.2126 * r + -0.7152 * g + 0.9278 * b},${0.7874 * r + -0.7152 * g + 0.0722 * b}), ${thresh}, ${fuzzy}, pixel);\n`
      } else {
        hasPreCalc = true
        keyFunctions += `pixel = preAlpha(${key.source},${key.channel}, pixel);\n`
      }
    }
  }

  if (!keyFunctions) {
    keyFunctions = 'pixel = sourcePixel;\n'
  }

  let fragmentSrc = fragmentShaderAlphaSrc.replace('%keys%', keyFunctions)
  if (hasPreCalc) {
    fragmentSrc = `#define pre\n${fragmentSrc}`
  }
  this.alphaShader = new ShaderProgram(gl, vertexShaderSrc, fragmentSrc)

  const sourceX = this.sourceX
  const sourceY = this.sourceY
  const sourceWidth = this.sourceWidth
  const sourceHeight = this.sourceHeight

  const alphaX = this.alphaX
  const alphaY = this.alphaY
  const alphaWidth = this.alphaWidth
  const alphaHeight = this.alphaHeight

  this.alphaShader.set_sourceArea(sourceX, sourceY, sourceWidth, sourceHeight)
  this.alphaShader.set_alphaArea(alphaX, alphaY, alphaWidth, alphaHeight)

  let painterSrc = fragmentShaderPaintSrc
  if (hasPreCalc) {
    painterSrc = `#define pre\n${painterSrc}`
  }
  this.paintShader = new ShaderProgram(gl, vertexShaderSrc, painterSrc)
  this.paintShader.set_sourceArea(sourceX, sourceY, sourceWidth, sourceHeight)
  this.paintShader.set_alphaArea(alphaX, alphaY, alphaWidth, alphaHeight)
}

function initializeTextures () {
  const gl = this._context

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

function refreshVideoTexture (texture) {
  const gl = this._context

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image)
  gl.bindTexture(gl.TEXTURE_2D, null)
}

function initializeFrameBuffer (width, height, format) {
  // set up frame buffer
  const gl = this._context
  const fmt = format || gl.UNSIGNED_BYTE
  const obj = {}
  let tex

  const frameBuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer)

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  try {
    if (fmt === gl.FLOAT) {
      tex = new Float32Array(width * height * 4)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.DEPTH_COMPONENT, gl.FLOAT, tex)
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, fmt, null)
    }
  } catch (e) {
    // Null rejected
    if (format === gl.UNSIGNED_SHORT_4_4_4_4) {
      tex = new Uint16Array(width * height * 4)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_SHORT_4_4_4_4, tex)
    } else {
      tex = new Uint8Array(width * height * 4)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, tex)
    }
  }

  const renderBuffer = gl.createRenderbuffer()
  gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height)

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)

  // clean up
  gl.bindTexture(gl.TEXTURE_2D, null)
  gl.bindRenderbuffer(gl.RENDERBUFFER, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  if (!gl.isFramebuffer(frameBuffer)) {
    throw new Error('Invalid framebuffer')
  }
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  switch (status) {
    case gl.FRAMEBUFFER_COMPLETE:
      break
    case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
      throw new Error('Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_ATTACHMENT')
    case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
      throw new Error('Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT')
    case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
      throw new Error('Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_DIMENSIONS')
    case gl.FRAMEBUFFER_UNSUPPORTED:
      throw new Error('Incomplete framebuffer: FRAMEBUFFER_UNSUPPORTED')
    default:
      throw new Error(`Incomplete framebuffer: ${status}`)
  }

  obj.frameBuffer = frameBuffer
  obj.texture = texture
  obj.width = width
  obj.height = height
  return obj
}

function drawScreen (shader, sourceTexture, alphaTexture, channel) {
  const gl = this._context
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
    if (shader.set_alphaChannel) {
      // set this vector because a dot product should be MUCH faster in a shader than a big "if" statement
      // ...in theory.
      switch (channel) {
        case 0:
          shader.set_alphaChannel(1, 0, 0, 0)
          break
        case 1:
          shader.set_alphaChannel(0, 1, 0, 0)
          break
        case 2:
          shader.set_alphaChannel(0, 0, 1, 0)
          break
        case 3:
        default:
          shader.set_alphaChannel(0, 0, 0, 1)
          break
      }
    }
  }

  /* clipping */
  if (this.clipping) {
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(this.clipX * gl.viewportWidth,
      ((1 - this.clipY - this.clipHeight) * gl.viewportHeight),
      this.clipWidth * gl.viewportWidth,
      this.clipHeight * gl.viewportHeight)
  } else {
    gl.disable(gl.SCISSOR_TEST)
  }

  /* do this every time */
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.enable(gl.BLEND)
  gl.disable(gl.DEPTH_TEST)

  // draw!
  gl.drawElements(gl.TRIANGLES, this._vertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0)

  // disable this again, in case someone else is using the same context
  if (this.clipping) {
    gl.disable(gl.SCISSOR_TEST)
  }
}

function checkReady (callback) {
  if (!this.initialized) {
    return
  }

  if (!this._data.ready || !this._data.load ||
this._media[this._data.ready] === this._data.readyTarget ||
(this._data.readyTarget === undefined && this._media[this._data.ready])) {
    initializeTextures.apply(this)
    setUpShaders.apply(this)
    this.render()
    if (typeof callback === 'function') {
      callback()
    }
  } else {
    const obj = this
    /*
this._media.addEventListener( this._data.load , function() {
checkReady.apply(obj, callback);
}, false);
*/
    setTimeout(() => {
      checkReady.apply(obj, callback)
    }, 0)
  }
}

function setUpWebGl () {
  const gl = this._context

  gl.viewportWidth = gl.canvas.width
  gl.viewportHeight = gl.canvas.height
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight)

  // set up frame buffer
  this.alphaFrameBuffer = initializeFrameBuffer.call(this, gl.canvas.width, gl.canvas.height)
  this.outputFrameBuffer = initializeFrameBuffer.call(this, gl.canvas.width, gl.canvas.height)

  // set up shader programs
  setUpShaders.apply(this)
}

class ChromaGL {
  constructor (source, target, options) {
    const opts = options || {}

    if (!this.hasWebGL()) {
      throw new Error('Browser does not support WebGL')
    }

    this.source(source)
    this.target(target)

    // todo: put this in a method
    const clip = opts.clip || {}
    this.clipX = clip.x || 0
    this.clipY = clip.y || 0
    this.clipWidth = clip.width || 1 - this.clipX
    this.clipHeight = clip.height || 1 - this.clipY
    this.clipping = (this.clipX || this.clipY || this.clipWidth < 1 || this.clipHeight < 1)

    // todo: scale (x and y) option?

    // todo: put this in a method
    const sourceDimensions = opts.source || {}
    this.sourceX = sourceDimensions.x || 0
    this.sourceY = sourceDimensions.x || 0
    this.sourceWidth = sourceDimensions.width || 1 - this.sourceX
    this.sourceHeight = sourceDimensions.height || (0.5 - this.sourceY)
    const alpha = opts.alpha || {}
    this.alphaX = alpha.x || 0
    this.alphaY = alpha.y !== undefined ? alpha.y : this.sourceHeight
    this.alphaWidth = alpha.width !== undefined ? alpha.width : 1 - this.alphaX
    this.alphaHeight = alpha.height !== undefined ? alpha.height : (1 - this.alphaY)

    buildWebGlBuffers.apply(this)

    this._keys = {}

    this.initialized = true
    this.dirty = true
    checkReady.call(this)
  }

  hasWebGL () {
    return !!window.WebGLRenderingContext
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
    this.dirty = true

    checkReady.call(this)

    return this
  }

  target (target) {
    if (target instanceof HTMLCanvasElement) {
      this._context = target.getContext('webgl')
    } else if (target instanceof WebGLRenderingContext) {
      this._context = target
    } else {
      throw new Error('Target must be an HTMLCanvasElement (or its WebGLRenderingContext)')
    }

    this.dirty = true
    setUpWebGl.apply(this)

    return this
  }

  render (clear) {
    if (this._mediaTexture && this._mediaTexture.image && this._media[this._data.ready]) {
      const image = this._mediaTexture.image

      if (image.lastUpdateFrame !== image.currentTime || image.currentTime === undefined) { // todo: do this better
        if (image.currentTime === undefined) {
          image.currentTime = 0
        }

        image.lastUpdateFrame = image.currentTime
        refreshVideoTexture.call(this, this._mediaTexture)
        this.dirty = true
      }
    }

    if (this.dirty) {
      if (clear) {
        this._context.clearColor(0.0, 0.0, 0.0, 0.0)
        this._context.clear(this._context.COLOR_BUFFER_BIT)
      }

      this.paint()
    }
  }

  paint () {
    if (this.alphaShader && this._media[this._data.ready]) {
      const gl = this._context

      // draw alpha channels to frame buffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.alphaFrameBuffer.frameBuffer)
      gl.clear(gl.COLOR_BUFFER_BIT)
      drawScreen.call(this, this.alphaShader, this._mediaTexture, null)
      this.dirty = false

      // draw to canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      drawScreen.call(this, this.paintShader, this._mediaTexture, this.alphaFrameBuffer.texture)
      this.dirty = false
    }
  }

  setThreshold (id, threshold, fuzzy) {
    if (this._keys[id] && this._keys[id].mode === 'chroma') {
      this._keys[id].threshold = isNaN(threshold) ? 94.86832980505137 : parseFloat(threshold)

      this._keys[id].fuzzy = isNaN(fuzzy) ? (isNaN(threshold) ? 1.25 : this._keys[id].fuzzy) : parseFloat(fuzzy)

      setUpShaders.apply(this)
      this.dirty = true
      // this.paint();
    }
    return this
  }

  addChromaKey (keys, channel) {
    const ids = []
    let id

    // todo: allow static image/canvas as mask
    // todo: luminance key
    // todo: alternate color spaces

    if (!Array.isArray(keys) || (keys.length && !isNaN(keys[0]))) {
      keys = [keys]
    }

    channel = channel || 0

    let i
    let key
    for (i = 0; i < keys.length; i++) {
      key = keys[i]
      id = keyCount
      keyCount++

      if (Array.isArray(key)) {
        if (key.length !== 3) {
          throw new Error('Unsupported chroma key type')
        }
        let j
        for (j = 0; j < 3; j++) {
          if (isNaN(key[j])) {
            throw new Error('Unsupported chroma key type')
          }
        }
        key = {
          mode: 'chroma',
          color: key,
          channel
        }
      } else if (typeof key === 'string') {
        if (key === 'pre') {
          key = {
            mode: 'pre',
            channel
          }
        } else if (colors[key]) {
          key = {
            mode: 'chroma',
            color: colors[key],
            channel
          }
        } else {
          throw new Error('Unknown chroma type')
        }
      }

      if (typeof key !== 'object') {
        throw new Error('Unsupported chroma key type')
      }

      if (key.channel === undefined) {
        key.channel = channel
      }
      if (isNaN(key.channel) || key.channel < 0 || key.channel > 2) {
        throw new Error('Unsupported channel')
      }

      if (key.mode === 'chroma') {
        if (key.color) {
          key.threshold = key.threshold || 94.86832980505137
          key.fuzzy = key.fuzzy || 1.25
        } else {
          throw new Error('Missing chroma color')
        }
      } else if (key.mode === 'pre') {
        key.source = key.source || 0
      } else {
        throw new Error('Unsupported chroma key type')
      }

      const clip = key.clip || {}
      key.clipX = clip.x || 0
      key.clipY = clip.y || 0
      key.clipWidth = clip.width || this._media[this._data.width] - this.clipX
      key.clipHeight = clip.height || this._media[this._data.height] - this.clipY

      ids.push(id)
      this._keys[id] = key
    }

    setUpShaders.apply(this)
    this.dirty = true
    this.render()
    return ids
  }

  removeChromaKey (id) {
    let ids
    if (Array.isArray(id)) {
      ids = id
    } else {
      ids = [id]
    }

    let i
    let theId
    for (i = 0; i < ids.length; i++) {
      theId = ids[i]
      if (!isNaN(theId) && this._key.hasOwnProperty(theId)) {
        delete this._key[theId]
      }
    }

    setUpShaders.apply(this)
    this.dirty = true
  }
}

export default ChromaGL
