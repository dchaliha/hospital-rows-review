// Generates public/data/labels.json and public/data/batch.json (mock batch, two documents).
// Every clean row's quote is embedded verbatim in its page text; the planted problems are:
//   3 quote_not_on_page (one paraphrase, one single-word change, one page-number error),
//   4 inferred, 2 no fit, 1 runs_disagree, 1 over_limit, 1 dup, 2 needs_look.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
mkdirSync(out, { recursive: true })

const labelSet = {
  version: 'codebook-sample-14-v1',
  labels: [
    'Food assistance', 'Housing assistance', 'Education and Workforce', 'Vaccine Access',
    'Mental Health, Substance Use Disorder, Addiction Services', 'Crime/Violence', 'Smoking/Vaping',
    'Weight Management and Obesity', 'Mobile/Remote Clinics', 'Rural Health/Rural Clinics',
    'Immigrant Health Access', "Women's Health", 'Financial/Insurance Assistance', 'Safety Net Assistance',
  ],
  noFit: 'no fit',
  roles: ['runs it', 'partners', 'funds it', 'names it a priority'],
  quoteWordLimit: 40,
}
writeFileSync(join(out, 'labels.json'), JSON.stringify(labelSet, null, 2) + '\n')

const RUN = 'run-2026-11-01-a'
const MH = 'Mental Health, Substance Use Disorder, Addiction Services'

const Q = {
  q1: "The assessment identified behavioral health, including mental health and substance use, as the community's most significant health need.",
  q2: 'Housing instability and the cost of rent were raised in every focus group and ranked second among prioritized needs.',
  q3: 'Basic needs such as food, transportation and child care were grouped as a single priority area.',
  q4: 'Several residents said they no longer feel safe walking to the clinic after dark.',
  q5: 'Spanish-speaking families reported waiting weeks for an interpreter appointment.',
  q6: 'Transportation to specialty appointments in the city remains the biggest barrier for seniors.',
  q7: 'Priority 3: Healthy weight, nutrition and physical activity for children and adults.',
  q8: 'Priority 4: Tobacco and vaping prevention among youth.',
  q9: 'Access to prenatal and maternal care was listed under access to care.',
  q10: 'In partnership with the Valley Food Bank, the hospital hosted a monthly produce distribution in the clinic parking lot.',
  q11: "The hospital's community benefit fund awarded $25,000 to the Valley Food Bank to expand weekend meal programs for students.",
  q12: 'Hospital staff ran drive-through flu and COVID-19 vaccine clinics on six Saturdays, giving 1,840 doses.',
  q13: 'drive-through flu and COVID-19 vaccine clinics on six Saturdays, giving 1,840 doses.',
  q14: 'The hospital expanded its nurse residency program to twelve positions, added a paid medical assistant apprenticeship with the community college, and offered tuition reimbursement to forty employees pursuing clinical degrees, with the goal of filling vacancies that had remained open for more than a year.',
  q15: 'The hospital and Valley Behavioral Health co-located a crisis counselor in the emergency department, supported by a hospital grant.',
  q16: "Financial counselors screened every uninsured patient for charity care and enrolled 612 people in the hospital's financial assistance program.",
  q17: 'Enrollment specialists helped 388 patients complete Medicaid applications at the bedside.',
  q18: 'The mobile health unit visited the three outlying communities every other week.',
  q19: "People up the valley drive ninety minutes for a routine visit, and in winter they just don't go.",
  q20: 'We see patients discharged to a tent because there is nowhere else.',
  q21: 'Valley Food Bank - weekly pantry, Tuesdays and Thursdays, no ID required.',
  q22: 'Valley Dental Van - free cleanings for children under 12, call for schedule.',
  q23: 'Priority 1: Mental health and substance use. Priority 2: Basic needs and economic security. Priority 3: Access to care.',
  q24: 'Strategy 1.2: Partner with the county crisis line to add a warm handoff from the emergency department to outpatient counseling.',
  q25: 'Strategy 1.3: Train 200 community members in Mental Health First Aid through hospital-led classes each year.',
  q26: 'Strategy 2.1: Offer Medicaid and SNAP application help at every financial counseling visit.',
  q27: 'Strategy 2.2: Collaborate with community partners on housing, including the regional housing coalition.',
  q28: "Strategy 3.1: Expand the hospital's diabetes prevention and healthy weight classes to two evenings per week.",
}

