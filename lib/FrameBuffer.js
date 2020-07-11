export default class FrameBuffer {
  constructor (gl, width, height, format) {
    const fmt = format || gl.UNSIGNED_BYTE
    let tex

    this._frameBuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._frameBuffer)

    this._texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this._texture)
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

    this.renderBuffer = gl.createRenderbuffer()
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderBuffer)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height)

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._texture, 0)

    // clean up
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

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

  get frameBuffer () { return this._frameBuffer }
  get texture () { return this._texture }
}
