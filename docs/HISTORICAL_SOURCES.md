# Historical Sources

## Purpose

This file is the source ledger for every important historical claim, evidence item, reconstruction, character boundary, and interpretation used in the game.

No important historical claim should ship without a source ID.

## Provenance Categories

- `PRIMARY`: contemporary or participant primary source
- `SECONDARY`: reliable historical scholarship
- `RECONSTRUCTION`: authored game artifact assembled from reviewed sources
- `FICTION`: invented gameplay corruption
- `DRAMATIZATION`: AI or authored dialogue constrained by sources
- `CLASS_PACKET`: teacher-provided material used for alignment only

## Verification Status

- `VERIFIED`: reviewed and ready for implementation
- `PARTIAL`: a source and limited claim are verified, but independent corroboration, translation, or another requirement still blocks canonical use
- `REQUIRES VERIFICATION`: plausible but must be checked before implementation
- `REJECTED`: not suitable for use

## Source Lineage And Reuse Policy

- `L1-LOUIS-DECLARATION`: autograph/official reading/1791 pamphlet/later translation of the same declaration
- `L2-DROUET-ASSEMBLY-REPORT`: Drouet's 24 June report and reproductions derived from it
- `L3-VARENNES-MUNICIPAL-RECORD`: the 27 June municipal record; only partly independent of Drouet because he was a signatory, so the production case conservatively excludes it from independent-lineage scoring
- `L4-VALORY-JUDICIAL-TESTIMONY`: Valory's royal-party testimony in the judicial dossier
- `L5-ASSEMBLY-INSTITUTIONAL`: Assembly proclamations, constitutional acts, and institutional continuations
- `L6-SHORT-DIPLOMATIC`: William Short's diplomatic observation
- `L7-CORDELIERS-PETITION`: Cordeliers petitions and reproductions of the same petition
- `L8-BODYGUARD-JUDICIAL-DOSSIER`: Moustier and Maldent testimony; independent observations within one dossier, not two preparation lineages
- `L9-FERSEN-PAPERS`: Fersen journal and planning correspondence
- `L10-KORFF-PASSPORT`: passport, register, and official reports about the same administrative artifact
- `L11-ROUTE-SCHOLARSHIP`: reviewed scholarship used to bound the route reconstruction; not a new eyewitness line
- `L12-CONTEXT-SYNTHESIS`: official chronology and scholarship used for novice context; not scored as eyewitness corroboration

Three cards derived from one lineage count as one evidentiary line. Reputable scholarship may validate an interpretation without becoming a new independent eyewitness line when it synthesizes the same primary records.

The production case package records this distinction explicitly:

- `dependencyLineageIds` lists every lineage that informed an evidence item.
- `sourceLineageIds` lists only the independently eligible historical lineages that can count toward corroboration requirements.
- Each structured source record declares `historicalLineageEligible` and links back to this ledger with a citation, stable URL, and limitation note.

For example, E4 and E5 list `L11-ROUTE-SCHOLARSHIP` as a dependency but do not count it as another eyewitness line. E5 also records `L3-VARENNES-MUNICIPAL-RECORD` as an informing dependency while counting only `L2-DROUET-ASSEMBLY-REPORT` in `sourceLineageIds`; this avoids treating Drouet's report and a municipal record he signed as fully independent corroboration. The package validator requires both lists to close exactly over their referenced sources.

For the MVP, student evidence uses project-authored text excerpts, close translations, or clearly labeled paraphrases. Do not embed scan images unless an item-level license permits that use. Public-domain underlying text does not automatically grant unrestricted reuse of a host's scan, transcription, annotations, or layout.

## Visual Reconstruction Boundary

The playable district is a low-confidence schematic teaching environment, not a surveyed reconstruction of Varennes in June 1791. Building facades, paving, furniture, barrels, lanterns, water, lighting, clothing colors, figure appearance, and object placement make no scored historical claim. They cannot corroborate testimony, open evidence by their appearance alone, or satisfy a hypothesis gate.

