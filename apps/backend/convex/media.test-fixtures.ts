export function png(seed = 0, totalBytes = 58): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(totalBytes)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(bytes.buffer)
  let offset = 8
  const chunk = (type: string, data: Uint8Array) => {
    view.setUint32(offset, data.length)
    bytes.set(
      [...type].map((character) => character.charCodeAt(0)),
      offset + 4,
    )
    bytes.set(data, offset + 8)
    offset += 12 + data.length
  }
  const header = new Uint8Array(13)
  new DataView(header.buffer).setUint32(0, 1)
  new DataView(header.buffer).setUint32(4, 1)
  header.set([8, 6, 0, 0, 0], 8)
  chunk('IHDR', header)
  const payload = new Uint8Array(totalBytes - 57)
  payload[0] = seed
  chunk('IDAT', payload)
  chunk('IEND', new Uint8Array())
  return bytes
}

export function jpeg(width = 1, height = 1): Uint8Array<ArrayBuffer> {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0,
    17,
    8,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    3,
    1,
    0x11,
    0,
    2,
    0x11,
    0,
    3,
    0x11,
    0,
    0xff,
    0xd9,
  ])
}
