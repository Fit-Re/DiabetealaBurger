import type { MedicationType } from "../types";

// Ficha de referencia general para medicamentos comunes en diabetes tipo 1.
// Es información educativa general (perfiles de acción típicos, precauciones
// generales) — NO reemplaza el prospecto del medicamento ni la indicación de
// tu equipo médico, que siempre define la dosis y el esquema real a seguir.
export interface MedicationReferenceEntry {
  slug: string;
  // El primer nombre es el canónico a mostrar; el resto son alias/nombres comerciales.
  names: string[];
  type: MedicationType;
  description: string;
  onset: string | null;
  peak: string | null;
  duration: string | null;
  precautions: string;
  doseCeiling: { amount: number; unit: string; note: string } | null;
  source: string;
}

export const MEDICATION_REFERENCE: MedicationReferenceEntry[] = [
  {
    slug: "glargina",
    names: ["Glargina", "Lantus", "Toujeo", "Basaglar"],
    type: "insulin_basal",
    description:
      "Insulina basal de acción prolongada, sin pico pronunciado, para cubrir el requerimiento de fondo durante 24 horas.",
    onset: "1-2 horas",
    peak: "Sin pico marcado (perfil relativamente plano)",
    duration: "20-24 horas",
    precautions:
      "No mezclar en la misma jeringa con otras insulinas. Cambios de horario de aplicación deben hacerse gradualmente.",
    doseCeiling: null,
    source: "Ficha técnica del fabricante / Standards of Care ADA",
  },
  {
    slug: "detemir",
    names: ["Detemir", "Levemir"],
    type: "insulin_basal",
    description: "Insulina basal de acción prolongada, en general aplicada una o dos veces al día.",
    onset: "1-2 horas",
    peak: "Pico leve, dosis-dependiente",
    duration: "12-24 horas (dosis-dependiente)",
    precautions: "La duración varía más con la dosis que otras basales; a dosis bajas puede durar menos de 24hs.",
    doseCeiling: null,
    source: "Ficha técnica del fabricante / Standards of Care ADA",
  },
  {
    slug: "degludec",
    names: ["Degludec", "Tresiba"],
    type: "insulin_basal",
    description: "Insulina basal ultra-prolongada, perfil muy plano.",
    onset: "30-90 minutos",
    peak: "Sin pico",
    duration: "Más de 42 horas",
    precautions:
      "Por su duración extendida, los ajustes de dosis tardan varios días en reflejarse completamente.",
    doseCeiling: null,
    source: "Ficha técnica del fabricante / Standards of Care ADA",
  },
  {
    slug: "nph",
    names: ["NPH", "Insulatard", "Humulin N"],
    type: "insulin_basal",
    description: "Insulina de acción intermedia, con pico más marcado que las basales modernas.",
    onset: "1-2 horas",
    peak: "4-12 horas",
    duration: "12-18 horas",
    precautions:
      "Su pico marcado aumenta el riesgo de hipoglucemia si no se acompaña con una comida en ese horario.",
    doseCeiling: null,
    source: "Ficha técnica del fabricante / Standards of Care ADA",
  },
  {
    slug: "lispro",
    names: ["Lispro", "Humalog"],
    type: "insulin_bolus",
    description: "Insulina de acción rápida (análogo), usada para cubrir comidas o corregir glucosa alta.",
    onset: "10-15 minutos",
    peak: "1-2 horas",
    duration: "3-5 horas",
    precautions: "Aplicar cerca del inicio de la comida (no mucho antes) para evitar hipoglucemia temprana.",
    doseCeiling: null,
    source: "Ficha técnica del fabricante / Standards of Care ADA",
  },
  {
    slug: "aspart",
    names: ["Aspart", "NovoRapid", "Novolog", "Fiasp"],
    type: "insulin_bolus",
    description: "Insulina de acción rápida (análogo), usada para cubrir comidas o corregir glucosa alta.",
    onset: "10-15 minutos (Fiasp aún más rápido)",
    peak: "1-2 horas",
    duration: "3-5 horas",
    precautions: "Aplicar cerca del inicio de la comida (no mucho antes) para evitar hipoglucemia temprana.",
    doseCeiling: null,
    source: "Ficha técnica del fabricante / Standards of Care ADA",
  },
  {
    slug: "glulisina",
    names: ["Glulisina", "Apidra"],
    type: "insulin_bolus",
    description: "Insulina de acción rápida (análogo), usada para cubrir comidas o corregir glucosa alta.",
    onset: "10-15 minutos",
    peak: "1-2 horas",
    duration: "3-5 horas",
    precautions: "Aplicar cerca del inicio de la comida (no mucho antes) para evitar hipoglucemia temprana.",
    doseCeiling: null,
    source: "Ficha técnica del fabricante / Standards of Care ADA",
  },
  {
    slug: "regular",
    names: ["Regular", "Actrapid", "Humulin R"],
    type: "insulin_bolus",
    description: "Insulina humana de acción corta (no análoga), más lenta que los análogos rápidos.",
    onset: "30 minutos",
    peak: "2-4 horas",
    duration: "6-8 horas",
    precautions: "Requiere aplicarse con más anticipación a la comida (20-30 min antes) que los análogos rápidos.",
    doseCeiling: null,
    source: "Ficha técnica del fabricante / Standards of Care ADA",
  },
  {
    slug: "metformina",
    names: ["Metformina", "Glucophage"],
    type: "sensitizer",
    description:
      "Sensibilizador a la insulina, de uso más común en diabetes tipo 2 pero a veces usado en tipo 1 con resistencia a la insulina, siempre indicado por el equipo médico.",
    onset: "Días (efecto acumulativo, no es de acción inmediata)",
    peak: null,
    duration: "Efecto sostenido con tomas regulares",
    precautions:
      "Tomar con alimentos para reducir molestias digestivas. Suspender antes de estudios con contraste yodado según indique tu médico.",
    doseCeiling: { amount: 2550, unit: "mg/día", note: "techo habitual de dosis diaria total en adultos (liberación inmediata)" },
    source: "Ficha técnica del fabricante / Standards of Care ADA",
  },
  {
    slug: "glucagon",
    names: ["Glucagón", "Gvoke", "Baqsimi"],
    type: "other",
    description: "Hormona de rescate para hipoglucemia severa cuando la persona no puede tragar con seguridad.",
    onset: "10-15 minutos",
    peak: null,
    duration: "Efecto breve — igual requiere ingesta de carbohidratos después y contacto con el equipo médico",
    precautions:
      "Es para emergencias, no para uso rutinario. Puede causar náuseas al recuperar la conciencia.",
    doseCeiling: null,
    source: "Ficha técnica del fabricante",
  },
];