// ---- document A: CHNA, 75 pages ----
const A = {}
A[1] = 'Mercy Valley Regional Hospital\nCommunity Health Needs Assessment 2023'
A[2] = 'Table of contents\nExecutive summary 4\nCommunity profile 7\nCommunity input 17\nEvaluation of the 2020 plan 23\nKey informant interviews 27\nCommunity resources 38\nSurvey report 45'
A[3] = 'Acknowledgements\nThe hospital thanks the residents, partners and staff who contributed to this assessment.'
A[5] = [
  'Executive summary',
  `${Q.q1} Residents, clinicians and community partners described long waits for counseling, a shortage of providers who accept Medicaid, and rising overdose deaths in the county.`,
  `${Q.q2} Focus group participants connected housing to nearly every other issue raised, from missed appointments to untreated chronic conditions.`,
  `${Q.q3} Residents asked that the hospital keep these issues together because the same families are affected by all of them.`,
].join('\n\n')
A[18] = [
  'Community input: focus groups and listening sessions',
  `Six focus groups were held between March and May 2023 with 54 participants. ${Q.q4} Others described a lack of lighting along the main road and asked for later bus service.`,
  'Families who speak Spanish described waits of several weeks for appointments with an interpreter, and some said they brought a child to translate instead.',
  `${Q.q6} Several participants said they had stopped seeing a specialist altogether because of the drive.`,
].join('\n\n')
A[21] = [
  'Prioritized community health needs',
  'The steering committee ranked needs using severity, the number of people affected, and the hospital’s ability to act. The five priorities are listed below.',
  'Priority 1: Behavioral health, including mental health and substance use.',
  'Priority 2: Housing and basic needs.',
  Q.q7,
  Q.q8,
  `Priority 5: Access to care, including primary care, dental care and transportation. ${Q.q9}`,
].join('\n\n')
A[24] = [
  'Evaluation of the 2020 implementation plan',
  `Food security. ${Q.q10} Over three years the distributions served about 400 households a month. ${Q.q11}`,
  `Immunization. ${Q.q12} Volunteers from the county health department staffed registration.`,
  `Workforce. ${Q.q14}`,
].join('\n\n')
A[25] = [
  'Evaluation of the 2020 implementation plan, continued',
  `Behavioral health. ${Q.q15} The counselor saw 1,120 patients in the first year.`,
  `Financial assistance. ${Q.q16} The hospital also simplified its application from six pages to two.`,
  `Coverage. ${Q.q17} Outreach to the outlying communities is described on the next page.`,
].join('\n\n')
A[26] = [
  'Evaluation of the 2020 implementation plan, continued',
  `Outreach. ${Q.q18} Visits included blood pressure checks, vaccinations and help with prescriptions.`,
  'The unit was taken out of service for four months in 2022 for repairs, and visits resumed in early 2023.',
].join('\n\n')
A[31] = [
  'Key informant interviews',
  'A school nurse: "Kids are coming to school hungry and anxious, and we have one counselor for 600 students."',
  `A clinic manager in the north end: "${Q.q19}"`,
  `An emergency department social worker: "${Q.q20}"`,
].join('\n\n')
A[40] = [
  'Community resources: food, housing and basic needs',
  'Valley Food Bank – weekly pantry, Tuesdays and Fridays, no ID required.',
  'Mercy Valley Shelter – 24 beds, intake from 5 pm, call ahead in winter.',
  'Valley Dental Van – free cleanings for children under 12, call for schedule.',
  'County Housing Authority – rental assistance applications, first Monday of each month.',
].join('\n\n')

