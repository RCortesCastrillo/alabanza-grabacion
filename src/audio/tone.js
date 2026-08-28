// Suavizado de tono fijo para el micrófono crudo del celular:
// - corte de graves a 70 Hz (retumbo, golpes en la mesa)
// - estante de agudos: -4 dB arriba de ~5.5 kHz (siseo y brillo áspero)
// Biquads del "Audio EQ Cookbook" (RBJ), aplicados en el mismo sitio.

function biquad(b0, b1, b2, a0, a1, a2) {
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function highpass(sr, f, q = Math.SQRT1_2) {
  const w = 2 * Math.PI * f / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
  return biquad((1 + cs) / 2, -(1 + cs), (1 + cs) / 2, 1 + al, -2 * cs, 1 - al);
}

function highshelf(sr, f, gainDb, s = 0.7) {
  const A = Math.pow(10, gainDb / 40);
  const w = 2 * Math.PI * f / sr, cs = Math.cos(w), sn = Math.sin(w);
  const al = sn / 2 * Math.sqrt((A + 1 / A) * (1 / s - 1) + 2);
  const sa = 2 * Math.sqrt(A) * al;
  return biquad(
    A * ((A + 1) + (A - 1) * cs + sa),
    -2 * A * ((A - 1) + (A + 1) * cs),
    A * ((A + 1) + (A - 1) * cs - sa),
    (A + 1) - (A - 1) * cs + sa,
    2 * ((A - 1) - (A + 1) * cs),
    (A + 1) - (A - 1) * cs - sa
  );
}

function run(x, c) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    x[i] = y0;
  }
}

// Modifica el Float32Array en su lugar.
export function applyTone(samples, sampleRate) {
  run(samples, highpass(sampleRate, 70));
  run(samples, highshelf(sampleRate, 5500, -4));
  return samples;
}