The versioned asset ledger at `data/cases/varennes/world/asset-ledger.json` records every shipped world file and every repository-authored procedural presentation system. It distinguishes creator and rights provenance from historical provenance, pins exact runtime-file hashes, and repeats location, ownership, scale, and appearance limitations for each use. Downloaded assets point to source and license URLs plus a project-authored local verification record; copied website pages are not redistributed as license proof. Imported CC0 assets remain `RECONSTRUCTION`; a permissive copyright license does not make an asset historically authentic.

The bridge approach remains especially constrained: the visual path may show a chokepoint and authored obstruction interface, but it must not depict the bridge itself or one prop as independently arresting the carriage. Exact actor attribution remains contested as documented under S2 and S3.

## Source Ledger

### S1: Louis XVI Declaration Before Flight

Status: `VERIFIED`

Type: `PRIMARY`

Core records:

- Archives nationales, *Declaration de Louis XVI adressee aux Francais a sa sortie de Paris*, 20 June 1791, `AE/II/1218`, former cote `C/187/1135/1`: https://francearchives.gouv.fr/facomponent/f787964b4d8aeca7470238897afd315946a5ea77
- *Declaration du Roi adressee a tous les Francois, a sa sortie de Paris* (Paris: Baudouin, 1791), 27 pp., BnF/Gallica `ark:/12148/bpt6k97515443`: https://gallica.bnf.fr/ark:/12148/bpt6k97515443
- Reading before the Assembly, *Archives parlementaires*, first series, vol. 27, pp. 378-383: https://www.persee.fr/doc/arcpa_0000-0000_1887_num_27_1_11375_t1_0378_0000_2
- Open English pathway: Frank Maloy Anderson, ed., *The Constitutions and Other Select Documents Illustrative of the History of France, 1789-1907*, 2nd ed. (1908), doc. 12A, pp. 45-50.

Needed for:

- E1
- Louis character dossier
- intentional-participation gate
- distinction between stated rationale and inferred motive

Approved atomic claims:

| Fact ID | Claim | Locator | Authorized use and limit |
|---|---|---|---|
| F-S1-001 | The declaration is dated and signed 20 June 1791 and presents itself as addressed to the French upon Louis's departure from Paris. | Baudouin pp. 1, 26-27; AP p. 378 | Document identity and date; do not claim the surviving autograph is certainly the exact copy left at the Tuileries |
| F-S1-002 | Louis represented the departure as a purposeful attempt to recover liberty and secure himself and his family. | Baudouin p. 26; AP p. 383; Anderson p. 49 | Source claim supporting intentional participation; not complete proof of private motive |
| F-S1-003 | Louis stated that his inability to do good and prevent what he considered wrongdoing motivated his search for liberty and safety. | Baudouin p. 26; AP p. 383 | Louis character and source analysis only as stated rationale |
| F-S1-004 | Louis argued that the emerging settlement denied him effective freedom and sufficient authority. | Baudouin pp. 1-2; AP pp. 378-379 | Louis's political position; not proof of a foreign or military plan |

Integrity boundary:

- S1 establishes what Louis publicly stated, not every private motive.
- S1 alone cannot prove the objective hard-gate wording "Louis intentionally participated." Pair it with independently verified travel-preparation evidence.

The production artifact uses the printed 1791 edition and does not claim that the surviving autograph is the exact Tuileries copy.

Approved student-facing close paraphrase:

> Louis wrote that, in his position, he could no longer do good or stop wrongdoing. He said he had left to regain his freedom and keep his family safe.

Translation note: project-authored close paraphrase of Baudouin p. 26 and Anderson p. 49. Label it `LOUIS'S STATED EXPLANATION`; it does not prove every private motive.

### S2: Jean-Baptiste Drouet Account To The National Assembly

Status: `VERIFIED`

Type: `PRIMARY` participant testimony in a later published parliamentary compilation

Bibliographic record:

- "Compte rendu par M. Drouet sur l'arrestation du roi, lors de la seance du 24 juin 1791."
- *Archives parlementaires de 1787 a 1860*, first series, vol. 27, pp. 508-509.
- Published in 1887; records a report delivered 24 June 1791.
- Stable record: https://www.persee.fr/doc/arcpa_0000-0000_1887_num_27_1_11428_t1_0508_0000_5

Needed for:

