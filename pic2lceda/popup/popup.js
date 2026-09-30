// popup/popup.js

let currentFile = null;
const el = id => document.getElementById(id);

// 阈值滑动
el('thresholdSlider').addEventListener('input', e => {
  el('threshold_label').textContent = e.target.value;
});

// 选择文件
el('btn_getfile').addEventListener('click', () => el('fileInput').click());

el('fileInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  currentFile = file;
  el('sourcefullpath').value = file.name;
  await refreshPreview();
});

// 参数变化刷新预览
['x_size', 'y_size', 'width', 'layer', 'thresholdSlider',
 'color_invert_f', 'x_invert_f', 'y_invert_f'].forEach(id => {
  el(id).addEventListener('change', refreshPreview);
});

async function refreshPreview() {
  if (!currentFile) return;
  try {
    const p = readParams();
    const { imageData } = await ImageProcessor.transform(
      currentFile, p.x_size, p.y_size, p.width, p.layer,
      p.colorInvert, p.xInvert, p.yInvert, p.threshold
    );
    const url = ImageProcessor.toDataURL(imageData);
    const preview = el('preview');
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const c = preview;
      c.width = 200;
      c.height = Math.round(200 * imageData.height / imageData.width);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.style.display = 'block';
    };
  } catch (err) {
    console.error(err);
  }
}

function readParams() {
  return {
    x_size: parseFloat(el('x_size').value),
    y_size: parseFloat(el('y_size').value),
    width: parseInt(el('width').value),
    layer: parseInt(el('layer').value),
    colorInvert: el('color_invert_f').checked,
    xInvert: el('x_invert_f').checked,
    yInvert: el('y_invert_f').checked,
    copper: el('copper_f').checked,
    threshold: parseInt(el('thresholdSlider').value)
  };
}

// 生成文件
el('btn_convert').addEventListener('click', async () => {
  if (!currentFile) {
    setStatus('请先选择图片文件', 'red');
    return;
  }
  setStatus('转换中...', '#2d7ff9');

  try {
    const p = readParams();

    // 与 Python 版一致：layer_index < 8 用 +1，否则 +2
    const layerIndex = p.layer;
    const layer = layerIndex < 8 ? layerIndex + 1 : layerIndex + 2;

    const { imageData, x_size_mil, y_size_mil, im_raw, im_col } =
      await ImageProcessor.transform(
        currentFile, p.x_size, p.y_size, p.width, layer,
        p.colorInvert, p.xInvert, p.yInvert, p.threshold
      );

    const { libJson, pcbJson, info, baseName, ts } =
      LcedaGenerator.generate(
        imageData, p.width, layer, p.copper,
        p.x_size, p.y_size, x_size_mil, y_size_mil, im_raw, im_col,
        p.colorInvert, p.xInvert, p.yInvert, p.threshold, currentFile.name
      );

    // 浏览器无法在源目录下建文件夹，只能加前缀
    const prefix = `LCEDA_${baseName}_${ts}`;
    LcedaGenerator.downloadJson(libJson, `${prefix}/LIB_${baseName}.json`);
    LcedaGenerator.downloadJson(pcbJson, `${prefix}/PCB_${baseName}.json`);
    LcedaGenerator.downloadText(info, `${prefix}/info.txt`);

    setStatus('转换完成！文件已开始下载。', 'green');
  } catch (err) {
    console.error(err);
    setStatus('转换失败：' + err.message, 'red');
  }
});

function setStatus(msg, color) {
  const s = el('status');
  s.textContent = msg;
  s.style.color = color || '#333';
}