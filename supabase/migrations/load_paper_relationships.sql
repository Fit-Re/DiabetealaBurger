-- Load paper relationships (edges) into paper_relationships table
-- Auto-detected edges based on topic overlap + evidence level compatibility

BEGIN;

-- Key relationships: AID <-> Sleep cluster
INSERT INTO paper_relationships (paper_id_a, paper_id_b, edge_type, weight, reasoning) VALUES
('dekker-2024-minimed780g', 'madrid-victorin-2024-closed-loop-sleep', 'complementary', 0.85, 'Both on closed-loop systems; complement on sleep outcomes'),
('dekker-2024-minimed780g', 'malone-2022-hcl-sleep', 'semantic_similar', 0.80, 'HCL systems improve sleep and glucose control'),
('malone-2022-hcl-sleep', 'chakrabarti-2022-oracl-sleep', 'complementary', 0.82, 'Both HCL sleep studies; ORACL extends to older adults'),
('chakrabarti-2022-oracl-sleep', 'sorensen-2026-aid-sleep-meta', 'enables', 0.90, 'ORACL is included in meta-analysis; enables synthesis'),
('madrid-victorin-2024-closed-loop-sleep', 'sorensen-2026-aid-sleep-meta', 'enables', 0.88, 'Madrid-Victorin findings support meta-analysis conclusions'),
('sorensen-2026-aid-sleep-meta', 'pham-2024-sleep-glycemic-variability', 'complementary', 0.78, 'Both analyze sleep-glycemia correlation'),
('pham-2024-sleep-glycemic-variability', 'huang-2024-osa-diabetes', 'topic_overlap', 0.75, 'Sleep disorders as comorbidity affecting glucose'),
('huang-2024-osa-diabetes', 'ljubicic-2024-parental-sleep', 'topic_overlap', 0.72, 'Sleep disruption impact on stress/cortisol'),
('ljubicic-2024-parental-sleep', 'sehgal-2023-diy-rtcgm', 'contradicts', 0.60, 'DIY CGM increases nighttime monitoring burden vs sleep quality'),

-- AID <-> Exercise/Activity
('moser-2024-aid-exercise', 'madrid-victorin-2024-closed-loop-sleep', 'enables', 0.80, 'Exercise optimization enables better sleep during AID'),
('moser-2024-aid-exercise', 'dekker-2024-minimed780g', 'complementary', 0.76, 'Exercise management within modern AID systems'),

-- Sleep <-> Mental Health
('pham-2024-sleep-glycemic-variability', 'armstrong-2024-distress-cardiovascular', 'enables', 0.75, 'Poor sleep worsens emotional distress; distress disrupts sleep'),
('huang-2024-osa-diabetes', 'arsenal-2024-distress-cardiovascular', 'topic_overlap', 0.68, 'Sleep apnea + distress both impact cardiovascular health'),

-- Mental Health cluster
('franc-2025-emotional-distress', 'rodriguez-munoz-2024-t1d-distress', 'complementary', 0.88, 'Both on T1D distress; Franc systematic review + Rodriguez operational framework'),
('rodriguez-munoz-2024-t1d-distress', 'vargas-2024-latinx-mental-health', 'enables', 0.82, 'Rodriguez framework explains Vargas disparities'),
('vargas-2024-latinx-mental-health', 'vayisoglu-2024-parent-depression', 'topic_overlap', 0.70, 'Mental health burden extends to family/caregivers'),
('vayisoglu-2024-parent-depression', 'hermanns-2024-symptoms-ecology', 'enables', 0.76, 'Parent distress + child distress create symptom amplification'),
('hermanns-2024-symptoms-ecology', 'mohr-2024-mydiamata-distress', 'enables', 0.79, 'Ecology study informs intervention design in MyREMEDY'),
('mohr-2024-mydiamata-distress', 'ehrmann-2024-diabetes-logbook-app', 'topic_overlap', 0.74, 'Digital tools reduce distress burden'),
('ehrmann-2024-diabetes-logbook-app', 'alzawahreh-2024-t1d-adolescent-empowerment', 'complementary', 0.80, 'Tech + empowerment improve self-efficacy + distress'),

-- Distress + Sleep interaction
('franc-2025-emotional-distress', 'pham-2024-sleep-glycemic-variability', 'enables', 0.77, 'Emotional distress impairs sleep quality'),
('rodriguez-munoz-2024-t1d-distress', 'ljubicic-2024-parental-sleep', 'enables', 0.75, 'T1D distress disrupts sleep in both patient + parent'),

