export function decodeText () {
  const decoder = new TextDecoder();
  return new TransformStream({
    transform (chunk, controller) {
      controller.enqueue(decoder.decode(chunk, {
        stream: true
      }));
    }
  });
}

export function newlineSplit () {
  let buffer = '';

  return new TransformStream({
    transform (chunk, controller) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.slice(-1)[0];

      for (const line of lines.slice(0, -1)) {
        controller.enqueue(line);
      }
    },
    flush (controller) {
      controller.enqueue(buffer);
    }
  });
}

export function parseJSON () {
  return new TransformStream({
    transform (chunk, controller) {
      if (!chunk.trim()) return;
      controller.enqueue(JSON.parse(chunk));
    }
  });
}