- E3
- Drouet character dossier
- route-information mechanism
- pursuit and warning chain

Claims verified as statements in Drouet's report:

| Fact ID | Claim | Source locator | Authorized use |
|---|---|---|---|
| F-S2-001 | Drouet reported suspecting the royal travelers partly from resemblance to the king's image on an assignat. | pp. 508-509; web lines 40-44 | Drouet testimony, not objective proof of recognition |
| F-S2-002 | Drouet reported first taking the announced road toward Verdun, then learning near Clermont that the carriage had taken the road toward Varennes. | p. 509; web lines 45-46 | Route-information mechanism; informant remains unspecified |
| F-S2-003 | Drouet reported traveling with Guillaume by side roads and reaching Varennes while the carriage was still there. | p. 509; web lines 45-47 | Pursuit claim in testimony |
| F-S2-004 | Drouet reported warning an innkeeper, who then alerted others. | p. 509; web lines 48-50 | Warning and collective-response claim in testimony |
| F-S2-005 | Drouet reported that he and Guillaume obstructed the bridge with a furniture vehicle and other vehicles. | p. 509; web lines 51-52 | Bridge-action claim in testimony; actor attribution requires corroboration |
| F-S2-006 | Drouet reported involvement by the municipal prosecutor, National Guard commander, residents, and passport inspection before detention. | p. 509; web lines 53-58 | Collective civic action in testimony |

Editorial limitations:

- This is Drouet's public account and may emphasize his own role.
- The Persée text is a later printed parliamentary compilation with OCR artifacts.
- The account does not identify who supplied the route correction near Clermont.
- The popular English derivative at `revolution.chnm.org/d/313/` names returning postilions and Metz; those details must not be treated as independent corroboration or silently substituted for the French parliamentary text.

Resolved boundaries:

- the municipal record supplies an additional institutional account but is only partly independent because Drouet signed it
- exact bridge-actor attribution remains contested and is not a scoring requirement
- S4 scholarship supports the broad route reconstruction without creating another eyewitness lineage

Approved student-facing close translation:

> Drouet reported that he thought he recognized the queen and that the man with her resembled the king's portrait on a fifty-livre assignat. He said he learned near Clermont that the travelers had turned toward Varennes, so he and Guillaume used side roads to get there.

Translation note: preserve `reported`, `thought`, and `learned`. The account does not identify who supplied the route information. This excerpt remains participant testimony in `L2`, not objective corroboration.

### S3: Varennes Local Civic Response

Status: `VERIFIED`

Type: `PRIMARY`, `SECONDARY`, and `RECONSTRUCTION`

Core records:

- *Proces-verbal de ce qui s'est passe a Varennes*, municipal record dated 27 June 1791: https://archive.org/details/procsverbaldeceq00vare
- Drouet's 24 June Assembly report, S2.
- Valory's 8 July judicial deposition, preserved in Eugene Bimbenet's documentary edition of the Haute Cour records: https://archive.org/details/ADB21178
- Municipal office definition and powers, law of 14 December 1789, arts. 26 and 49-52: https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006070180/1789-12-14

Needed for:

- Sauce character or station
- E5
- local action hard gate

Approved atomic claims:

| Fact ID | Claim | Authorized use and limit |
|---|---|---|
| F-S3-001 | Sauce held the office `procureur de la commune de Varennes`. | Use the student gloss "municipal officer charged with protecting and conducting the commune's affairs"; do not call him mayor or `procureur-syndic` |
| F-S3-002 | The municipal record describes officials, residents, National Guardsmen, judicial officers, alarms, posts, barricades, and reinforcements. | Establishes collective response, not unanimous motive or a single hero |
| F-S3-003 | Drouet and the municipal record both describe vehicle obstruction at the bridge passage but disagree about the actors. | The occurrence is supportable; exact actor attribution is contested |
| F-S3-004 | Valory independently described an armed collective stop, passport examination, security, and sentinels. | Independent royal-party testimony; original archival folio remains to be located |
| F-S3-005 | The municipal record attributes Sauce observable roles in alerting colleagues, requesting the passport, lodging the travelers, summoning Judge Destez, and arranging security. | Static evidence only; do not invent Sauce's interior reasoning |