const sectionOf = p => p <= 3 ? 'front matter' : p <= 6 ? 'executive summary' : p <= 16 ? 'community profile' : p <= 22 ? 'community input' : p <= 26 ? 'evaluation of the 2020 plan' : p <= 37 ? 'key informant interviews' : p <= 44 ? 'community resources' : 'survey report'
for (let p = 1; p <= 75; p++) {
  if (A[p]) continue
  A[p] = `${sectionOf(p)[0].toUpperCase() + sectionOf(p).slice(1)} (continued)\n\nThis is placeholder narrative for page ${p} of the mock assessment, part of the ${sectionOf(p)} section. It contains no findings that fit the label set.\n\nThe pipeline produced no rows for this page.`
}

// ---- document B: implementation strategy, 15 pages ----
const B = {}
B[1] = 'Mercy Valley Regional Hospital\nImplementation Strategy 2024–2026'
B[2] = 'Table of contents\nSummary 3\nHow priorities were chosen 5\nStrategies by priority 9'
B[4] = [
  'Summary of priorities',
  `${Q.q23} Needs the hospital will not address directly, such as transportation, are noted on page 8 with the organizations better placed to lead.`,
].join('\n\n')
B[10] = [
  'Priority 1: Mental health and substance use',
  'Strategy 1.1: Add two licensed counselors to the primary care clinic by 2025.',
  Q.q24,
  Q.q25,
  'Measures: counseling wait time under 14 days; number of warm handoffs; number trained.',
].join('\n\n')
B[11] = [
  'Priority 2: Basic needs and economic security',
  Q.q26,
  Q.q27,
  'Priority 3: Access to care',
  Q.q28,
  'Measures: applications completed; coalition meetings attended; class enrollment.',
].join('\n\n')
for (let p = 1; p <= 15; p++) {
  if (B[p]) continue
  B[p] = `Implementation strategy, page ${p}\n\nPlaceholder narrative with no findings that fit the label set.`
}

const toTexts = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [String(k), v]))

const documents = [
  { id: 'docA', sourceName: 'Mercy Valley Regional Hospital CHNA 2023', docType: 'CHNA', year: 2023, pageCount: 75, pageImage: { kind: 'placeholder' }, pageTexts: toTexts(A), skippedPages: [1, 2, 3, 75] },
  { id: 'docB', sourceName: 'Mercy Valley Regional Hospital Implementation Strategy 2024–2026', docType: 'implementation strategy', year: 2024, pageCount: 15, pageImage: { kind: 'placeholder' }, pageTexts: toTexts(B), skippedPages: [1, 2] },
]

let n = 0
const row = (docId, pdfPage, label, role, quote, extra = {}) => ({
  id: `r${String(++n).padStart(2, '0')}`, docId, pdfPage, label, role, quote,
  evidenceType: 'stated', flags: [], status: 'pending', labelSetVersion: labelSet.version, runId: RUN, ...extra,
})