-- Comorbidities cluster
('snaith-2025-t1d-therapies', 'sridhar-2023-t1d-ckd', 'complementary', 0.85, 'Snaith discusses novel therapies; Sridhar focuses on kidney protection'),
('sridhar-2023-t1d-ckd', 'andersen-2024-comorbidity', 'enables', 0.81, 'Sridhar therapeutics enable outcomes predicted by Andersen ML model'),
('andersen-2024-comorbidity', 'vassari-2026-findiconc', 'complementary', 0.84, 'Andersen ML methods applied to FinDiCon cohort'),
('vassari-2026-findiconc', 'bayrak-demirel-2024-thyroid-insulin-paralysis', 'enables', 0.65, 'FinDiCon data includes thyroid comorbidities like in Bayrak case'),
('snaith-2025-t1d-therapies', 'kusayev-2024-keto-cad', 'topic_overlap', 0.68, 'Both discuss cardiovascular risk in T1D nutrition'),

-- Comorbidities + Mental Health
('arsenal-2024-distress-cardiovascular', 'snaith-2025-t1d-therapies', 'enables', 0.76, 'Emotional distress is driver of cardiovascular complications; Snaith's cardiorenal approach'),

-- Biomarkers + Comorbidities
('senthil-kumar-2024-ctrp6', 'snaith-2025-t1d-therapies', 'enables', 0.72, 'CTRP6 biomarker informs therapeutic selection in Snaith framework'),
('lima-2024-myoinositol-dci', 'mimouni-2024-magnesium-pregnancy', 'topic_overlap', 0.70, 'Both on metabolic biomarkers in T1D pregnancy'),
('senthil-kumar-2024-ctrp6', 'stener-victorin-2024-pcos', 'topic_overlap', 0.67, 'Biomarkers in PCOS (common T1D comorbidity)'),

-- Pregnancy cluster
('mimouni-2024-magnesium-pregnancy', 'tschirhart-2024-distress', 'complementary', 0.76, 'Pregnancy complication (magnesium) + psychological burden (distress)'),

-- Insulin Optimization
('broesen-2023-insulin-degludec', 'karakus-2024-extended-hypo-hyper', 'enables', 0.78, 'Degludec reduces extended hypo; Karakus measures extended events'),
('karakus-2024-extended-hypo-hyper', 'sridhar-2023-t1d-ckd', 'topic_overlap', 0.65, 'Hypoglycemia + kidney disease both require insulin optimization'),

-- Technology cluster
('wong-2024-satisfaction', 'ehrmann-2024-diabetes-logbook-app', 'complementary', 0.76, 'Device satisfaction + digital logbook adoption'),
('lee-2024-cgm-disparities', 'wong-2024-satisfaction', 'enables', 0.74, 'Remote monitoring (Lee) enables device satisfaction (Wong)'),
('sehgal-2023-diy-rtcgm', 'lee-2024-cgm-disparities', 'topic_overlap', 0.72, 'Both on CGM accessibility + technology adoption'),
('priesterroth-2024-mental-load', 'ehrmann-2024-diabetes-logbook-app', 'enables', 0.77, 'Reducing mental load via digital tools'),

-- Diagnosis/Genetics
('menon-2024-antibody-negative-t1d', 'stener-victorin-2024-pcos', 'topic_overlap', 0.63, 'T1D variants + comorbidity genetics'),

-- Exercise interaction with sleep/hypo
('moser-2024-aid-exercise', 'pham-2024-sleep-glycemic-variability', 'time_lag', 0.75, 'Exercise (6-24h lag) affects nocturnal glucose + sleep'),
('moser-2024-aid-exercise', 'huang-2024-osa-diabetes', 'time_lag', 0.70, 'Exercise quality affects sleep quality (OSA risk)'),

-- Pediatric focus
('madrid-victorin-2024-closed-loop-sleep', 'alzawahreh-2024-t1d-adolescent-empowerment', 'topic_overlap', 0.72, 'Both on adolescent T1D outcomes'),
('menon-2024-antibody-negative-t1d', 'alzawahreh-2024-t1d-adolescent-empowerment', 'topic_overlap', 0.65, 'Pediatric/adolescent T1D populations'),
('stahl-2024-celiac', 'menon-2024-antibody-negative-t1d', 'topic_overlap', 0.61, 'Both on pediatric T1D + comorbidities'),

-- Infrastructure/tech papers
('priesterroth-2024-mental-load', 'wong-2024-satisfaction', 'enables', 0.73, 'Reducing mental load improves tech satisfaction'),
('barnard-kelly-2024-pro-consensus', 'ehrmann-2024-diabetes-logbook-app', 'enables', 0.78, 'PRO standardization improves app evaluation'),
('barnard-kelly-2024-pro-consensus', 'alkalze-2024-t1d-adolescent-empowerment', 'enables', 0.75, 'Standardized outcomes enable empowerment assessment')

ON CONFLICT (paper_id_a, paper_id_b, edge_type) DO NOTHING;

-- Verify insertion
SELECT COUNT(*) as relationships_loaded FROM paper_relationships;

-- Summary statistics
SELECT
  COUNT(DISTINCT paper_id_a) + COUNT(DISTINCT paper_id_b) as total_unique_papers,
  COUNT(*) as total_edges,
  ROUND(AVG(weight)::NUMERIC, 3) as avg_edge_weight
FROM paper_relationships;

COMMIT;
