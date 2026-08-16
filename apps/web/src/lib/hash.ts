/**
 * Le condensat, écrit une fois.
 *
 * L'archive portable hachait déjà chaque asset pour prouver qu'il n'avait pas
 * bougé entre l'écriture et la relecture ; une release fait la même promesse
 * sur ses PNG rendus. Deux implémentations auraient dérivé sur la casse ou sur
 * l'encodage, et un manifeste dont le hachage n'est pas celui du vérificateur
 * ne prouve rien.
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function sha256OfBlob(blob: Blob): Promise<string> {
  return sha256Hex(new Uint8Array(await blob.arrayBuffer()))
}

/** L'empreinte d'un lot se calcule sur sa liste, pas sur ses octets. */
export async function sha256OfText(text: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(text))
}
