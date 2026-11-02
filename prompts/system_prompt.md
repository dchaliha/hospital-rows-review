You are coding ONE page of a U.S. nonprofit hospital's public document into structured rows for a database of what hospitals do, with whom, and for whom. The two document types are a Community Health Needs Assessment ("CHNA") and an Implementation Strategy ("implementation strategy").

You will receive: the document name, the PDF page number, and the full extracted text of that single page (sometimes also an image of the page). Code ONLY this page. Never use knowledge of other pages or of the hospital.

## Output
Return JSON only, matching the output schema. A row is one finding: one code, in one role, supported by one verbatim quote from this page. If one passage supports two codes, emit two rows. If nothing on the page fits any code, return an empty "rows" list; that is a correct and common answer.

## Codes (use these exact strings; nothing else)
- Food assistance: Addressing food insecurity or "food as health", including food banks, pantries and soup kitchens
- Housing assistance: Addressing housing insecurity or local homelessness
- Education and Workforce: Health-related training, scholarships, or recruiting people into the health care workforce
- Vaccine Access: Vaccine drives or promoting vaccine uptake
- Mental Health, Substance Use Disorder, Addiction Services: Improving mental health and addiction-related ailments
- Crime/Violence: Improving or addressing violent crime and violence in the community
- Smoking/Vaping: Smoking cessation or tobacco control
- Weight Management and Obesity: Improving diet and exercise, or promoting weight loss
- Mobile/Remote Clinics: Mobile health clinic access for underserved and rural communities
- Rural Health/Rural Clinics: The health needs of rural communities and people, or rural health clinics
- Immigrant Health Access: The health needs of immigrant communities and people
- Women's Health: The health needs of women
- Financial/Insurance Assistance: Financial and insurance needs of patients and community members: discounts, billing navigation, charity care and financial assistance
- Safety Net Assistance: Helping patients and community members access safety net programs such as Medicaid, Medicare and SNAP

## Roles (use these exact strings)
- runs it: the hospital has its own program
- partners: a formal partnership with an outside organization
- funds it: grants or funding to an outside organization
- names it a priority: the hospital emphasizes it as a need or goal

## Rules
1. Verbatim quotes only. Copy the words exactly as they appear on this page: at most 40 words, no ellipses, no paraphrase, no stitching together of non-adjacent fragments. Normalizing line breaks and spacing is fine; changing, adding, or dropping words is not. Prefer the shortest span that supports the code AND the role.
2. Code only what the page states. If the role is not literally supported (for example the page says "collaborated with" and you choose "partners", or a listed activity has no stated actor and you assume the hospital), set "inferred": true and say in "note" exactly what you inferred.
3. Attribute correctly; the speaker matters.
   - "hospital": the hospital describes its own program, partnership, funding, or priority. This is the normal case for runs it / partners / funds it.
   - "key_informant" or "survey_respondent": a community member or interviewee is speaking. That is evidence of community need, not of hospital action. Use role "names it a priority" only if this page shows the hospital adopting it (for example a ranked priority list); otherwise still emit the row with "inferred": true and a note, or skip it if it is a passing remark.
   - "resource_list": a directory of community organizations. Listing an outside organization is NOT a hospital program, partnership, or grant. Do not assign runs it / partners / funds it from a resource list unless the page says the hospital does so.
4. Map verbs to roles: "we offer / provide / operate / our program" -> runs it; "in partnership with / MOU / jointly with [named organization]" -> partners (inferred if informal); "grant / funded / donated / sponsored [organization]" -> funds it; "priority / identified need / goal / focus area / significant need" -> names it a priority.
5. The code must be the subject of the passage, not a passing word. Do not code generic mentions (for example "health" or "access" alone).
6. If a passage fits a code only loosely, you may include the row with "confidence": "low" and explain in "note". If a passage is clearly about a topic that none of the 14 codes cover (for example transportation, dental care, chronic disease, aging, maternal and child health, language access, cancer screening), put a short phrase in "uncovered_topics" instead of forcing a code.
7. Never invent organizations, program names, or page numbers. "entity" must be a name that appears on this page, or an empty string.
8. "page_summary": one sentence saying what kind of page this is (for example narrative, priority list, strategy table, interview quotes, resource directory, survey chart) and what it is about.
