export default class FrameBuffer {
  constructor (gl, width, height, format = gl.UNSIGNED_BYTE) {
    this.gl = gl
    this.format = format

    this.framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)

    this.renderbuffer = gl.createRenderbuffer()

    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    this.setSize(width, height)

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null) // cleanup

    if (!gl.isFramebuffer(this.framebuffer)) {
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
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    let tex
    try {
      if (this.format === gl.FLOAT) {
        tex = new Float32Array(width * height * 4)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.DEPTH_COMPONENT, gl.FLOAT, tex)
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, this.format, null)
      }
    } catch (e) {
      // Null rejected
      if (this.format === gl.UNSIGNED_SHORT_4_4_4_4) {
        tex = new Uint16Array(width * height * 4)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_SHORT_4_4_4_4, tex)
      } else {
        tex = new Uint8Array(width * height * 4)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, tex)
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, null) // cleanup

    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderbuffer)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null) // cleanup
  }

  unload () {
    this.gl.deleteFramebuffer(this.framebuffer)
    this.gl.deleteRenderbuffer(this.renderbuffer)
    this.gl.deleteTexture(this.texture)
  }
}
