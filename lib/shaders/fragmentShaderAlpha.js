export default `#version 300 es
  precision mediump float;

  in vec2 vTexCoord;
  out vec4 pixel;

  uniform sampler2D source;
  vec4 sourcePixel;

  const mat3 yuv = mat3(
    54.213, 182.376, 18.411,
    -54.213, -182.376, 236.589,
    200.787, -182.376, -18.411
  );

  vec4 distAlpha(int targetChannel, vec3 target, float threshold, float fuzzy, vec4 pixel) {
    float distance2, alpha;
    vec4 outputPixel = vec4(pixel);

    vec3 yuvColorDiff = sourcePixel.rgb * yuv - target;
    distance2 = dot(yuvColorDiff, yuvColorDiff);

    alpha = smoothstep(threshold, threshold * fuzzy, distance2);

    if (targetChannel == 0) {
      outputPixel.r *= alpha;
    } else if (targetChannel == 1) {
      outputPixel.g *= alpha;
    } else if (targetChannel == 2) {
      outputPixel.b *= alpha;
    }

    return outputPixel;
  }

  void main(void) {
    pixel = vec4(1.0);
    sourcePixel = texture(source, vTexCoord);

    %keys%
  }
`
