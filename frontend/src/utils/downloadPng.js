export async function downloadElementPng(container, filename) {
  if (!container) return;
  const svg = container.querySelector('.recharts-surface') || container.querySelector('svg.recharts-wrapper svg');
  if (!svg) return;

  let w, h;
  const vb = svg.viewBox && svg.viewBox.baseVal;
  if (vb && vb.width && vb.height) {
    w = vb.width;
    h = vb.height;
  } else {
    w = Number(svg.getAttribute('width')) || 0;
    h = Number(svg.getAttribute('height')) || 0;
  }
  if (!w || !h) {
    const r = svg.getBoundingClientRect();
    w = r.width;
    h = r.height;
  }
  if (!w || !h) return;

  const clone = svg.cloneNode(true);
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);

  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = filename.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}