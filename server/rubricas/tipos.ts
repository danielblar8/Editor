import type { TipoProblema } from '../../src/lib/revisionTipos.ts'
import type { TipoDocumentoId } from '../../src/lib/tiposDocumento.ts'

export type CriterioRubrica = {
  id: string
  descripcion: string
  queBuscar: string[]
  tipo_problema: TipoProblema
}

export type Rubrica = {
  id: TipoDocumentoId
  descripcion: string
  criterios: CriterioRubrica[]
}