Integrity boundary:

- Sauce did not personally or solely recognize, arrest, or detain Louis.
- Destez supplied the decisive personal recognition in the municipal narrative.
- The bridge constrained onward passage; the carriage appears to have been halted and checked in the arch or main-street zone before reaching it.
- Actor disagreement is an educational source-comparison opportunity, not a defect to smooth away.
- E5 should be a static reconstructed civic-response station. Open Sauce roleplay is deferred.
- S2 and S3 are separate documentary lineages but not fully independent corroboration: Drouet authored S2 and also signed S3's municipal record. Their overlap supports the occurrence of obstruction and collective response, not independent proof of actor attribution or of a necessary obstruction-to-detention link. The production case therefore sets S3 `historicalLineageEligible` to `false` and excludes L3 from E5 `sourceLineageIds` while retaining it in `dependencyLineageIds`.
- The records document blocked onward passage, passport inspection, and guarded lodging within the collective response. Requiring both local repair actions is an authored reconstruction, not a historical finding that either action alone or the pair was necessary or sufficient.

Deferred non-gating tasks:

- locate the original archival folio for Valory's deposition
- secure an approved period plan or scholarly map before fixing exact coordinates

Approved student-facing municipal paraphrase:

> The municipal record says an innkeeper warned Sauce, who alerted other officials. As the alarm sounded, residents gathered, the National Guard took positions, and armed people blocked further passage. Sauce asked to see the passport and brought the travelers to his guarded house.

Provisional Valory paraphrase, not yet authorized for a hard gate:

> Valory, who traveled with the royal party, testified that armed men stopped them. He said the alarm sounded, people called for the bridge to be blocked, the passport was examined, and guards were posted.

The Valory line remains `PARTIAL` until the original folio or a modern critical edition is verified.

### S4: Route, Timing, And Travel Plan

Status: `VERIFIED`

Type: `SECONDARY` and `RECONSTRUCTION`

Needed for:

- E2
- E4
- repair sequence
- route map

Core scholarship and records:

- Timothy Tackett, *When the King Took Flight*, especially pp. 3-8 and 50-67: https://books.google.com/books?id=fPPbvPHHL4UC&pg=PA50
- Drouet's Assembly report, S2.
- Varennes municipal record, S3.
- Claude-Antoine-Gabriel de Choiseul's escort-planning account: https://books.google.com/books?id=9R3mI-tMamMC&pg=PA58
- Marcel Bouloiseau, source comparison of officer accounts (1972): https://doi.org/10.3406/ahrf.1972.4657

Approved atomic claims and reconstruction rules:

| Fact ID | Claim | Authorized use and limit |
|---|---|---|
| F-S4-001 | The broad route ran east from Paris through Champagne to Sainte-Menehould and Clermont, then turned north toward Varennes. | Route overview; minor relay details require separate validation |
| F-S4-002 | Montmedy, a French fortress under Bouille's command, was the operational destination. | Do not present Austria or a border crossing as a settled destination |
| F-S4-003 | Delays accumulated and planned escort rendezvous failed or became ineffective. | Relative `on plan`, `behind`, and `missed` bands only; no sole culprit |
| F-S4-004 | Drouet reported initially following the announced Verdun road, then redirecting by cross-roads after learning near Clermont that the carriage had turned toward Varennes. | Testimony-backed route mechanism; informant unspecified |
| F-S4-005 | Varennes included an approach and halt zone, an onward bridge passage, and a planned relay beyond the bridge. | Schematic, not-to-scale geography only |

Safe visual and mechanical boundaries:

- Show key route nodes, the Clermont fork, Montmedy, a large conspicuous carriage, repeated horse changes, accumulated delay, and distributed escort nodes.
- Keep warning, civic mobilization, blocked onward passage, passport inspection, and guarded detention as separate deterministic nodes. Valory's armed-stop account remains contextual until its original archival folio is independently verified, so it does not create a scored armed-halt node.
- Label the Varennes diagram `SCHEMATIC RECONSTRUCTION - NOT TO SCALE`.
- Omit minute-by-minute scoring, fixed travel speeds, exact troop counts, exact vehicle placement, and a carriage physically stopped by the bridge barricade.
- Exact arrival claims vary across participant accounts; broad phases are `RECONSTRUCTION_ONLY`.

