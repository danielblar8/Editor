import type { TipoDocumentoId } from '../../src/lib/tiposDocumento.ts'
import { rubricaEnsayoArgumentativo } from './ensayoArgumentativo.ts'
import { rubricaReporteInvestigacion } from './reporteInvestigacion.ts'
import type { Rubrica } from './tipos.ts'
import { rubricaTextoAbierto } from './textoAbierto.ts'

const RUBRICAS: Record<TipoDocumentoId, Rubrica> = {
  'ensayo-argumentativo': rubricaEnsayoArgumentativo,
  'reporte-investigacion': rubricaReporteInvestigacion,
  'texto-abierto': rubricaTextoAbierto,
}

export function obtenerRubrica(tipoDocumento: TipoDocumentoId): Rubrica {
  return RUBRICAS[tipoDocumento]
}

export function idsCriterios(tipoDocumento: TipoDocumentoId): string[] {
  return RUBRICAS[tipoDocumento].criterios.map((criterio) => criterio.id)
}
