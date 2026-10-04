// Packed volume helpers shared by the Shipment form (client) and shipment service (server).
// Dimensions are stored in centimetres; shipping volume is expressed in cubic metres (CBM).

export interface DimSource {
  pack_length_cm?: string | number | null
  pack_width_cm?: string | number | null
  pack_height_cm?: string | number | null
  length_cm?: string | number | null
  width_cm?: string | number | null
  height_cm?: string | number | null
}

const positive = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function cbm(l: unknown, w: unknown, h: unknown): number | null {
  const dims = [positive(l), positive(w), positive(h)]
  return dims.every((d) => d !== null) ? (dims[0]! * dims[1]! * dims[2]!) / 1_000_000 : null
}

/** Volume of ONE unit in CBM — packaging dimensions first, bare product dimensions as a fallback. */
export function unitVolumeCbm(p: DimSource | null | undefined): number | null {
  if (!p) return null
  return cbm(p.pack_length_cm, p.pack_width_cm, p.pack_height_cm) ?? cbm(p.length_cm, p.width_cm, p.height_cm)
}

/** Rounds to 6 decimals (1 cm³) so floating point noise never reaches the database. */
export const roundCbm = (n: number) => Math.round(n * 1_000_000) / 1_000_000
