export default `
  precision mediump float;

  attribute vec3 position;
  attribute vec2 texCoord;

  varying vec2 vTexCoord;

  void main(void) {
    gl_Position = vec4(position, 1.0);
    vTexCoord = vec2(texCoord.s, texCoord.t);
  }
`
