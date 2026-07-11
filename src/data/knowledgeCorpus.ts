import type { KnowledgeCorpusEntry } from "../types";

// Corpus curado de guías clínicas y papers revisados por pares sobre manejo de
// diabetes tipo 1. Cada entrada se embebe con Voyage AI y se usa como base de
// evidencia para las recomendaciones generadas por la app (RAG).
export const KNOWLEDGE_CORPUS: KnowledgeCorpusEntry[] = [
  {
    id: "battelino-2019-tir-consensus",
    title:
      "Clinical Targets for Continuous Glucose Monitoring Data Interpretation: Recommendations From the International Consensus on Time in Range",
    authors: "Battelino T, et al. (ATTD Congress international panel)",
    year: 2019,
    source: "Diabetes Care",
    url: "https://doi.org/10.2337/dci19-0028",
    topic: "cgm_targets",
    summary:
      "Consenso internacional (ATTD 2019) que establece las métricas y objetivos estándar para interpretar datos de monitorización continua de glucosa (CGM), incluyendo el tiempo en rango (TIR). El panel de expertos en tecnologías de diabetes unificó recomendaciones previamente dispersas en tres publicaciones para dar guía práctica a equipos clínicos y personas con diabetes sobre el uso de métricas de CGM.",
  },
  {
    id: "ispad-2022-glycemic-targets",
    title:
      "ISPAD Clinical Practice Consensus Guidelines 2022: Glycemic targets and glucose monitoring for children, adolescents, and young people with diabetes",
    authors: "de Bock M, Codner E, Craig ME, et al. (ISPAD)",
    year: 2022,
    source: "Pediatric Diabetes",
    url: "https://doi.org/10.1111/pedi.13455",
    topic: "cgm_targets",
    summary:
      "Guía de consenso clínico de ISPAD (2022) dedicada específicamente a los objetivos glucémicos y a la monitorización de glucosa en niños, adolescentes y adultos jóvenes con diabetes tipo 1. Forma parte de la serie de guías ISPAD 2022, referencia pediátrica junto a las guías ADA/ATTD para el manejo de la diabetes tipo 1.",
  },
  {
    id: "ispad-2022-editorial",
    title: "ISPAD Clinical Practice Consensus Guidelines 2022: Editorial",
    authors: "Craig ME, Codner E, Mahmud FH, et al. (ISPAD)",
    year: 2022,
    source: "Pediatric Diabetes",
    url: "https://doi.org/10.1111/pedi.13441",
    topic: "cgm_targets",
    summary:
      "Editorial que introduce la actualización 2022 de las guías de consenso de práctica clínica de ISPAD, con palabras clave centradas en monitorización continua de glucosa, objetivos glucémicos, tiempo en rango, hipoglucemia, insulina y mortalidad en diabetes tipo 1 pediátrica. Sitúa el marco general de las guías ISPAD usadas junto con el consenso ATTD/Battelino para definir objetivos de TIR.",
  },
  {
    id: "camerlingo-2021-tir-duration",
    title:
      "Choosing the duration of continuous glucose monitoring for reliable assessment of time in range: A new analytical approach to overcome the limitations of correlation-based methods",
    authors: "Camerlingo N, Vettoretti M, Sparacino G, et al.",
    year: 2021,
    source: "Diabetic Medicine",
    url: "https://doi.org/10.1111/dme.14758",
    topic: "cgm_targets",
    summary:
      "Estudio metodológico que compara dos enfoques para determinar cuántos días de datos de CGM se necesitan para estimar de forma fiable el tiempo en rango (70-180 mg/dL). El enfoque basado en ecuación resultó más robusto, sugiriendo alrededor de 17-18 días de monitorización para lograr un intervalo de confianza del 5% en torno al TIR estimado, información relevante para diseñar el seguimiento de datos de CGM en autogestión.",
  },
  {
    id: "elbarbary-2021-trend-arrows",
    title:
      "Use of continuous glucose monitoring trend arrows in the younger population with type 1 diabetes",
    authors: "Elbarbary N, Moser O, Al Yaarubi S, et al.",
    year: 2021,
    source: "Diabetes & Vascular Disease Research",
    url: "https://doi.org/10.1177/14791641211062155",
    topic: "cgm_targets",
    summary:
      "Documento de consenso que resume la evidencia sobre el uso de flechas de tendencia de CGM en niños y adolescentes con diabetes tipo 1, incluyendo cómo ajustar dosis de insulina según la tasa de cambio de glucosa en situaciones especiales como ejercicio, ayuno e hipoglucemia nocturna. Destaca que la comprensión adecuada de las flechas de tendencia puede optimizar el control glucémico.",
  },
  {
    id: "ada-2024-summary-revisions",
    title: "Summary of Revisions: Standards of Care in Diabetes—2024",
    authors: "American Diabetes Association Professional Practice Committee",
    year: 2024,
    source: "Diabetes Care",
    url: "https://doi.org/10.2337/dc24-SREV",
    topic: "cgm_targets",
    summary:
      "Resumen oficial de las revisiones anuales de los Standards of Care in Diabetes de la American Diabetes Association para 2024, documento de referencia que se actualiza cada año y que junto con las guías ISPAD y el consenso ATTD/Battelino conforma el marco de objetivos glucémicos, uso de CGM y manejo integral recomendado para personas con diabetes tipo 1.",
  },
  {
    id: "rybicka-2011-dawn-somogyi",
    title:
      "The dawn phenomenon and the Somogyi effect - two phenomena of morning hyperglycaemia",
    authors: "Rybicka M, Krysiak R, Okopień B",
    year: 2011,
    source: "Endokrynologia Polska",
    url: null,
    topic: "dawn_phenomenon",
    summary:
      "Revisión que diferencia el fenómeno del alba (disminución de la secreción endógena de insulina o del efecto de la insulina exógena junto con aumento fisiológico de hormonas contrarreguladoras) del efecto Somogyi (hiperglucemia de rebote tras exceso de insulina exógena). Recomienda medir glucosa entre las 3 y 5 a.m. o usar CGM para diferenciarlos, ya que su tratamiento difiere.",
  },
  {
    id: "carroll-schade-2005-dawn-revisited",
    title: "The dawn phenomenon revisited: implications for diabetes therapy",
    authors: "Carroll MF, Schade DS",
    year: 2005,
    source: "Endocrine Practice",
    url: "https://doi.org/10.4158/EP.11.1.55",
    topic: "dawn_phenomenon",
    summary:
      "Revisión que propone una definición cuantitativa del fenómeno del alba (aumento de glucosa >10 mg/dL o incremento ≥20% en requerimiento de insulina durante la madrugada sin hipoglucemia previa) y estima que ocurre en aproximadamente el 54% de personas con diabetes tipo 1. El mecanismo más probable es la resistencia a la insulina mediada por hormona de crecimiento a nivel hepático y muscular.",
  },
  {
    id: "bouchonville-2014-csii-dawn",
    title:
      "The Effectiveness and Risks of Programming an Insulin Pump to Counteract the Dawn Phenomenon in Type 1 Diabetes",
    authors: "Bouchonville M, Jaghab J, Duran-Valdez E, Schrader R, Schade D",
    year: 2014,
    source: "Endocrine Practice",
    url: "https://doi.org/10.4158/EP14198.OR",
    topic: "dawn_phenomenon",
    summary:
      "Estudio longitudinal observacional en 40 personas con diabetes tipo 1 que encontró que el fenómeno del alba ocurrió en todos los sujetos de forma variable (mediana 56% de noches) y que programar un aumento fijo de insulina basal de madrugada en la bomba no redujo su frecuencia (42% vs 48%, p=0.47), pero sí aumentó significativamente la hipoglucemia (37% vs 18%, p=0.001). Concluye que este ajuste fijo es ineficaz y potencialmente peligroso.",
  },
  {
    id: "takayoshi-2024-rapid-insulin-dawn",
    title:
      "Impact of early-morning administration of rapid-acting insulin on the increase in blood glucose levels related to the dawn phenomenon in individuals with type 1 diabetes",
    authors: "Takayoshi T, Hirota Y, Yamamoto A, et al.",
    year: 2024,
    source: "Diabetology International",
    url: "https://doi.org/10.1007/s13340-024-00709-6",
    topic: "dawn_phenomenon",
    summary:
      "Estudio retrospectivo en 13 personas con diabetes tipo 1 que mostró que administrar una dosis pequeña (0.5-1 unidad) de insulina rápida al despertar redujo significativamente la variabilidad glucémica de 2 horas antes/después del desayuno (de una mediana de 90.7 a 51.0 mg/dL) y la glucosa promedio diaria (de 192.7 a 156.7 mg/dL), sugiriendo una estrategia eficaz para contrarrestar el fenómeno del alba sin usar bomba de insulina.",
  },
  {
    id: "riddell-2017-exercise-consensus",
    title: "Exercise management in type 1 diabetes: a consensus statement",
    authors: "Riddell MC, Gallen IW, Smart CE, et al.",
    year: 2017,
    source: "The Lancet Diabetes & Endocrinology",
    url: "https://doi.org/10.1016/S2213-8587(17)30014-1",
    topic: "exercise",
    summary:
      "Declaración de consenso de referencia sobre manejo del ejercicio en diabetes tipo 1, que ofrece objetivos de glucosa para hacer ejercicio de forma segura y eficaz, junto con ajustes nutricionales y de dosis de insulina para prevenir tanto la hipoglucemia como la pérdida de control glucémico asociadas al ejercicio. Señala que el miedo a la hipoglucemia y el conocimiento inadecuado son barreras importantes para la actividad física regular en esta población.",
  },
  {
    id: "ispad-2022-exercise",
    title:
      "ISPAD Clinical Practice Consensus Guidelines 2022: Exercise in children and adolescents with diabetes",
    authors: "Adolfsson P, Taplin CE, Zaharieva DP, et al. (ISPAD)",
    year: 2022,
    source: "Pediatric Diabetes",
    url: "https://doi.org/10.1111/pedi.13452",
    topic: "exercise",
    summary:
      "Guía de consenso pediátrico de ISPAD (2022) dedicada al ejercicio en niños y adolescentes con diabetes, parte del conjunto de guías ISPAD que complementan el consenso de 2017 de Riddell et al. con recomendaciones específicas para la población pediátrica sobre manejo de la glucosa antes, durante y después de la actividad física.",
  },
  {
    id: "basset-sagarminaga-2025-aid-exercise",
    title:
      "Safety and glycaemic control during exercise with the MiniMed 780G: A narrative review of evidence from lab to real world",
    authors: "Basset-Sagarminaga J, De Block C, Nørgaard K, et al.",
    year: 2025,
    source: "Diabetes, Obesity & Metabolism",
    url: "https://doi.org/10.1111/dom.70211",
    topic: "exercise",
    summary:
      "Revisión narrativa sobre seguridad y control glucémico durante el ejercicio con un sistema de administración automatizada de insulina (MiniMed 780G) en personas con diabetes tipo 1, de quienes más de dos tercios permanecen insuficientemente activos por miedo a la hipoglucemia. La activación de un objetivo temporal de glucosa 60-120 minutos antes del ejercicio, combinada con reducción del bolo de comida, disminuyó significativamente el riesgo de hipoglucemia, con mejores resultados documentados en ejercicio aeróbico de intensidad moderada.",
  },
  {
    id: "pereira-2022-sbd-exercise-position",
    title:
      "2022: Position of Brazilian Diabetes Society on exercise recommendations for people with type 1 and type 2 diabetes",
    authors:
      "Pereira WVC, Vancea DMM, de Andrade Oliveira R, et al. (Brazilian Diabetes Society)",
    year: 2022,
    source: "Diabetology & Metabolic Syndrome",
    url: "https://doi.org/10.1186/s13098-022-00945-3",
    topic: "exercise",
    summary:
      "Documento de posición de la Sociedad Brasileña de Diabetes que ofrece 17 recomendaciones basadas en evidencia sobre ejercicio en diabetes tipo 1 y tipo 2. Recomienda combinar ejercicio aeróbico y de resistencia, y enfatiza que las personas con diabetes tipo 1 que usan insulina deben monitorizar la glucemia antes, durante y después del ejercicio para minimizar el riesgo de hipoglucemia.",
  },
  {
    id: "griggs-2020-sleep-glucose-adolescents",
    title: "Daily variations in sleep and glucose in adolescents with type 1 diabetes",
    authors: "Griggs S, Redeker NS, Jeon S, Grey M",
    year: 2020,
    source: "Pediatric Diabetes",
    url: "https://doi.org/10.1111/pedi.13117",
    topic: "sleep",
    summary:
      "Estudio con actigrafía y CGM concurrentes en adolescentes con diabetes tipo 1 que encontró que una mayor variabilidad glucémica se asoció, a nivel intraindividual, con más interrupciones del sueño (más despertares y fragmentación) y peor calidad de sueño. Más tiempo en hipoglucemia (<70 mg/dL) y un índice de riesgo de glucosa baja más alto se asociaron con un despertar más temprano, indicando peor sueño esa noche.",
  },
  {
    id: "ipar-2023-sleep-chronotype-youth",
    title:
      "Associations between sleep characteristics and glycemic variability in youth with type 1 diabetes",
    authors: "İpar N, Boran P, Barış HE, et al.",
    year: 2023,
    source: "Sleep Medicine",
    url: "https://doi.org/10.1016/j.sleep.2023.06.018",
    topic: "sleep",
    summary:
      "Estudio transversal en 84 niños con diabetes tipo 1 que halló que el 88% tenía un tiempo total de sueño insuficiente para su edad. Una preferencia de cronotipo vespertino ('eveningness') se asoció con más tiempo en hipoglucemia, y una menor eficiencia de sueño junto con mayor latencia de inicio del sueño se asociaron con mayor variabilidad glucémica nocturna, sugiriendo que la calidad del sueño (más que su duración total) es clave para la variabilidad glucémica.",
  },
  {
    id: "griggs-2022-sleep-glucoregulation-young-adults",
    title:
      "Variations in Sleep Characteristics and Glucose Regulation in Young Adults With Type 1 Diabetes",
    authors: "Griggs S, Grey M, Strohl KP, et al.",
    year: 2022,
    source: "The Journal of Clinical Endocrinology & Metabolism",
    url: "https://doi.org/10.1210/clinem/dgab771",
    topic: "sleep",
    summary:
      "Estudio con actigrafía y CGM en 42 adultos jóvenes con diabetes tipo 1 que demostró una relación bidireccional entre sueño y glucosa: una menor eficiencia del sueño predijo mayor variabilidad glucémica (menos tiempo en rango, más hiperglucemia), mientras que una mayor variabilidad glucémica predijo peor sueño (acostarse y despertar más tarde, menor eficiencia). Concluye que optimizar los hábitos de sueño y mantener un rango euglucémico nocturno es un objetivo modificable en el cuidado de la diabetes.",
  },
  {
    id: "zilioli-2017-socioeconomic-stress-cortisol",
    title:
      "Biopsychosocial pathways linking subjective socioeconomic disadvantage to glycemic control in youths with type I diabetes",
    authors: "Zilioli S, Ellis DA, Carré JM, Slatcher RB",
    year: 2017,
    source: "Psychoneuroendocrinology",
    url: "https://doi.org/10.1016/j.psyneuen.2017.01.033",
    topic: "stress",
    summary:
      "Estudio en jóvenes adultos (17-20 años) con diabetes tipo 1 que encontró que la desventaja socioeconómica subjetiva se asoció con un ritmo de cortisol diurno más plano, mediado por el estrés percibido relacionado con la diabetes. Este ritmo de cortisol aplanado se asoció a su vez con niveles más altos de HbA1c (aunque no con la glucosa media medida por CGM), sugiriendo una vía biopsicosocial entre el estrés y el control glucémico.",
  },
  {
    id: "davis-2024-stress-distress-biomarkers-children",
    title:
      "Relationships Among Stress, Diabetes Distress, and Biomarkers in Children with Type 1 Diabetes Mellitus from Diverse Income and Racial Backgrounds",
    authors: "Davis SL, Jaser SS, Ivankova N, Rice M",
    year: 2024,
    source: "Journal of Pediatric Health Care",
    url: "https://doi.org/10.1016/j.pedhc.2024.08.012",
    topic: "stress",
    summary:
      "Estudio transversal en 34 niños de 8-12 años con diabetes tipo 1 que encontró efectos de tamaño medio a grande entre el estrés percibido y la HbA1c, y que el cortisol salival y la interleucina-8 podrían mediar esta relación. La mayoría de los niños no cumplió los objetivos de HbA1c recomendados por la ADA, con niveles más altos en niños afroamericanos, subrayando el papel del estrés psicológico en el control glucémico infantil.",
  },
  {
    id: "davis-2018-depressive-stress-cortisol-pilot",
    title:
      "Depressive Symptoms, Perceived Stress, and Cortisol in School-Age Children With Type 1 Diabetes: A Pilot Study",
    authors: "Davis SL, Kaulfers AM, Lochman JE, Morrison SA, Pryor ER, Rice M",
    year: 2018,
    source: "Biological Research for Nursing",
    url: "https://doi.org/10.1177/1099800418813713",
    topic: "stress",
    summary:
      "Estudio piloto de factibilidad en 30 niños en edad escolar con diabetes tipo 1 (HbA1c entre 6.1% y 12.2%) que exploró el cortisol como posible mediador entre síntomas depresivos, estrés percibido y control glucémico. De los niños evaluados, 18 mostraron el declive normal de cortisol a lo largo de 3 horas mientras que 12 mostraron aumentos, apoyando la necesidad de investigar más a fondo el cortisol como mediador en muestras más grandes.",
  },
  {
    id: "guan-2018-acute-stress-autonomic",
    title:
      "Glucose control and autonomic response during acute stress in youth with type 1 diabetes: A pilot study",
    authors: "Guan L, Metzger DL, Lavoie PM, Collet JP",
    year: 2018,
    source: "Pediatric Diabetes",
    url: "https://doi.org/10.1111/pedi.12680",
    topic: "stress",
    summary:
      "Estudio piloto en 20 jóvenes con diabetes tipo 1 que encontró una fuerte correlación entre los cambios en la variabilidad de la frecuencia cardíaca (respuesta autonómica) durante una prueba de estrés agudo y los valores de HbA1c (ρ=0.74, p<.001). Los jóvenes con HbA1c ≥7.5% mostraron una mayor amplitud de cambios autonómicos y puntuaciones más altas de estrés percibido que aquellos con mejor control, sugiriendo una relación entre el control glucémico crónico y la disfunción autonómica inducida por estrés.",
  },
  {
    id: "amorim-2024-carb-counting-accuracy",
    title: "Assessing Carbohydrate Counting Accuracy: Current Limitations and Future Directions",
    authors: "Amorim D, Miranda F, Santos A, et al.",
    year: 2024,
    source: "Nutrients",
    url: "https://doi.org/10.3390/nu16142183",
    topic: "carb_counting",
    summary:
      "Revisión que examina las limitaciones actuales en la precisión del conteo de carbohidratos (CC) para el cálculo de bolos de insulina prandial en diabetes tipo 1, señalando que estimar con exactitud el contenido de carbohidratos de las comidas sigue siendo un desafío que genera errores en la dosificación de insulina. Enfatiza la necesidad de programas educativos personalizados y herramientas de evaluación individualizadas para mejorar la precisión del CC y el control glucémico.",
  },
  {
    id: "ladyzynski-2018-voice-carb-counting",
    title:
      "Accuracy of Automatic Carbohydrate, Protein, Fat and Calorie Counting Based on Voice Descriptions of Meals in People with Type 1 Diabetes",
    authors: "Ladyzynski P, Krzymien J, Foltynski P, Rachuta M, Bonalska B",
    year: 2018,
    source: "Nutrients",
    url: "https://doi.org/10.3390/nu10040518",
    topic: "carb_counting",
    summary:
      "Estudio comparativo en 30 pacientes hospitalizados con diabetes tipo 1 inestable (HbA1c media 8.4%) que evaluó un sistema experto (VoiceDiab) de conteo automático de macronutrientes basado en descripciones orales de comidas, frente al conteo de referencia hecho por un dietista. Las diferencias entre ambos métodos fueron estadísticamente significativas pero de magnitud reducida, sin impacto relevante en el control glucémico de los pacientes al calcular las dosis de insulina.",
  },
  {
    id: "gingras-2017-postprandial-closed-loop",
    title:
      "The challenges of achieving postprandial glucose control using closed-loop systems in patients with type 1 diabetes",
    authors: "Gingras V, Taleb N, Roy-Fleming A, Legault L, Rabasa-Lhoret R",
    year: 2017,
    source: "Diabetes, Obesity & Metabolism",
    url: "https://doi.org/10.1111/dom.13052",
    topic: "carb_counting",
    summary:
      "Revisión que analiza las estrategias de dosificación de insulina en el momento de las comidas en sistemas de asa cerrada para diabetes tipo 1, destacando que los bolos ajustados por conteo de carbohidratos siguen siendo más eficaces para el control glucémico postprandial que la detección automática de comidas, aunque suponen una carga de conteo de carbohidratos para el paciente.",
  },
  {
    id: "morales-schneider-2014-hypoglycemia-review",
    title: "Hypoglycemia",
    authors: "Morales J, Schneider D",
    year: 2014,
    source: "The American Journal of Medicine",
    url: "https://doi.org/10.1016/j.amjmed.2014.07.004",
    topic: "hypoglycemia",
    summary:
      "Revisión general sobre hipoglucemia en diabetes que señala que el régimen de tratamiento y los antecedentes de hipoglucemia son los predictores más importantes de eventos futuros, y que solo un 5% de los pacientes concentra más del 50% de los episodios. La hipoglucemia grave se asocia con mayor riesgo de mortalidad, deterioro cognitivo y peor calidad de vida, siendo particularmente relevante en diabetes tipo 1.",
  },
  {
    id: "wilson-2015-nocturnal-hypo-factors",
    title:
      "Factors associated with nocturnal hypoglycemia in at-risk adolescents and young adults with type 1 diabetes",
    authors: "Wilson DM, Calhoun PM, Maahs DM, et al.",
    year: 2015,
    source: "Diabetes Technology & Therapeutics",
    url: "https://doi.org/10.1089/dia.2014.0342",
    topic: "hypoglycemia",
    summary:
      "Análisis de 855 noches de datos de CGM en 45 sujetos de 15-45 años con diabetes tipo 1 que encontró hipoglucemia nocturna en el 25% de las noches. Fue más frecuente con menor edad, HbA1c más baja, ejercicio de intensidad media/alta el día anterior y presencia de hipoglucemia diurna previa, mientras que el snack antes de dormir y la dosis de insulina basal/bolo no mostraron asociación significativa.",
  },
  {
    id: "urakami-2020-severe-hypoglycemia-children",
    title: "Severe Hypoglycemia: Is It Still a Threat for Children and Adolescents With Type 1 Diabetes?",
    authors: "Urakami T",
    year: 2020,
    source: "Frontiers in Endocrinology",
    url: "https://doi.org/10.3389/fendo.2020.00609",
    topic: "hypoglycemia",
    summary:
      "Revisión que señala que la hipoglucemia grave sigue causando entre el 4-10% de las muertes en niños y adolescentes con diabetes tipo 1, aunque su incidencia ha disminuido en las últimas décadas. Identifica como factores de riesgo la menor edad, la hipoglucemia recurrente o nocturna previa y la alteración de la percepción de hipoglucemia, y destaca que tecnologías como CGM y los sistemas de asa cerrada híbrida son las herramientas más prometedoras para prevenirla sin empeorar el control glucémico global.",
  },
  {
    id: "ispad-2022-hypoglycemia",
    title:
      "ISPAD Clinical Practice Consensus Guidelines 2022: Assessment and management of hypoglycemia in children and adolescents with diabetes",
    authors: "Abraham MB, Karges B, Dovc K, et al. (ISPAD)",
    year: 2022,
    source: "Pediatric Diabetes",
    url: "https://doi.org/10.1111/pedi.13443",
    topic: "hypoglycemia",
    summary:
      "Guía de consenso de ISPAD (2022) dedicada a la evaluación y manejo de la hipoglucemia en niños y adolescentes con diabetes, con palabras clave centradas en glucagón, hipoglucemia y alteración de la percepción de hipoglucemia. Forma parte del conjunto de guías pediátricas ISPAD 2022 usadas como referencia junto con las guías ADA para definir umbrales y manejo de la hipoglucemia.",
  },
];