const rows = [
  row('docA', 5, MH, 'names it a priority', Q.q1, { section: 'Executive summary' }),
  row('docA', 5, 'Housing assistance', 'names it a priority', Q.q2, { section: 'Executive summary' }),
  row('docA', 5, 'Food assistance', 'names it a priority', Q.q3, { section: 'Executive summary', flags: ['needs_look'], flagNotes: { needs_look: 'Food is mentioned only as part of a list of basic needs' } }),
  row('docA', 18, 'Crime/Violence', 'names it a priority', Q.q4, { section: 'Community input', evidenceType: 'inferred', inferredNote: 'Residents raised safety; the hospital does not state it as a priority on this page', population: 'Residents near the clinic', flags: ['inferred'] }),
  row('docA', 18, 'Immigrant Health Access', 'names it a priority', Q.q5, { section: 'Community input', population: 'Spanish-speaking families', flags: ['quote_not_on_page'] }),
  row('docA', 18, 'no fit', 'names it a priority', Q.q6, { section: 'Community input', population: 'Seniors', flags: ['no_fit'] }),
  row('docA', 21, 'Weight Management and Obesity', 'names it a priority', Q.q7, { section: 'Prioritized needs', population: 'Children and adults' }),
  row('docA', 21, 'Smoking/Vaping', 'names it a priority', Q.q8, { section: 'Prioritized needs', population: 'Youth' }),
  row('docA', 21, "Women's Health", 'names it a priority', Q.q9, { section: 'Prioritized needs', flags: ['needs_look'], flagNotes: { needs_look: 'Maternal care appears as a sub-item under access to care, not as a priority of its own' } }),
  row('docA', 24, 'Food assistance', 'partners', Q.q10, { section: 'Evaluation of the 2020 plan', entityNamed: 'Valley Food Bank' }),
  row('docA', 24, 'Food assistance', 'funds it', Q.q11, { section: 'Evaluation of the 2020 plan', entityNamed: 'Valley Food Bank', population: 'Students' }),
  row('docA', 24, 'Vaccine Access', 'runs it', Q.q12, { section: 'Evaluation of the 2020 plan' }),
  row('docA', 24, 'Vaccine Access', 'runs it', Q.q13, { section: 'Evaluation of the 2020 plan', flags: ['dup'], flagNotes: { dup: 'Overlaps with the drive-through vaccine clinic row on this page' } }),
  row('docA', 24, 'Education and Workforce', 'runs it', Q.q14, { section: 'Evaluation of the 2020 plan', entityNamed: 'community college', flags: ['over_limit'] }),
  row('docA', 25, MH, 'partners', Q.q15, { section: 'Evaluation of the 2020 plan', entityNamed: 'Valley Behavioral Health', flags: ['runs_disagree'], flagNotes: { runs_disagree: 'Two runs disagreed: partners vs funds it' } }),
  row('docA', 25, 'Financial/Insurance Assistance', 'runs it', Q.q16, { section: 'Evaluation of the 2020 plan', population: 'Uninsured patients' }),
  row('docA', 25, 'Safety Net Assistance', 'runs it', Q.q17, { section: 'Evaluation of the 2020 plan' }),
  row('docA', 25, 'Mobile/Remote Clinics', 'runs it', Q.q18, { section: 'Evaluation of the 2020 plan', flags: ['quote_not_on_page'], flagNotes: { quote_not_on_page: 'Not on page 25; the same sentence is on page 26' } }),
  row('docA', 31, 'Rural Health/Rural Clinics', 'names it a priority', Q.q19, { section: 'Key informant interviews', evidenceType: 'inferred', inferredNote: 'An interviewee describes the need; the hospital has not adopted it as a priority on this page', population: 'Residents up the valley', flags: ['inferred'] }),
  row('docA', 31, 'Housing assistance', 'names it a priority', Q.q20, { section: 'Key informant interviews', evidenceType: 'inferred', inferredNote: 'Interviewee statement, not a hospital priority statement', flags: ['inferred'] }),
  row('docA', 40, 'Food assistance', 'partners', Q.q21, { section: 'Community resources', entityNamed: 'Valley Food Bank', flags: ['quote_not_on_page'] }),
  row('docA', 40, 'no fit', 'runs it', Q.q22, { section: 'Community resources', entityNamed: 'Valley Dental Van', population: 'Children under 12', flags: ['no_fit'] }),
  row('docB', 4, MH, 'names it a priority', Q.q23, { section: 'Summary' }),
  row('docB', 10, MH, 'partners', Q.q24, { section: 'Strategies, priority 1', entityNamed: 'county crisis line' }),
  row('docB', 10, 'Education and Workforce', 'runs it', Q.q25, { section: 'Strategies, priority 1', population: 'Community members' }),
  row('docB', 11, 'Safety Net Assistance', 'runs it', Q.q26, { section: 'Strategies, priority 2' }),
  row('docB', 11, 'Housing assistance', 'partners', Q.q27, { section: 'Strategies, priority 2', evidenceType: 'inferred', inferredNote: 'Collaboration described; no formal agreement named', entityNamed: 'regional housing coalition', flags: ['inferred'] }),
  row('docB', 11, 'Weight Management and Obesity', 'runs it', Q.q28, { section: 'Strategies, priority 3' }),
]

writeFileSync(join(out, 'batch.json'), JSON.stringify({ runId: RUN, documents, rows }, null, 2) + '\n')
const pages = new Set(rows.map(r => `${r.docId}:${r.pdfPage}`))
console.log(`wrote ${documents.length} documents, ${rows.length} rows across ${pages.size} pages -> ${out}`)
