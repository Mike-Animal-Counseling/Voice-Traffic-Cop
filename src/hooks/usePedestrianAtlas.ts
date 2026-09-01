import { useEffect, useState } from 'react';

const ATLAS_SOURCE = '/images/pedestrians/juniper-pedestrians-v1.png';

const isConnectedBackdrop = (data: Uint8ClampedArray, pixelIndex: number) => {
  const offset = pixelIndex * 4;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const brightest = Math.max(red, green, blue);
  const darkest = Math.min(red, green, blue);
  return darkest > 228 && brightest - darkest < 13;
};

export const usePedestrianAtlas = () => {
  const [atlasUrl, setAtlasUrl] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = canvas.width * canvas.height;
      const visited = new Uint8Array(pixels);
      const queue = new Int32Array(pixels);
      let head = 0;
      let tail = 0;

      const enqueue = (pixelIndex: number) => {
        if (visited[pixelIndex] || !isConnectedBackdrop(imageData.data, pixelIndex)) return;
        visited[pixelIndex] = 1;
        queue[tail] = pixelIndex;
        tail += 1;
      };

      for (let x = 0; x < canvas.width; x += 1) {
        enqueue(x);
        enqueue((canvas.height - 1) * canvas.width + x);
      }
      for (let y = 1; y < canvas.height - 1; y += 1) {
        enqueue(y * canvas.width);
        enqueue(y * canvas.width + canvas.width - 1);
      }

      while (head < tail) {
        const pixelIndex = queue[head];
        head += 1;
        const x = pixelIndex % canvas.width;
        const y = Math.floor(pixelIndex / canvas.width);
        if (x > 0) enqueue(pixelIndex - 1);
        if (x + 1 < canvas.width) enqueue(pixelIndex + 1);
        if (y > 0) enqueue(pixelIndex - canvas.width);
        if (y + 1 < canvas.height) enqueue(pixelIndex + canvas.width);
      }

      for (let pixelIndex = 0; pixelIndex < pixels; pixelIndex += 1) {
        if (visited[pixelIndex]) imageData.data[pixelIndex * 4 + 3] = 0;
      }
      context.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob || disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setAtlasUrl(objectUrl);
      }, 'image/png');
    };

    image.src = ATLAS_SOURCE;
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return atlasUrl;
};