export function findMedicationReference(query: string): MedicationReferenceEntry | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;
  return (
    MEDICATION_REFERENCE.find((entry) =>
      entry.names.some((n) => n.toLowerCase() === normalized)
    ) ??
    MEDICATION_REFERENCE.find((entry) =>
      entry.names.some((n) => n.toLowerCase().includes(normalized) || normalized.includes(n.toLowerCase()))
    ) ??
    null
  );
}

export function searchMedicationReference(query: string, limit: number = 5): MedicationReferenceEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return MEDICATION_REFERENCE.filter((entry) =>
    entry.names.some((n) => n.toLowerCase().includes(normalized))
  ).slice(0, limit);
}

// Notas de interacción a nivel de TIPO de medicamento (no de droga específica).
// Deliberadamente genéricas y conservadoras: solo un recordatorio para conversar
// con el equipo médico, nunca una indicación de ajuste de tratamiento.
export interface InteractionNote {
  types: [MedicationType, MedicationType];
  note: string;
}

export const INTERACTION_NOTES: InteractionNote[] = [
  {
    types: ["insulin_basal", "sensitizer"],
    note:
      "Combinar insulina basal con un sensibilizador (ej. metformina) es común, pero puede aumentar el riesgo de hipoglucemia, especialmente con ejercicio. Coméntalo con tu equipo médico si notas más bajadas de lo habitual.",
  },
  {
    types: ["insulin_bolus", "sensitizer"],
    note:
      "Combinar insulina rápida con un sensibilizador (ej. metformina) es común, pero puede aumentar el riesgo de hipoglucemia, especialmente con ejercicio. Coméntalo con tu equipo médico si notas más bajadas de lo habitual.",
  },
  {
    types: ["insulin_basal", "supplement"],
    note:
      "Algunos suplementos (ej. canela, cromo, ácido alfa-lipoico) pueden potenciar el efecto de la insulina. Coméntaselo a tu equipo médico si tomás suplementos junto con insulina.",
  },
  {
    types: ["insulin_bolus", "supplement"],
    note:
      "Algunos suplementos (ej. canela, cromo, ácido alfa-lipoico) pueden potenciar el efecto de la insulina. Coméntaselo a tu equipo médico si tomás suplementos junto con insulina.",
  },
];

export function findInteractionNotes(activeTypes: MedicationType[]): InteractionNote[] {
  const uniqueTypes = new Set(activeTypes);
  return INTERACTION_NOTES.filter(
    ({ types: [a, b] }) => uniqueTypes.has(a) && uniqueTypes.has(b)
  );
}
