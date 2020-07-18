export default `
  precision mediump float;

  varying vec2 vTexCoord;

  uniform sampler2D source;

  vec4 sourcePixel;

  const mat3 yuv = mat3(
    54.213, 182.376, 18.411,
    -54.213, -182.376, 236.589,
    200.787, -182.376, -18.411
  );

  vec4 distAlpha(int targetChannel, vec3 target, float threshold, float fuzzy, vec4 pixel) {
    float distance2, sum, alpha;

    vec3 yuvColorDiff = sourcePixel.rgb * yuv - target;

    distance2 = dot(yuvColorDiff, yuvColorDiff);

    alpha = smoothstep(threshold, threshold * fuzzy, distance2);

    vec4 outputPixel = vec4(pixel);
    if (targetChannel == 0) {
      outputPixel.r *= alpha;
    } else if (targetChannel == 1) {
      outputPixel.g *= alpha;
    } else if (targetChannel == 2) {
      outputPixel.b *= alpha;
    }
    //outputPixel = vec4(abs(x1)/255.0, abs(y1)/255.0, abs(z1)/255.0, 1.0);
    //outputPixel = sourcePixel;
    //outputPixel = vec4(target/255.0, 1.0);
    //outputPixel = vec4(distance2/10000.0, distance2/10000.0, distance2/10000.0, 1.0);
    return outputPixel;
  }

  void main(void) {
    sourcePixel = texture2D(source, vTexCoord);

    vec4 pixel = vec4(1.0);
    %keys%
    pixel.a = min(pixel.r, min(pixel.g, pixel.b));
    gl_FragColor = pixel;
  }
`