Deferred non-gating tasks:

- review the remaining municipal record only for optional layout, troop-position, and quantitative details; the core passages supporting F-S3-003 and F-S3-005 are reviewed at printed pp. 3-6
- secure a period plan or critically edited map before fixing layout coordinates
- compare the full officer accounts before assigning responsibility or precise troop positions
- validate historical road distances only if distance becomes a scored mechanic

### S5: Press And Political Reaction

Status: `VERIFIED`

Type: `PRIMARY` and `SECONDARY`

Needed for:

- E7
- political-meaning track
- Barnave/Assembly or press dossier

Approved source set and bounded claims:

| Fact ID | Claim | Source | Authorized use and limit |
|---|---|---|---|
| F-S5-001 | The Assembly's 22 June proclamation described the royal family as having been carried off. | Musee Carnavalet `AFF3437`: https://www.parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/l-assemblee-nationale-aux-francois-sic-proclamation-decretee-dans-la-seance | Official framing only, not proof of abduction or coordinated deception |
| F-S5-002 | Louis's declaration had been read to the Assembly on 21 June. | AP vol. 27, pp. 378-383 | Establishes chronology when compared with F-S5-001 |
| F-S5-003 | On 26 June William Short reported that public terminology had shifted from abduction to evasion. | Founders Online: https://founders.archives.gov/documents/Jefferson/01-20-02-0225 | One contemporary diplomatic observation, not a national opinion survey |
| F-S5-004 | The Cordeliers' 21 June petition treated the king's departure as an abdication and argued for deciding France's political form without simply restoring Louis. | Albert Mathiez, *Le Club des Cordeliers pendant la crise de Varennes*, pp. 45-47: https://archive.org/details/clubdescordeliers00math/page/n69/mode/2up | Radical club position, not universal public opinion |
| F-S5-004A | A separate 14 July Cordeliers petition argued that confidence in an official called king was impossible and requested a republic or consultation of the departments and primary assemblies. | Mathiez, pp. 112-115; World History Commons reproduces this petition beneath an ambiguous 21 June heading: https://worldhistorycommons.org/champ-de-mars-petitions-cordelier-and-jacobin-clubs | Keep separate from the 21 June petition; radical advocacy, not universal opinion |
| F-S5-005 | The Constitution of 3 September 1791 declared the government monarchical and delegated executive power to the king. | Elysee constitutional text: https://www.elysee.fr/la-presidence/la-constitution-du-3-septembre-1791 | Institutional continuity, not restored trust |
| F-S5-006 | Louis formally accepted the Constitution on 14 September 1791. | AP vol. 30, pp. 635-636: https://www.persee.fr/doc/arcpa_0000-0000_1888_num_30_1_12515_t1_0635_0000_6 | Institutional continuity, not public reconciliation |

Contested interpretations:

- `I-S5-001`: royal credibility collapsed immediately and universally. Present only as a debated interpretation; reactions varied by place, timing, and political group.
- `I-S5-002`: the Assembly knowingly invented a kidnapping lie. The sequence supports strategic-framing analysis but does not by itself prove coordinated intent.

Implementation boundary:

- F-S5-001, F-S5-003, F-S5-004A, and F-S5-005 form the E7 student packet
- F-S5-002, F-S5-004, and F-S5-006 remain contextual
- S11 records the competing rapid-rupture and prior-confidence interpretations; neither is a deterministic consequence gate

Approved E7 student packet:

- **Assembly framing, 22 June:** "The Assembly announced that the king and royal family had been carried off during the night." Close paraphrase of AFF3437; official framing, not proof of abduction.
- **William Short, 26 June:** "Short wrote that people now called the event an escape after first calling it an abduction." Close paraphrase of the paragraph beginning `The assembly dispatched three`; one diplomatic observer, not a survey.
- **Cordeliers, 14 July:** "The Cordeliers argued that confidence in an official called king was impossible and called for a republic or wider consultation." Close paraphrase of Mathiez pp. 112-115; radical advocacy, not public consensus.
- **Institutional boundary, 3 September:** "The Constitution still declared France a monarchy and gave executive power to the king." Close paraphrase of Title III, article 4; institutional continuity, not restored trust.

