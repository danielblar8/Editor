import type { Rubrica } from './tipos.ts'

export const rubricaTextoAbierto: Rubrica = {
  id: 'texto-abierto',
  descripcion: 'Sin rúbrica rígida: valora claridad, cohesión y progresión.',
  criterios: [
    {
      id: 'abierto.coherencia',
      descripcion: 'El texto mantiene una coherencia interna.',
      queBuscar: [
        'cambios de tema sin transición',
        'un cierre que no se corresponde con lo anterior',
      ],
      tipo_problema: 'conclusion_incoherente',
    },
    {
      id: 'abierto.progresion',
      descripcion: 'Las ideas progresan y no se repiten sin avance.',
      queBuscar: ['saltos entre ideas', 'afirmaciones sin desarrollo'],
      tipo_problema: 'hueco_argumental',
    },
    {
      id: 'abierto.desarrollo',
      descripcion: 'Las ideas se desarrollan y no quedan solo enunciadas.',
      queBuscar: [
        'bloques centrales muy breves',
        'una idea principal sin explicación',
      ],
      tipo_problema: 'desarrollo_corto',
    },
    {
      id: 'abierto.cierre',
      descripcion: 'El cierre corresponde a lo planteado antes.',
      queBuscar: ['temas nuevos al final', 'un final desconectado del resto'],
      tipo_problema: 'idea_nueva_en_conclusion',
    },
    {
      id: 'abierto.equilibrio',
      descripcion: 'Se detectan saltos, vacíos o desequilibrios entre partes.',
      queBuscar: ['una parte mucho más extensa que las demás'],
      tipo_problema: 'desequilibrio_entre_secciones',
    },
  ],
}
