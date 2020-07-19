export default class ShaderProgram {
  constructor (gl, vertexShaderSource, fragmentShaderSource) {
    this.gl = gl
    this.vertexShader = this.compileShader(vertexShaderSource)
    this.fragmentShader = this.compileShader(fragmentShaderSource, true)
    this.program = gl.createProgram()
    let err = ''

    gl.attachShader(this.program, this.vertexShader)
    let err2 = gl.getShaderInfoLog(this.vertexShader)
    if (err2) {
      err += `Vertex shader error: ${err2}\n`
    }
    gl.attachShader(this.program, this.fragmentShader)
    err2 = gl.getShaderInfoLog(this.fragmentShader)
    if (err2) {
      err += `Fragment shader error: ${err2}\n`
    }

    gl.linkProgram(this.program)

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      err += gl.getProgramInfoLog(this.program)
      gl.deleteProgram(this.program)
      gl.deleteShader(this.vertexShader)
      gl.deleteShader(this.fragmentShader)
      throw new Error(`Could not initialise shader: ${err}`)
    }

    gl.useProgram(this.program)

    const numUniforms = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS)
    this.uniforms = []
    let i
    let info
    let name
    let loc
    for (i = 0; i < numUniforms; ++i) {
      info = gl.getActiveUniform(this.program, i)
      name = info.name
      loc = gl.getUniformLocation(this.program, name)
      loc.name = name
      info.set = this[`set_${name}`] = this.makeShaderSetter(info, loc)
      info.get = this[`get_${name}`] = this.makeShaderGetter(this, loc)
      info.loc = this[`location_${name}`] = loc
      this.uniforms.push(info)
    }

    const numAttribs = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES)
    this.attributes = []
    for (i = 0; i < numAttribs; ++i) {
      info = gl.getActiveAttrib(this.program, i)
      name = info.name
      loc = gl.getAttribLocation(this.program, name)
      this[`location_${name}`] = loc
      this.attributes.push(name)
    }
  }

  compileShader (source, fragment) {
    const { gl } = this
    const shader = fragment ? gl.createShader(gl.FRAGMENT_SHADER) : gl.createShader(gl.VERTEX_SHADER)

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader error: ${gl.getShaderInfoLog(shader)}`)
    }

    return shader
  }

  makeShaderSetter (info, loc) {
    const gl = this.gl
    switch (info.type) {
      case gl.SAMPLER_2D:
        return value => {
          info.glTexture = gl[`TEXTURE${value}`]
          gl.uniform1i(loc, value)
        }
      case gl.BOOL:
      case gl.INT:
        return value => {
          gl.uniform1i(loc, value)
        }
      case gl.FLOAT:
        return value => {
          gl.uniform1f(loc, value)
        }
      case gl.FLOAT_VEC2:
        return (x, y) => {
          gl.uniform2f(loc, x, y)
        }
      case gl.FLOAT_VEC3:
        return (x, y, z) => {
          gl.uniform3f(loc, x, y, z)
        }
      case gl.FLOAT_VEC4:
        return (x, y, z, w) => {
          gl.uniform4f(loc, x, y, z, w)
        }
      case gl.FLOAT_MAT3:
        return mat3 => {
          gl.uniformMatrix3fv(loc, false, mat3)
        }
      case gl.FLOAT_MAT4:
        return mat4 => {
          gl.uniformMatrix4fv(loc, false, mat4)
        }
      default:
        break
    }

    return () => {
      throw new Error(`ShaderProgram doesn't know how to set type: ${info.type}`)
    }
  }

  makeShaderGetter (loc) {
    return function () {
      return this.gl.getUniform(this.program, loc)
    }
  }

  useProgram () {
    this.gl.useProgram(this.program)
  }

  unload () {
    this.gl.deleteShader(this.vertexShader)
    this.gl.deleteShader(this.fragmentShader)
    this.gl.deleteProgram(this.program)
  }
}