The 21 June and 14 July petitions must remain separate records. The World History Commons page places both date labels together before the 14 July text and is not sufficient on its own to identify the excerpt's date.

### S6: Barnave And Constitutional Stability

Status: `PARTIAL`

Type: `PRIMARY` or `SECONDARY`

Needed for:

- Barnave character or Assembly dossier

Approved atomic claims:

| Fact ID | Claim | Source | Authorized use and limit |
|---|---|---|---|
| F-S6-001 | Barnave served as a commissioner for the royal return and reported to the Assembly on 25 June. | AP vol. 27, pp. 529-531: https://archives-parlementaires.persee.fr/prt/d6091acc-43b9-4cd5-ac5e-9d814e6a34ef | Bounded knowledge of the return journey, not the earlier roadside sequence |
| F-S6-002 | On 15 July Barnave publicly defended monarchical government, royal inviolability, and constitutional stability. | AP vol. 28, pp. 316-331: https://www.persee.fr/doc/arcpa_0000-0000_1887_num_28_1_11677_t1_0316_0000_6 | Public constitutional reasoning only |
| F-S6-003 | The Assembly ordered Barnave's speech printed and distributed to every department. | AP vol. 28, p. 331 | Institutional reception and circulation, not nationwide agreement |

Character boundary:

- A source-bounded Barnave dated 15 July 1791 is supportable.
- He may discuss F-S6-001 through F-S6-003 and his public constitutional argument.
- He may not claim national opinion, Louis's private motives, unwitnessed roadside facts, or a romantic conversion by Marie Antoinette.
- Barnave dialogue may aid interpretation but cannot be assessed evidence.

Deferred optional-character tasks:

- approve a short student-facing translation of the 15 July speech
- decide whether Barnave dialogue adds more value than a fixed Assembly dossier in the 10-15 minute runtime

### S8: Bodyguard Judicial Testimony

Status: `VERIFIED`

Type: `PRIMARY` participant testimony in a later documentary edition

Core record:

- Eugene Bimbenet, *Fuite de Louis XVI a Varennes*, 2nd ed. (1868), judicial testimony of Moustier and Maldent: https://archive.org/details/ADB21178

Approved atomic claims:

| Fact ID | Claim | Locator | Authorized use and limit |
|---|---|---|---|
| F-S8-001 | Moustier testified on 7 July that Louis had personally ordered him on 17 June to obtain courier clothing and pass the same instruction to Valory and Maldent. | Bimbenet pp. 105, 107 | Participant testimony supporting planned, intentional participation; not complete motive or proof of unconstrained choice |
| F-S8-002 | Maldent testified that Louis opened the concealed room, led him out, and assigned him behind the departing carriage. | Bimbenet pp. 95-97 | Eyewitness support for intentional execution; Maldent's clothing instruction is not independent of Moustier |

Lineage: `L8-BODYGUARD-JUDICIAL-DOSSIER`.

Approved student-facing paraphrase:

> Moustier testified that Louis personally told him before the departure to obtain courier clothing and pass the same instruction to two other bodyguards. Maldent testified that Louis later led him from a concealed room and assigned him behind the departing carriage.

Label every sentence as judicial testimony. The two witnesses share `L8` for advance-preparation counting.

### S9: Fersen Papers

Status: `VERIFIED`

Type: `PRIMARY` participant papers in a family-edited nineteenth-century edition

Core record:

- R. M. de Klinckowstrom, ed., *Le comte de Fersen et la cour de France*, vol. 1 (1877): https://archive.org/details/lecomtedefersene01fersuoft

Approved atomic claims:

| Fact ID | Claim | Locator | Authorized use and limit |
|---|---|---|---|
| F-S9-001 | Fersen's 20 June journal reports that Louis and Marie Antoinette agreed there was no reason to hesitate and discussed timing and an arrest contingency. | vol. 1, pp. 1-2 | Independent participant line supporting intentional planning; family-edited extract and damaged leaf require disclosure |
| F-S9-002 | Fersen's 13-14 June planning minutes fixed a departure time and specified clothing, recognition, escort, and arrest-contingency arrangements involving the king. | vol. 1, pp. 137-138 | Advance planning; same lineage as F-S9-001, not separate corroboration |

