export default class FrameBuffer {
  constructor (gl, width, height, format = gl.UNSIGNED_BYTE) {
    this._gl = gl
    this._format = format

    this._frameBuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._frameBuffer)

    this._renderBuffer = gl.createRenderbuffer()

    this._texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this._texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    this.setSize(width, height)

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null) // cleanup

    if (!gl.isFramebuffer(this._frameBuffer)) {
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

    return this
  }

  // @todo break this out more?
  setSize (width, height) {
    const gl = this._gl
    gl.bindTexture(gl.TEXTURE_2D, this._texture)

    let tex
    try {
      if (this._format === gl.FLOAT) {
        tex = new Float32Array(width * height * 4)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.DEPTH_COMPONENT, gl.FLOAT, tex)
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, this._format, null)
      }
    } catch (e) {
      // Null rejected
      if (this._format === gl.UNSIGNED_SHORT_4_4_4_4) {
        tex = new Uint16Array(width * height * 4)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_SHORT_4_4_4_4, tex)
      } else {
        tex = new Uint8Array(width * height * 4)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, tex)
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, null) // cleanup

    gl.bindRenderbuffer(gl.RENDERBUFFER, this._renderBuffer)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null) // cleanup
  }

  get frameBuffer () { return this._frameBuffer }
  get texture () { return this._texture }
}
