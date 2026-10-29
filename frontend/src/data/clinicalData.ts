export type ClinicalProtocol = {
    id: string;
    name: string;
    introduction: string;
    diagnosis: string[];
    assessment: string[];
    treatmentPlan: string[];
    followUp: string[];
    references: string[];
    relatedProtocols: string[];
};

export const CLINICAL_PROTOCOLS: ClinicalProtocol[] = [
    {
        id: "heart-disease",
        name: "Heart Disease Management",
        introduction: "Comprehensive management of cardiovascular health, focusing on coronary artery disease and hypertension. Early identification and risk factor modification are critical for preventing adverse cardiac events and improving long-term survival.",
        diagnosis: [
            "ECG for rhythm and ischemia assessment.",
            "Echocardiogram for structural evaluation.",
            "Cardiac markers (Troponin T/I).",
            "Functional stress testing."
        ],
        assessment: [
            "Cardiovascular risk profile (ASCVD score).",
            "Standardized BP monitoring protocols.",
            "Lipid panel and metabolic screening.",
            "Functional capacity determination."
        ],
        treatmentPlan: [
            "Aspirin/Antiplatelet therapy where indicated.",
            "Statin therapy for lipid optimization.",
            "ACE inhibitors or ARBs for BP control.",
            "Beta-blockers for post-MI or HF patients."
        ],
        followUp: [
            "Monthly evaluation for first 3 months.",
            "Annual cardiac stress testing if symptomatic.",
            "Lipid profile every 6 months."
        ],
        references: [
            "AHA/ACC Heart Disease Guidelines 2024",
            "Journal of Cardiology Research, Vol 45.",
            "ESC Clinical Practice Protocols 2023."
        ],
        relatedProtocols: [
            "Hypertension Management",
            "Post-MI Care",
            "Stroke Prevention"
        ]
    },
    {
        id: "diabetes",
        name: "Diabetes Type II",
        introduction: "Management of Type II Diabetes Mellitus through glycemic control, lifestyle modification, and complication monitoring. Focus on maintaining HbA1c < 7% and preventing microvascular and macrovascular complications.",
        diagnosis: [
            "HbA1c >= 6.5% on two occasions.",
            "Fasting plasma glucose >= 126 mg/dL.",
            "Random glucose >= 200 mg/dL with symptoms.",
            "OGTT (75g) 2-hour glucose >= 200 mg/dL."
        ],
        assessment: [
            "Annual dilated eye examination.",
            "Comprehensive foot examination (monofilament).",
            "Urine albumin-to-creatinine ratio (UACR).",
            "Estimated GFR (eGFR) monitoring."
        ],
        treatmentPlan: [
            "First-line: Metformin (unless contraindicated).",
            "SGLT2 inhibitors or GLP-1 RAs for CV risk.",
            "Personalized medical nutrition therapy (MNT).",
            "Intensive lifestyle intervention (DSMES)."
        ],
        followUp: [
            "HbA1c testing every 3-6 months.",
            "Annual screening for diabetic retinopathy.",
            "Quarterly blood pressure assessment."
        ],
        references: [
            "ADA Standards of Care in Diabetes 2024",
            "Diabetes Care, 2024 Supplement 1.",
            "Lancet Endocrinology Guidelines 2023."
        ],
        relatedProtocols: [
            "Obesity Management",
            "CKD in Diabetics",
            "Dyslipidemia Treatment"
        ]
    },
    {
        id: "kidney-failure",
        name: "Kidney Failure Management",
        introduction: "Management of Chronic Kidney Disease (CKD) stages 3-5 and End-Stage Renal Disease (ESRD). Focus on slowing progression, managing anemia, and mineral bone disease, and preparing for renal replacement therapy.",
        diagnosis: [
            "eGFR < 60 mL/min/1.73m2 for > 3 months.",
            "Urinary albumin excretion >= 30 mg/24h.",
            "Renal ultrasound for structural changes.",
            "Serum creatinine and BUN trends."
        ],
        assessment: [
            "Serum electrolytes (K, Phos, Ca).",
            "Hemoglobin and Iron studies.",
            "Parathyroid hormone (PTH) levels.",
            "Volume status and BP control."
        ],
        treatmentPlan: [
            "Renin-angiotensin system blockade.",
            "Phosphate binders with meals.",
            "Erythropoiesis-stimulating agents (ESAs).",
            "Low-protein diet (pre-dialysis)."
        ],
        followUp: [
            "eGFR monitoring every 3-6 months.",
            "Vascular access planning in Stage 4.",
            "Monthly electrolyte panel for Stage 5."
        ],
        references: [
            "KDIGO 2024 Clinical Practice Guideline",
            "National Kidney Foundation (NKF) KDOQI.",
            "Journal of the ASN, Guidelines Review 2023."
        ],
        relatedProtocols: [
            "Dialysis Preparation",
            "Anemia Management in CKD",
            "Dietary Potassium Restriction"
        ]
    },
    {
        id: "diarrhea",
        name: "Acute Diarrhea Management",
        introduction: "Protocol for the management of acute infectious and non-infectious diarrhea. Main objectives are rehydration, identification of etiology, and prevention of transmission.",
        diagnosis: [
            "Stool culture for suspected bacterial infection.",
            "C. difficile toxin assay (PCR).",
            "Parasitology (O&P) if duration > 14 days.",
            "Electrolyte panel for dehydration assessment."
        ],
        assessment: [
            "Assessment of skin turgor and mucosa.",
            "Blood pressure (orthostatic changes).",
            "Frequency and character of bowel movements.",
            "Recent travel or antibiotic history."
        ],
        treatmentPlan: [
            "Oral Rehydration Therapy (ORT) first line.",
            "Loperamide (if non-bloody, no fever).",
            "Empiric antibiotics only in select cases.",
            "Probiotics for clinical symptom reduction."
        ],
        followUp: [
            "Re-evaluate in 48 hours if no improvement.",
            "Monitor weight in pediatric patients.",
            "Clearance cultures for specific pathogens."
        ],
        references: [
            "IDSA Guidelines for Infectious Diarrhea 2023",
            "WHO Rehydration Protocols 2022.",
            "Gastroenterology Practice Update 2024."
        ],
        relatedProtocols: [
            "Fluid Resuscitation",
            "C. Difficile Infection",
            "Pediatric Dehydration"
        ]
    },
    {
        id: "cancer",
        name: "Oncology General Protocol",
        introduction: "Standardized framework for multicentric oncology management. Focus on early staging, multidisciplinary tumor board review, and patient-centered survivorship planning.",
        diagnosis: [
            "Histopathological confirmation (biopsy).",
            "Radiological staging (CT/MRI/PET).",
            "Genetic/Molecular profiling where indicated.",
            "Tumor markers (CEA, PSA, CA-125)."
        ],
        assessment: [
            "Performance Status (ECOG or Karnofsky).",
            "Nutritional screening and body mass.",
            "Psychosocial and pain assessment.",
            "Baseline organ function (Liver/Renal)."
        ],
        treatmentPlan: [
            "Surgical oncology consultation.",
            "Chemotherapy/Immunotherapy regimen.",
            "Radiation therapy planning.",
            "Palliative care integration early."
        ],
        followUp: [
            "Surveillance imaging every 3-6 months.",
            "Continuous psychosocial support.",
            "Annual second-primary screening."
        ],
        references: [
            "NCCN Guidelines Version 1.2024",
            "ASCO Clinical Excellence Standards.",
            "ESMO Handbook on Oncology 2023."
        ],
        relatedProtocols: [
            "Pain Management",
            "Chemotherapy Safety",
            "End-of-Life Care"
        ]
    }
];
