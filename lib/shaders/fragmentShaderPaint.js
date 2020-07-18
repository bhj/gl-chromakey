export default `
  precision mediump float;

  varying vec2 vTexCoord;

  uniform sampler2D source;
  uniform sampler2D alpha;
  uniform vec4 alphaChannel;

  void main(void) {
    vec4 pixel = texture2D(source, vTexCoord);
    vec4 alphaPixel = texture2D(alpha, vec2(vTexCoord.x, 1.0 - vTexCoord.y));

    // set this vector because a dot product should be MUCH faster
    // in a shader than a big "if" statement
    pixel.a = dot(alphaPixel, alphaChannel);
    gl_FragColor = pixel;
  }
`