Lineage: `L9-FERSEN-PAPERS`.

Approved student-facing paraphrase:

> Fersen's papers record advance timing, clothing, escort, and arrest-contingency arrangements involving Louis. His 20 June journal reports that Louis and Marie Antoinette agreed there was no reason to delay.

Editorial note: identify this as Fersen's participant record in a later family-edited collection. The damaged journal leaf and editorial identification of `he` as Louis remain visible limitations.

### S10: Korff Passport And Administrative Record

Status: `PARTIAL`

Type: `PRIMARY` administrative artifact and official report

Core records:

- Passport presented to the Assembly, *Archives parlementaires*, vol. 27, p. 481: https://www.persee.fr/doc/arcpa_0000-0000_1887_num_27_1_11418_t1_0481_0000_4
- Roederer's report on the foreign-ministry register and correspondence, vol. 27, p. 488: https://www.persee.fr/doc/arcpa_0000-0000_1887_num_27_1_11423_t1_0488_0000_7

Approved atomic claims:

| Fact ID | Claim | Authorized use and limit |
|---|---|---|
| F-S10-001 | A passport dated 5 June and found with the royal party supplied Korff cover identities and a Frankfurt cover destination. | Prepared travel documentation; it does not by itself prove who procured it, Louis's full knowledge, or the operational destination |
| F-S10-002 | Roederer reported that commissioners inspected the register and correspondence for a duplicate Korff passport. | Administrative corroboration; Roederer's claim that the duplicate went to the king or queen is an inference |

Lineage: `L10-KORFF-PASSPORT`.

### S11: Novice Context And Constitutional Setting

Status: `VERIFIED`

Type: `PRIMARY`, official chronology, and `SECONDARY`

Core records:

- National Assembly chronology, June 1789-September 1791: https://www2.assemblee-nationale.fr/15/evenements/2019/la-revolution-s-affiche/des-etats-generaux-a-l-assemblee-nationale-juin-1789-octobre-1791
- Declaration of the Rights of Man and of the Citizen, articles 3 and 6: https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000697056
- Constitution of 3 September 1791: https://www.elysee.fr/la-presidence/la-constitution-du-3-septembre-1791
- Saint-Cloud departure scene, Musee Carnavalet G.28356: https://www.parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/depart-du-roi-pour-st-cloud-revol-de-paris-ndeg93-pag62
- National Assembly chronology of the end of monarchy, September 1792: https://www.assemblee-nationale.fr/dyn/histoire-et-patrimoine/revolution-francaise/la-convention-nationale-et-la-fin-de-la-royaute
- Ambrogio A. Caiani, *Louis XVI and the French Revolution, 1789-1792*, introduction excerpt: https://assets.cambridge.org/97811070/26339/excerpt/9781107026339_excerpt.pdf
- Hugh Gough, review of Timothy Tackett's *When the King Took Flight*: https://www.h-france.net/vol4reviews/vol4no3Gough.pdf

Approved atomic claims:

| Fact ID | Claim | Authorized use and limit |
|---|---|---|
| F-S11-001 | France had been undergoing revolutionary political change since 1789. | Orientation only; do not imply one unified revolutionary position |
| F-S11-002 | Political authority was being reallocated and contested among national institutions and the king. | Background condition without inevitability |
| F-S11-003 | Louis XVI remained king in June 1791; France did not become a republic until September 1792. | Prevents republic anachronism |
| F-S11-004 | The written constitution was unfinished in June 1791 and would define and limit royal power. | Do not present final September wording as the exact June draft |
| F-S11-005 | The royal family resided at the Tuileries in Paris. | Orientation only |
| F-S11-006 | A crowd and National Guard prevented Louis's attempted departure for Saint-Cloud on 18 April 1791. | Observable movement constraint; do not claim permanent house arrest |
| F-S11-007 | The royal family secretly left the Tuileries during the night of 20-21 June 1791. | Secret plan and departure, not invisibility along the route |

