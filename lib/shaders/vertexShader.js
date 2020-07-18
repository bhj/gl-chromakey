export default `
  precision mediump float;

  attribute vec3 position;
  attribute vec2 texCoord;

  varying vec2 vTexCoord;
  varying vec4 vPosition;
  varying vec2 vSourceCoord;

  uniform vec4 sourceArea;

  void main(void) {
    gl_Position = vec4(position, 1.0);
    vTexCoord = vec2(texCoord.s, texCoord.t);
    vSourceCoord = vec2(sourceArea.x + texCoord.s * sourceArea.z, sourceArea.y + texCoord.t * sourceArea.w);
  }
`