`F-S11-006` is machine-linked to `S11-SAINT-CLOUD`: the anonymous 1791 print and caption in *Revolutions de Paris*, no. 93, p. 62, Musee Carnavalet G.28356. The museum record identifies the royal carriage as stopped by the National Guard on 18 April 1791 and transcribes the contemporary caption stating that the people opposed the departure. It supports the observable prevented departure, not permanent imprisonment or a nationwide interpretation.

Contested context:

- `I-S11-001`: mutual mistrust and suspicion existed before the flight.
- `I-S11-002`: substantial confidence in Louis also remained before the flight.

Both interpretation IDs have `orientation_only` authority and are ineligible for deterministic conditions, assessment gates, or repair eligibility.

Primer wording must preserve both: `Many people still supported monarchy, but trust between the crown and revolutionary politics was fragile.` This paired interpretation does not count as a deterministic condition.

### S12: Teacher Packet

Status: variable

Type: `CLASS_PACKET`

Allowed uses:

- vocabulary
- reading level
- relevant passage references
- teacher objective alignment
- report emphasis

Forbidden uses:

- adding canonical facts
- modifying evidence
- changing solution
- changing character knowledge
- creating new hard gates

## Evidence Source Mapping

| Evidence ID | Source IDs | Status |
|---|---|---|
| E1 Louis declaration | S1 | Verified as Louis's stated explanation; E1 cannot independently corroborate E2 |
| E2 travel dossier | S8, S9, S10, with route context from S4 | Verified for the narrow intentional-participation gate using L8 and L9; S10 is optional corroboration. E2 remains deterministic archive evidence and is not available to Louis's generated station. |
| E3 Drouet account | S2 | Verified as attributed participant testimony; it does not independently prove every event it describes. The E3 Drouet reaction is limited to F-S2-002/S2. |
| E4 route/timing board | S2, S4 | Verified for broad sequence and schematic geography; it cannot corroborate S2 where derived from it. The E4 reaction requires E4 to be presented and stays inside E4's fact/source closure. |
| E5 Varennes civic response | S2, S3, S4 | Verified for the municipal core used by the gate; Valory and exact layout are optional and excluded from scoring. The E5 reaction requires E5 to be presented and stays inside E5's fact/source closure. |
| E6A-E6C temporal-anomaly set | FICTION | Authored; no historical source; all candidates receive equal labeling and visual weight |
| FO1-FO3 branch observations | FICTION | Authored fixed branch state; may identify the fictional mechanism but never count as historical evidence |
| E7 political reaction | S5 proclamation, Short observation, Cordeliers petition, and September Constitution records | Verified for bounded multi-voice reaction and institutional-continuity claims; S6 and S11 remain context only, and no item represents universal opinion |

## Character Source Mapping

| Character | Source IDs | Implementation status |
|---|---|---|
| Drouet | FO1 for fictional branch memory; S2, S3, and S4 only through presented E3/E4/E5 records | Generated source-bounded station. Historical reactions are authored dramatization, require the matching evidence, and never count as evidence. |
| Sauce / Varennes civic response | S2, S3 through E5 | Static reconstruction dossier; open Sauce roleplay is deferred. |
| Louis XVI | S1 through E1 only | Generated source-bounded station for Louis's declared position. E2, S8, and S9 are deliberately excluded, and complete private motive remains unresolved. |
| Assembly reaction | S5 records through E7 | Static multi-voice political dossier; each statement remains situated rather than national consensus. |
| Barnave | S5, S6 | Excluded from the current model policy. Existing source work does not by itself approve a generated role. |

Generated station policy is not a new historical source. GPT-5.6 selects authored unit IDs; the server renders the visible response. Every generated station has an empty recordable-claim allowlist, and historical facts in an evidence reaction must be contained within the fact/source closure of the evidence the student presented.

## Historical Integrity Rules

- Do not implement a character claim until its fact ID has source support.
- Do not use exact times unless verified.
- Do not label a reconstruction as a primary source.
- Do not use teacher packet claims as historical ground truth.
- Do not represent any fictional temporal anomaly as a lost authentic document or visually reveal which candidate is active.
- Do not imply the Flight to Varennes alone caused later revolutionary outcomes.
