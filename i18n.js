/* Language switcher — reveals all text with GSAP ScrambleText on change.
   Brand names, product codes (CR-067…), and contact details stay as-is.
   Medical copy translations are machine-generated and should be reviewed. */
(function () {
  const I18N = {
    "skip": { fr: "Aller au contenu", de: "Zum Inhalt springen", ja: "コンテンツへスキップ", en: "Skip to content", zh: "跳至正文", es: "Saltar al contenido", ko: "본문으로 건너뛰기" },
    "nav.mission": { fr: "Mission", de: "Mission", ja: "ミッション", en: "Mission", zh: "使命", es: "Misión", ko: "미션" },
    "nav.pipeline": { fr: "Pipeline", de: "Pipeline", ja: "パイプライン", en: "Pipeline", zh: "产品管线", es: "Cartera", ko: "파이프라인" },
    "nav.contact": { fr: "Contact", de: "Kontakt", ja: "お問い合わせ", en: "Contact", zh: "联系我们", es: "Contacto", ko: "문의" },
    "hero.headline": { fr: "Innovation en médicaments endocriniens et oncologiques", de: "Innovation bei endokrinen und onkologischen Medikamenten", ja: "内分泌・腫瘍医薬品のイノベーション",
      en: "Endocrine & Oncology Drug Innovation",
      zh: "内分泌与肿瘤药物创新",
      es: "Innovación en fármacos endocrinos y oncológicos",
      ko: "내분비 및 종양학 신약 혁신",
    },
    "hero.mission": { fr: "Nous développons des médicaments à petites molécules de pointe pour favoriser le rétablissement des patients.", de: "Wir entwickeln hochmoderne niedermolekulare Arzneimittel, um die Genesung der Patienten zu unterstützen.", ja: "患者の回復を支える最先端の低分子医薬品を開発しています。",
      en: "Developing cutting-edge small-molecule medicines to aid patient recovery.",
      zh: "研发前沿小分子药物，助力患者康复。",
      es: "Desarrollamos medicamentos de moléculas pequeñas de vanguardia para ayudar a la recuperación de los pacientes.",
      ko: "환자 회복을 돕는 최첨단 소분자 의약품을 개발합니다.",
    },
    "hero.cta": { fr: "Contactez-nous", de: "Kontakt aufnehmen", ja: "お問い合わせ", en: "Get in touch", zh: "联系我们", es: "Contáctanos", ko: "문의하기" },
    "hero.scroll": { fr: "Défiler", de: "Scrollen", ja: "スクロール", en: "Scroll", zh: "向下滚动", es: "Desplázate", ko: "스크롤" },
    "mission.eyebrow": { fr: "Notre mission", de: "Unsere Mission", ja: "私たちの使命", en: "Our Mission", zh: "我们的使命", es: "Nuestra misión", ko: "우리의 사명" },
    "mission.statement": { fr: "Nous développons des thérapies endocriniennes et oncologiques à partir de composés à petites molécules, afin de transformer le cancer en une maladie chronique gérable grâce à des traitements efficaces, moins toxiques et accessibles.", de: "Wir entwickeln endokrine und onkologische Therapien aus niedermolekularen Verbindungen – mit dem Ziel, Krebs durch wirksame, weniger toxische und zugängliche Behandlungen in eine beherrschbare, chronische Erkrankung zu verwandeln.", ja: "私たちは低分子化合物から内分泌・腫瘍領域の治療法を開発し、効果的で毒性が低く利用しやすい治療を通じて、がんを管理可能な慢性疾患へと変えることを目指しています。",
      en: "We develop endocrine and oncology therapies from small-molecule compounds — working to transform cancer into a manageable, chronic condition through effective, less-toxic, and accessible treatments.",
      zh: "我们以小分子化合物研发内分泌与肿瘤疗法——致力于通过有效、低毒且可及的治疗，将癌症转变为可管理的慢性疾病。",
      es: "Desarrollamos terapias endocrinas y oncológicas a partir de compuestos de moléculas pequeñas, con el fin de convertir el cáncer en una enfermedad crónica manejable mediante tratamientos eficaces, menos tóxicos y accesibles.",
      ko: "우리는 소분자 화합물로 내분비 및 종양학 치료제를 개발하며, 효과적이고 독성이 낮으며 접근 가능한 치료를 통해 암을 관리 가능한 만성 질환으로 전환하고자 합니다.",
    },
    "pipeline.eyebrow": { fr: "Pipeline", de: "Pipeline", ja: "パイプライン", en: "Pipeline", zh: "产品管线", es: "Cartera de productos", ko: "파이프라인" },
    "grp.all": { en: "Endocrine & Oncology", zh: "内分泌与肿瘤学", es: "Endocrino y oncología", ko: "내분비 및 종양학", fr: "Endocrinien et oncologie", de: "Endokrin und Onkologie", ja: "内分泌・腫瘍学" },
    "grp.all.desc": { en: "Supporting an aging population — including sexual-health therapies for men and women — by optimizing the endocrine system, and developing therapies that suppress cancer-cell nutrient uptake: effective, less toxic, and accessible worldwide.", zh: "通过优化内分泌系统支持老龄化人群——包括为男性和女性提供性健康疗法——并研发抑制癌细胞营养摄取的疗法：高效、低毒，并可在全球普及。", es: "Apoyamos a una población que envejece —incluidas terapias de salud sexual para hombres y mujeres— optimizando el sistema endocrino, y desarrollamos terapias que inhiben la captación de nutrientes de las células cancerosas: eficaces, menos tóxicas y accesibles en todo el mundo.", ko: "내분비 시스템을 최적화하여 고령화 인구를 지원하고 — 남성과 여성을 위한 성 건강 치료 포함 — 암세포의 영양분 흡수를 억제하는 치료제를 개발합니다: 효과적이고 독성이 낮으며 전 세계적으로 접근 가능합니다.", fr: "Soutenir une population vieillissante — y compris par des thérapies de santé sexuelle pour les hommes et les femmes — en optimisant le système endocrinien, et développer des thérapies qui inhibent l'absorption des nutriments par les cellules cancéreuses : efficaces, moins toxiques et accessibles dans le monde entier.", de: "Unterstützung einer alternden Bevölkerung – einschließlich Therapien für die sexuelle Gesundheit von Männern und Frauen – durch Optimierung des endokrinen Systems sowie Entwicklung von Therapien, die die Nährstoffaufnahme von Krebszellen unterdrücken: wirksam, weniger toxisch und weltweit zugänglich.", ja: "内分泌系を最適化することで、男女の性の健康に関する治療を含め高齢化する人々を支援し、がん細胞の栄養取り込みを抑制する治療法を開発します。効果的で毒性が低く、世界中で利用可能です。" },
    "cr067.desc": { fr: "Traiter la dysfonction érectile par une approche combinée.", de: "Behandlung der erektilen Dysfunktion durch einen Kombinationsansatz.", ja: "併用アプローチによる ED の治療。",
      en: "Treating ED through a combination approach.",
      zh: "通过联合疗法治疗勃起功能障碍。",
      es: "Tratar la disfunción eréctil mediante un enfoque combinado.",
      ko: "복합 접근법으로 발기부전을 치료합니다.",
    },
    "k119.desc": { fr: "Thérapie orale à petites molécules contre le cancer de la vessie.", de: "Niedermolekulare orale Therapie gegen Blasenkrebs.", ja: "低分子経口膀胱がん治療薬。",
      en: "Small-molecule oral bladder-cancer therapy.",
      zh: "小分子口服膀胱癌疗法。",
      es: "Terapia oral de moléculas pequeñas para el cáncer de vejiga.",
      ko: "소분자 경구 방광암 치료제.",
    },
    "xtl.desc": { fr: "Agent thérapeutique assisté par IA ciblant les voies Rac1.", de: "KI-gestützter Wirkstoff, der auf Rac1-Signalwege abzielt.", ja: "Rac1 経路を標的とする AI 支援の治療薬。",
      en: "AI-supported therapeutic agent targeting Rac1 pathways.",
      zh: "靶向 Rac1 通路的 AI 辅助治疗药物。",
      es: "Agente terapéutico asistido por IA dirigido a las vías Rac1.",
      ko: "Rac1 경로를 표적으로 하는 AI 지원 치료제.",
    },
    "cr067.viz": { fr: "Thérapie combinée : deux agents, une dose plus faible.", de: "Kombinationstherapie: zwei Wirkstoffe, eine niedrigere Dosis.", ja: "併用療法：2 つの薬剤で、より低用量。",
      en: "Combination therapy: two agents, one lower dose.",
      zh: "联合疗法：两种药物，更低剂量。",
      es: "Terapia combinada: dos agentes, una dosis menor.",
      ko: "복합 요법: 두 약물, 더 낮은 용량.",
    },
    "k119.viz": { fr: "La libération prolongée inhibe la voie Rac1.", de: "Die verzögerte Freisetzung unterdrückt den Rac1-Signalweg.", ja: "徐放性製剤が Rac1 経路を抑制。",
      en: "Extended release suppresses the Rac1 pathway.",
      zh: "缓释制剂抑制 Rac1 通路。",
      es: "La liberación prolongada suprime la vía Rac1.",
      ko: "서방형 제제가 Rac1 경로를 억제합니다.",
    },
    "xtl.viz": { fr: "L'IA sélectionne des molécules candidates contre Rac1.", de: "KI screent Kandidatenmoleküle gegen Rac1.", ja: "AI が Rac1 に対する候補分子を選別。",
      en: "AI screens candidate molecules against Rac1.",
      zh: "AI 筛选靶向 Rac1 的候选分子。",
      es: "La IA analiza moléculas candidatas contra Rac1.",
      ko: "AI가 Rac1 표적 후보 분자를 선별합니다.",
    },
    "tag.phase1": { fr: "Phase 1 · 2025", de: "Phase 1 · 2025", ja: "第1相 · 2025", en: "Phase 1 · 2025", zh: "一期 · 2025", es: "Fase 1 · 2025", ko: "1상 · 2025" },
    "tag.ind": { fr: "IND · S2 2025", de: "IND · H2 2025", ja: "IND · 2025年下半期", en: "IND · H2 2025", zh: "IND · 2025下半年", es: "IND · S2 2025", ko: "IND · 2025 하반기" },
    "tag.dev": { fr: "En développement", de: "In Entwicklung", ja: "開発中", en: "In development", zh: "研发中", es: "En desarrollo", ko: "개발 중" },
    "prog.overview": { fr: "Aperçu du programme", de: "Programmübersicht", ja: "プログラム概要", en: "Program overview", zh: "项目概览", es: "Resumen del programa", ko: "프로그램 개요" },
    "contact.eyebrow": { fr: "Contact", de: "Kontakt", ja: "お問い合わせ", en: "Contact", zh: "联系我们", es: "Contacto", ko: "문의" },
    "contact.title": { fr: "Faire progresser le rétablissement des patients, ensemble.", de: "Gemeinsam die Genesung der Patienten voranbringen.", ja: "共に、患者の回復を前進させる。",
      en: "Advancing patient recovery, together.",
      zh: "携手推进患者康复。",
      es: "Impulsando juntos la recuperación de los pacientes.",
      ko: "함께 환자 회복을 앞당깁니다.",
    },
    "label.phone": { fr: "Téléphone", de: "Telefon", ja: "電話", en: "Phone", zh: "电话", es: "Teléfono", ko: "전화" },
    "label.email": { fr: "E-mail", de: "E-Mail", ja: "メール", en: "Email", zh: "邮箱", es: "Correo", ko: "이메일" },
    "label.address": { fr: "Adresse", de: "Adresse", ja: "住所", en: "Address", zh: "地址", es: "Dirección", ko: "주소" },
    "nav.team": { en: "Team", zh: "团队", es: "Equipo", ko: "팀", fr: "Équipe", de: "Team", ja: "チーム" },
    "team.eyebrow": { en: "Team", zh: "团队", es: "Equipo", ko: "팀", fr: "Équipe", de: "Team", ja: "チーム" },
    "team.title": { en: "The people behind the science.", zh: "科学背后的人。", es: "Las personas detrás de la ciencia.", ko: "과학을 이끄는 사람들.", fr: "Les personnes derrière la science.", de: "Die Menschen hinter der Wissenschaft.", ja: "科学を支える人々。" },
    "team.advisors": { en: "Advisors", zh: "顾问", es: "Asesores", ko: "자문위원", fr: "Conseillers", de: "Berater", ja: "アドバイザー" },
    "team.kong.role": { en: "Founder, President & CEO", zh: "创始人、总裁兼首席执行官", es: "Fundador, presidente y director ejecutivo", ko: "창립자, 사장 겸 CEO", fr: "Fondateur, président et PDG", de: "Gründer, Präsident und CEO", ja: "創業者・社長兼 CEO" },
    "team.kong.bio": { en: "A physician-scientist, endocrinologist, inventor, and biotechnology entrepreneur whose research and intellectual property focus on cancer-cell nutrient uptake and the development of novel anticancer therapeutics. He has held clinical and academic appointments associated with Dartmouth, SUNY Upstate, and Lahey Hospital & Medical Center, and trained as a researcher at Harvard Medical School. His experience spans drug development from API to clinical trial, including a successful liquid calcium product on the market.", zh: "医师科学家、内分泌学家、发明家及生物技术企业家，其研究与知识产权聚焦于癌细胞营养摄取及新型抗癌疗法的开发。他曾在达特茅斯、纽约州立大学上州医科大学以及莱希医院暨医疗中心担任临床与学术职务，并在哈佛医学院接受研究员训练。其经验涵盖从原料药到临床试验的药物开发全过程，包括一款成功上市的液体钙产品。", es: "Médico-científico, endocrinólogo, inventor y emprendedor biotecnológico cuya investigación y propiedad intelectual se centran en la captación de nutrientes por las células cancerosas y en el desarrollo de nuevos tratamientos anticancerígenos. Ha ocupado cargos clínicos y académicos vinculados a Dartmouth, SUNY Upstate y Lahey Hospital & Medical Center, y se formó como investigador en la Facultad de Medicina de Harvard. Su experiencia abarca el desarrollo de fármacos desde el principio activo hasta el ensayo clínico, incluido un exitoso producto de calcio líquido en el mercado.", ko: "의사이자 과학자, 내분비학자, 발명가, 바이오테크 기업가로서 암세포의 영양분 흡수와 새로운 항암 치료제 개발에 연구와 지식재산을 집중해 왔습니다. 다트머스, SUNY 업스테이트, 레이히 병원 및 의료센터와 연계된 임상·학술 직책을 역임했으며 하버드 의과대학에서 연구자로 훈련받았습니다. 원료의약품부터 임상시험까지 신약 개발 전 과정을 경험했으며, 시장에서 성공한 액상 칼슘 제품을 보유하고 있습니다.", fr: "Médecin-chercheur, endocrinologue, inventeur et entrepreneur en biotechnologie, dont la recherche et la propriété intellectuelle portent sur l'absorption des nutriments par les cellules cancéreuses et le développement de nouveaux traitements anticancéreux. Il a occupé des postes cliniques et universitaires liés à Dartmouth, SUNY Upstate et au Lahey Hospital & Medical Center, et s'est formé à la recherche à la Harvard Medical School. Son expérience couvre le développement de médicaments, du principe actif à l'essai clinique, avec notamment un produit de calcium liquide commercialisé avec succès.", de: "Arzt und Wissenschaftler, Endokrinologe, Erfinder und Biotechnologie-Unternehmer, dessen Forschung und geistiges Eigentum sich auf die Nährstoffaufnahme von Krebszellen und die Entwicklung neuartiger Krebstherapeutika konzentrieren. Er hatte klinische und akademische Positionen in Verbindung mit Dartmouth, SUNY Upstate und dem Lahey Hospital & Medical Center inne und wurde an der Harvard Medical School als Forscher ausgebildet. Seine Erfahrung reicht von der Wirkstoffentwicklung bis zur klinischen Studie, einschließlich eines erfolgreich vermarkteten flüssigen Calciumprodukts.", ja: "医師・科学者、内分泌専門医、発明家、バイオテクノロジー起業家であり、その研究と知的財産はがん細胞の栄養取り込みと新規抗がん治療薬の開発に焦点を当てています。ダートマス、SUNY アップステート、レイヒー病院・医療センターに関連する臨床・学術職を歴任し、ハーバード医科大学で研究者として研鑽を積みました。原薬から臨床試験に至る医薬品開発の経験を有し、市場で成功した液体カルシウム製品も手がけています。" },
    "team.liu.role": { en: "Vice President", zh: "副总裁", es: "Vicepresidenta", ko: "부사장", fr: "Vice-présidente", de: "Vizepräsidentin", ja: "副社長" },
    "team.liu.bio": { en: "Jinhong brings extensive pharmaceutical-industry experience, particularly in drug development. She received advanced research training as a fellow at Tufts University School of Medicine and the University of Michigan, where she made significant contributions to molecular research in oncology. Her career includes roles as a pharmaceutical representative at Servier and as Executive Vice President of Aunuo Pharmaceutical. She oversees the daily operations of Kong's Pharmaceutical, driving innovation and efficiency across the company's mission.", zh: "她拥有丰富的制药行业经验，尤其在药物开发领域。她曾在塔夫茨大学医学院和密歇根大学担任研究员并接受高级研究培训，在肿瘤分子研究方面做出了重要贡献。她的职业经历包括担任施维雅制药代表以及澳诺制药执行副总裁。她负责 Kong's Pharmaceutical 的日常运营，推动公司使命的创新与效率。", es: "Jinhong aporta una amplia experiencia en la industria farmacéutica, especialmente en el desarrollo de fármacos. Recibió formación avanzada en investigación como fellow en la Facultad de Medicina de la Universidad de Tufts y en la Universidad de Michigan, donde realizó contribuciones significativas a la investigación molecular en oncología. Su trayectoria incluye puestos como representante farmacéutica en Servier y como vicepresidenta ejecutiva de Aunuo Pharmaceutical. Supervisa las operaciones diarias de Kong's Pharmaceutical, impulsando la innovación y la eficiencia en la misión de la empresa.", ko: "그녀는 특히 신약 개발 분야에서 풍부한 제약 산업 경험을 갖추고 있습니다. 터프츠 대학교 의과대학과 미시간 대학교에서 펠로우로 고급 연구 훈련을 받았으며, 종양학 분자 연구에 중요한 기여를 했습니다. 세르비에에서 제약 영업 대표로, 아우누오 제약에서 수석 부사장으로 근무했습니다. Kong's Pharmaceutical의 일상 운영을 총괄하며 회사 사명 전반에 걸쳐 혁신과 효율성을 이끌고 있습니다.", fr: "Jinhong apporte une vaste expérience de l'industrie pharmaceutique, en particulier dans le développement de médicaments. Elle a suivi une formation avancée à la recherche en tant que fellow à la Tufts University School of Medicine et à l'Université du Michigan, où elle a apporté des contributions significatives à la recherche moléculaire en oncologie. Sa carrière comprend des fonctions de représentante pharmaceutique chez Servier et de vice-présidente exécutive d'Aunuo Pharmaceutical. Elle supervise les opérations quotidiennes de Kong's Pharmaceutical, favorisant l'innovation et l'efficacité au service de la mission de l'entreprise.", de: "Jinhong bringt umfangreiche Erfahrung aus der Pharmaindustrie mit, insbesondere in der Arzneimittelentwicklung. Sie absolvierte eine fortgeschrittene Forschungsausbildung als Fellow an der Tufts University School of Medicine und der University of Michigan, wo sie wesentliche Beiträge zur molekularen Onkologieforschung leistete. Ihre Laufbahn umfasst Positionen als Pharmareferentin bei Servier und als Executive Vice President von Aunuo Pharmaceutical. Sie leitet das Tagesgeschäft von Kong's Pharmaceutical und treibt Innovation und Effizienz im Sinne der Unternehmensmission voran.", ja: "彼女は、特に医薬品開発において製薬業界での豊富な経験を有しています。タフツ大学医学部およびミシガン大学でフェローとして高度な研究訓練を受け、腫瘍学の分子研究に大きく貢献しました。セルヴィエでの製薬営業担当、アウヌオ製薬の上級副社長などを歴任。Kong's Pharmaceutical の日常業務を統括し、企業の使命に向けた革新と効率化を推進しています。" },
    "team.chu.role": { en: "Biologist", zh: "生物学家", es: "Biólogo", ko: "생물학자", fr: "Biologiste", de: "Biologe", ja: "生物学者" },
    "team.chu.bio": { en: "Qiuming is a biologist with over 20 years of experience driving innovation in the biotechnology and pharmaceutical industries. Specializing in gene delivery and small-molecule therapies, he has helped spearhead groundbreaking treatments and is an expert in both in vitro and in vivo studies. His contributions include multiple patents and publications in gene therapy and drug development, with prior roles at Sanofi and Genzyme. He earned his Master's and Bachelor's degrees from Shanghai Medical College, Fudan University.", zh: "他是一位生物学家，拥有 20 余年推动生物技术与制药行业创新的经验。专注于基因递送和小分子疗法，他曾参与引领多项突破性治疗方案，并精通体外与体内研究。其贡献包括基因治疗和药物开发领域的多项专利与论文，此前曾任职于赛诺菲和健赞。他在复旦大学上海医学院获得硕士和学士学位。", es: "Qiuming es biólogo con más de 20 años de experiencia impulsando la innovación en las industrias biotecnológica y farmacéutica. Especializado en administración génica y terapias de moléculas pequeñas, ha contribuido a liderar tratamientos pioneros y es experto en estudios in vitro e in vivo. Sus aportaciones incluyen múltiples patentes y publicaciones en terapia génica y desarrollo de fármacos, con cargos previos en Sanofi y Genzyme. Obtuvo su máster y su grado en el Shanghai Medical College de la Universidad de Fudan.", ko: "그는 생명공학 및 제약 산업에서 20년 이상 혁신을 이끌어 온 생물학자입니다. 유전자 전달과 소분자 치료제를 전문으로 하며 획기적인 치료법 개발을 선도해 왔고, 시험관 내 및 생체 내 연구 모두에 정통합니다. 유전자 치료와 신약 개발 분야에서 다수의 특허와 논문을 보유하고 있으며, 이전에 사노피와 젠자임에서 근무했습니다. 푸단대학교 상하이 의과대학에서 석사 및 학사 학위를 취득했습니다.", fr: "Qiuming est biologiste et cumule plus de 20 ans d'expérience au service de l'innovation dans les industries biotechnologique et pharmaceutique. Spécialisé dans l'administration de gènes et les thérapies à petites molécules, il a contribué à lancer des traitements novateurs et maîtrise les études in vitro comme in vivo. Ses contributions comprennent de nombreux brevets et publications en thérapie génique et en développement de médicaments, après des postes chez Sanofi et Genzyme. Il est titulaire d'un master et d'une licence du Shanghai Medical College de l'Université Fudan.", de: "Qiuming ist Biologe mit über 20 Jahren Erfahrung als Innovationstreiber in der Biotechnologie- und Pharmaindustrie. Spezialisiert auf Gentransfer und niedermolekulare Therapien, hat er wegweisende Behandlungen mit vorangebracht und ist Experte für In-vitro- wie In-vivo-Studien. Zu seinen Beiträgen zählen zahlreiche Patente und Publikationen in Gentherapie und Arzneimittelentwicklung, zuvor war er bei Sanofi und Genzyme tätig. Seinen Master- und Bachelorabschluss erwarb er am Shanghai Medical College der Fudan-Universität.", ja: "彼はバイオテクノロジーおよび製薬業界で 20 年以上にわたり革新を推進してきた生物学者です。遺伝子送達と低分子治療を専門とし、画期的な治療法の開発を主導してきたほか、in vitro・in vivo 研究の双方に精通しています。遺伝子治療と医薬品開発における複数の特許・論文を有し、以前はサノフィおよびジェンザイムに在籍していました。復旦大学上海医学院で修士号および学士号を取得しています。" },
    "team.bonanno.role": { en: "Research Lab Management", zh: "研究实验室管理", es: "Gestión del laboratorio de investigación", ko: "연구실 관리", fr: "Gestion du laboratoire de recherche", de: "Leitung des Forschungslabors", ja: "研究ラボ管理" },
    "team.bonanno.bio": { en: "Antonio is a biomedical engineer with a Bachelor of Science in Biomedical Engineering from the University of Massachusetts Lowell, bringing a background in drug delivery, tissue engineering, and biomedical research. He manages and executes laboratory research supporting the company's pharmaceutical development programs — including cell culture, drug screening, molecular and biochemical assays, fluorescence imaging, and quantitative image analysis — with a focus on oncology and innovative drug-delivery approaches.", zh: "他是一名生物医学工程师，拥有马萨诸塞大学洛厄尔分校生物医学工程理学学士学位，具备药物递送、组织工程和生物医学研究背景。他负责管理并执行支持公司药物开发项目的实验室研究，涵盖细胞培养、药物筛选、分子与生化检测、荧光成像及定量图像分析，重点关注肿瘤学与创新药物递送方法。", es: "Antonio es ingeniero biomédico, graduado en Ingeniería Biomédica por la Universidad de Massachusetts Lowell, con formación en administración de fármacos, ingeniería de tejidos e investigación biomédica. Gestiona y ejecuta la investigación de laboratorio que respalda los programas de desarrollo farmacéutico de la empresa —incluidos cultivo celular, cribado de fármacos, ensayos moleculares y bioquímicos, imagen por fluorescencia y análisis cuantitativo de imágenes—, con especial atención a la oncología y a enfoques innovadores de administración de fármacos.", ko: "그는 매사추세츠 대학교 로웰 캠퍼스에서 생체의공학 이학사 학위를 취득한 생체의공학자로, 약물 전달, 조직 공학, 생의학 연구 배경을 갖추고 있습니다. 세포 배양, 약물 스크리닝, 분자·생화학 분석, 형광 이미징, 정량적 이미지 분석 등 회사의 제약 개발 프로그램을 뒷받침하는 실험실 연구를 관리하고 수행하며, 종양학과 혁신적인 약물 전달 접근법에 중점을 두고 있습니다.", fr: "Antonio est ingénieur biomédical, titulaire d'un Bachelor of Science en génie biomédical de l'Université du Massachusetts à Lowell, avec une expérience en administration de médicaments, en ingénierie tissulaire et en recherche biomédicale. Il gère et réalise les recherches de laboratoire qui soutiennent les programmes de développement pharmaceutique de l'entreprise — culture cellulaire, criblage de médicaments, dosages moléculaires et biochimiques, imagerie par fluorescence et analyse d'images quantitative — avec un accent sur l'oncologie et les approches innovantes d'administration de médicaments.", de: "Antonio ist Biomedizintechniker mit einem Bachelor of Science in Biomedical Engineering der University of Massachusetts Lowell und bringt Erfahrung in Wirkstofftransport, Tissue Engineering und biomedizinischer Forschung mit. Er leitet und führt die Laborforschung durch, die die Arzneimittelentwicklungsprogramme des Unternehmens unterstützt – darunter Zellkultur, Wirkstoff-Screening, molekulare und biochemische Assays, Fluoreszenzbildgebung und quantitative Bildanalyse – mit Schwerpunkt auf Onkologie und innovativen Ansätzen des Wirkstofftransports.", ja: "彼はマサチューセッツ大学ローウェル校で生体医工学の理学士号を取得した生体医工学者で、薬物送達、組織工学、生物医学研究のバックグラウンドを持っています。細胞培養、薬物スクリーニング、分子・生化学アッセイ、蛍光イメージング、定量的画像解析など、当社の医薬品開発プログラムを支える研究室での研究を管理・実施し、腫瘍学と革新的な薬物送達アプローチに重点を置いています。" },
    "team.adv.jiang": { en: "20+ years of experience in strategic planning and fundraising.", zh: "拥有 20 余年战略规划与融资经验。", es: "Más de 20 años de experiencia en planificación estratégica y captación de fondos.", ko: "전략 기획 및 자금 조달 분야에서 20년 이상의 경험.", fr: "Plus de 20 ans d'expérience en planification stratégique et en levée de fonds.", de: "Über 20 Jahre Erfahrung in strategischer Planung und Kapitalbeschaffung.", ja: "戦略立案と資金調達において 20 年以上の経験。" },
    "team.adv.feng": { en: "Extensive experience in business development and fundraising.", zh: "拥有丰富的业务拓展与融资经验。", es: "Amplia experiencia en desarrollo de negocio y captación de fondos.", ko: "사업 개발 및 자금 조달 분야의 풍부한 경험.", fr: "Vaste expérience en développement commercial et en levée de fonds.", de: "Umfangreiche Erfahrung in Geschäftsentwicklung und Kapitalbeschaffung.", ja: "事業開発と資金調達における豊富な経験。" },
    "footer.copy": { fr: "© 2026 Kong's Pharmaceutical Co. Tous droits réservés.", de: "© 2026 Kong's Pharmaceutical Co. Alle Rechte vorbehalten.", ja: "© 2026 Kong's Pharmaceutical Co. 無断複製・転載を禁じます。",
      en: "© 2026 Kong's Pharmaceutical Co. All rights reserved.",
      zh: "© 2026 Kong's Pharmaceutical Co. 版权所有。",
      es: "© 2026 Kong's Pharmaceutical Co. Todos los derechos reservados.",
      ko: "© 2026 Kong's Pharmaceutical Co. 모든 권리 보유.",
    },
    "cr067.p1": { fr: "À mesure que la population mondiale vieillit, la demande de soutien endocrinien pour améliorer la qualité de vie, en particulier en matière de santé sexuelle, augmente. La dysfonction érectile (DE) est une affection courante qui touche un pourcentage important d'hommes vieillissants, caractérisée par l'incapacité d'obtenir ou de maintenir une érection suffisante pour une activité sexuelle satisfaisante. Si des difficultés érectiles occasionnelles sont normales, une DE persistante peut révéler des problèmes de santé sous-jacents nécessitant une prise en charge médicale.", de: "Mit der Alterung der Weltbevölkerung steigt die Nachfrage nach endokriner Unterstützung zur Verbesserung der Lebensqualität, insbesondere im Bereich der sexuellen Gesundheit. Die erektile Dysfunktion (ED) ist eine häufige Erkrankung, die einen erheblichen Anteil älterer Männer betrifft und durch die Unfähigkeit gekennzeichnet ist, eine für eine zufriedenstellende sexuelle Aktivität ausreichende Erektion zu erreichen oder aufrechtzuerhalten. Während gelegentliche Erektionsprobleme normal sind, kann eine anhaltende ED auf zugrunde liegende gesundheitliche Probleme hinweisen, die ärztliche Behandlung erfordern.", ja: "世界的な高齢化に伴い、生活の質、とりわけ性の健康を改善するための内分泌サポートへの需要が高まっています。勃起不全（ED）は多くの高齢男性に影響を及ぼす一般的な症状で、満足のいく性行為に十分な勃起を得る、または維持できないことを特徴とします。時折の勃起の困難は正常ですが、持続的な ED は医療を要する潜在的な健康問題を示す場合があります。",
      en: "As the global population ages, the demand for endocrine support to improve quality of life, especially in sexual health, is growing. Erectile dysfunction (ED) is a common condition that affects a significant percentage of aging men, characterized by the inability to achieve or maintain an erection sufficient for satisfactory sexual performance. While occasional difficulty with erections is normal, persistent ED can indicate underlying health concerns that require medical attention.",
      zh: "随着全球人口老龄化，对内分泌支持以改善生活质量（尤其是性健康）的需求日益增长。勃起功能障碍（ED）是一种常见疾病，影响相当比例的老龄男性，表现为无法获得或维持足以完成满意性行为的勃起。偶尔出现勃起困难属于正常现象，但持续性 ED 可能提示需要就医的潜在健康问题。",
      es: "A medida que la población mundial envejece, crece la demanda de apoyo endocrino para mejorar la calidad de vida, especialmente en la salud sexual. La disfunción eréctil (DE) es una afección común que afecta a un porcentaje significativo de hombres mayores y se caracteriza por la incapacidad de lograr o mantener una erección suficiente para un desempeño sexual satisfactorio. Aunque la dificultad ocasional es normal, la DE persistente puede indicar problemas de salud subyacentes que requieren atención médica.",
      ko: "전 세계 인구가 고령화되면서 삶의 질, 특히 성 건강을 개선하기 위한 내분비 지원에 대한 수요가 증가하고 있습니다. 발기부전(ED)은 상당수의 고령 남성에게 영향을 미치는 흔한 질환으로, 만족스러운 성생활에 충분한 발기를 이루거나 유지하지 못하는 것이 특징입니다. 간헐적인 발기 어려움은 정상이지만, 지속적인 ED는 의학적 주의가 필요한 기저 건강 문제를 나타낼 수 있습니다.",
    },
    "cr067.p2": { fr: "Des traitements populaires comme le Viagra et le Cialis se sont révélés efficaces chez les patients atteints de dysfonction érectile. Cependant, lors d'une prise prolongée, les patients ont signalé des maux de tête et des rougeurs cutanées. De plus, des doses plus élevées étaient nécessaires pour obtenir un effet notable avec l'usage prolongé de ces médicaments. Nous développons une thérapie combinée qui associe les bénéfices du Viagra à un modulateur du désir sexuel afin de restaurer la fonction sexuelle des hommes avec l'âge.", de: "Beliebte Behandlungen wie Viagra und Cialis haben sich bei Patienten mit erektiler Dysfunktion als wirksam erwiesen. Bei längerer Einnahme berichteten Patienten jedoch über Kopfschmerzen und Hautrötungen. Zudem waren bei längerem Gebrauch dieser Medikamente höhere Dosen erforderlich, um eine deutliche Wirkung zu erzielen. Wir entwickeln eine Kombinationstherapie, die die Vorteile von Viagra mit einem Modulator des sexuellen Verlangens verbindet, um die sexuelle Funktion von Männern im Alter wiederherzustellen.", ja: "バイアグラやシアリスなどの一般的な治療薬は、勃起不全患者の治療に有効であることが示されています。しかし、長期の投与により、患者は頭痛や皮膚の紅潮を報告しました。さらに、これらの薬の長期使用では、十分な効果を得るためにより高い用量が必要でした。私たちは、バイアグラの利点と性欲調整剤を組み合わせた併用療法を開発し、加齢に伴う男性の性機能の回復を目指しています。",
      en: "Popular treatments, like Viagra and Cialis, have proven to be effective in the treatment of erectile dysfunction patients. However, through prolonged dosing, patients reported both headaches and flushing of the skin. Additionally, higher dosing was required to achieve a substantial effect in performance through extended use of these drugs. We are developing a combination therapy that merges the benefits of Viagra with a sexual desire modulator to restore men's sexual function as they age.",
      zh: "Viagra 和 Cialis 等常见治疗药物已被证明对勃起功能障碍患者有效。然而，长期用药后，患者报告出现头痛和皮肤潮红。此外，长期使用这些药物需要更高剂量才能显著改善表现。我们正在研发一种联合疗法，将 Viagra 的益处与性欲调节剂相结合，以恢复男性随年龄增长而下降的性功能。",
      es: "Tratamientos populares como Viagra y Cialis han demostrado ser eficaces en pacientes con disfunción eréctil. Sin embargo, con dosis prolongadas, los pacientes reportaron dolores de cabeza y enrojecimiento de la piel. Además, se requerían dosis más altas para lograr un efecto sustancial con el uso prolongado. Estamos desarrollando una terapia combinada que une los beneficios de Viagra con un modulador del deseo sexual para restaurar la función sexual masculina con la edad.",
      ko: "Viagra와 Cialis 같은 대중적인 치료제는 발기부전 환자에게 효과적임이 입증되었습니다. 그러나 장기 복용 시 환자들은 두통과 피부 홍조를 보고했습니다. 또한 장기간 사용으로 뚜렷한 효과를 얻으려면 더 높은 용량이 필요했습니다. 우리는 Viagra의 이점과 성욕 조절제를 결합한 복합 요법을 개발하여 나이가 들면서 남성의 성기능을 회복시키고자 합니다.",
    },
    "cr067.p3": { fr: "L'utilisation des comprimés CR-067 vise à réduire la dose efficace pour le traitement de la dysfonction érectile tout en minimisant les effets secondaires potentiels des médicaments actuellement commercialisés contre la DE.", de: "Der Einsatz von CR-067-Tabletten zielt darauf ab, die wirksame Dosis zur Behandlung der erektilen Dysfunktion zu verringern und zugleich die möglichen Nebenwirkungen der derzeit auf dem Markt befindlichen ED-Medikamente zu minimieren.", ja: "CR-067 錠の使用は、勃起不全の治療に必要な有効用量を減らすとともに、現在市販されている ED 治療薬による潜在的な副作用を最小限に抑えることを目指しています。",
      en: "The use of CR-067 tablets aims to decrease the effective dosage for the treatment of erectile dysfunction while also minimizing the potential side effects caused by current drugs on the market that treat ED.",
      zh: "CR-067 片剂旨在降低治疗勃起功能障碍所需的有效剂量，同时最大限度地减少目前市场上治疗 ED 药物可能引起的副作用。",
      es: "El uso de las tabletas CR-067 busca reducir la dosis eficaz para el tratamiento de la disfunción eréctil, minimizando a la vez los posibles efectos secundarios de los fármacos actuales que tratan la DE.",
      ko: "CR-067 정제는 발기부전 치료에 필요한 유효 용량을 낮추는 동시에, 현재 시판 중인 ED 치료제가 유발하는 잠재적 부작용을 최소화하는 것을 목표로 합니다.",
    },
    "k119.p1": { fr: "Les traitements anticancéreux actuellement commercialisés sont connus pour leur forte toxicité et leurs effets secondaires, notamment la chute des cheveux et la fatigue. Grâce à des recherches approfondies, nous avons mis au point un composé à petites molécules à haute biodisponibilité, ce qui lui permet de pénétrer efficacement les cellules et de cibler les cellules tumorales. Le criblage sur différentes lignées cellulaires a mis en évidence une réponse dose-dépendante, entraînant une suppression accrue des cellules cancéreuses par l'inhibition ciblée de la voie Rac1.", de: "Die derzeit auf dem Markt erhältlichen Krebsbehandlungen sind für ihre hohe Toxizität und Nebenwirkungen wie Haarausfall und Müdigkeit bekannt. Durch umfangreiche Forschung haben wir eine niedermolekulare Verbindung mit hoher Bioverfügbarkeit entwickelt, die effizient in Zellen eindringen und Tumorzellen gezielt angreifen kann. Das Screening verschiedener Zelllinien zeigte eine dosisabhängige Reaktion, die durch die gezielte Unterdrückung des Rac1-Signalwegs zu einer verstärkten Hemmung von Krebszellen führt.", ja: "現在市販されているがん治療薬は、脱毛や倦怠感などの高い毒性と副作用で知られています。広範な研究を通じて、私たちは高い生体利用率を持つ低分子化合物を開発し、細胞に効率的に浸透して腫瘍細胞を標的とできるようにしました。さまざまな細胞株でのスクリーニングにより用量依存的な反応が示され、Rac1 経路の標的抑制を通じてがん細胞の抑制が高まりました。",
      en: "Cancer treatments currently on the market are known for their high toxicity and side effects, including hair loss and fatigue. Through extensive research, we have developed a small-molecule compound with high bioavailability, allowing it to efficiently penetrate cells and target tumor cells. Screening across various cell lines has demonstrated a dose-dependent response, leading to increased cancer cell suppression through targeted suppression of the Rac1 pathway.",
      zh: "目前市场上的癌症治疗以高毒性和副作用（包括脱发和疲劳）而著称。通过大量研究，我们开发出一种具有高生物利用度的小分子化合物，使其能够高效穿透细胞并靶向肿瘤细胞。在多种细胞系中的筛选显示出剂量依赖性反应，通过靶向抑制 Rac1 通路，实现对癌细胞更强的抑制。",
      es: "Los tratamientos oncológicos actuales son conocidos por su alta toxicidad y efectos secundarios, como la caída del cabello y la fatiga. Mediante una investigación exhaustiva, hemos desarrollado un compuesto de molécula pequeña con alta biodisponibilidad, que le permite penetrar las células y dirigirse eficazmente a las células tumorales. El cribado en diversas líneas celulares ha mostrado una respuesta dependiente de la dosis, aumentando la supresión de las células cancerosas mediante la inhibición dirigida de la vía Rac1.",
      ko: "현재 시판 중인 암 치료제는 탈모와 피로를 포함한 높은 독성과 부작용으로 알려져 있습니다. 광범위한 연구를 통해 우리는 생체이용률이 높은 소분자 화합물을 개발하여 세포에 효율적으로 침투하고 종양 세포를 표적으로 삼을 수 있게 했습니다. 다양한 세포주에 대한 스크리닝에서 용량 의존적 반응이 나타났으며, Rac1 경로의 표적 억제를 통해 암세포 억제가 증가했습니다.",
    },
    "k119.p2": { fr: "Notre formulation enrobée à libération prolongée réduit au minimum les effets toxiques du médicament tout en renforçant notre stratégie visant à ralentir la progression tumorale. Grâce à de nombreuses études in vitro et in vivo, nous pouvons concentrer l'indication sur le cancer de la vessie. Cette approche vise à transformer le cancer, d'une maladie potentiellement mortelle en une affection chronique gérable.", de: "Unsere beschichtete Formulierung mit verzögerter Freisetzung minimiert die toxischen Wirkungen des Medikaments und stärkt zugleich unsere Strategie, das Fortschreiten des Tumors zu verlangsamen. Aus umfangreichen In-vitro- und In-vivo-Studien können wir die Indikation auf Blasenkrebs fokussieren. Dieser Ansatz zielt darauf ab, Krebs von einer lebensbedrohlichen Krankheit in eine beherrschbare chronische Erkrankung zu verwandeln.", ja: "当社のコーティング徐放性製剤は、腫瘍の進行を遅らせる戦略を強化しながら、薬剤の毒性作用を最小限に抑えます。広範な in vitro および in vivo 研究から、適応を膀胱がんに絞り込むことができます。このアプローチは、がんを生命を脅かす疾患から管理可能な慢性疾患へと変えることを目指しています。",
      en: "Our coated, extended-release formulation minimizes the drug's toxic effects while reinforcing our strategy to slow tumor progression. From extensive in vitro and in vivo studies, we are able to focus the indication on bladder cancer. This approach aims to transform cancer from a life-threatening disease into a manageable chronic condition.",
      zh: "我们的包衣缓释制剂在最大限度降低药物毒性作用的同时，强化了我们延缓肿瘤进展的策略。通过大量体外和体内研究，我们能够将适应症聚焦于膀胱癌。该方法旨在将癌症从危及生命的疾病转变为可管理的慢性疾病。",
      es: "Nuestra formulación recubierta de liberación prolongada minimiza los efectos tóxicos del fármaco a la vez que refuerza nuestra estrategia para frenar la progresión tumoral. A partir de amplios estudios in vitro e in vivo, podemos centrar la indicación en el cáncer de vejiga. Este enfoque busca convertir el cáncer de una enfermedad mortal en una afección crónica manejable.",
      ko: "코팅된 서방형 제제는 약물의 독성 효과를 최소화하는 동시에 종양 진행을 늦추는 전략을 강화합니다. 광범위한 시험관 내 및 생체 내 연구를 통해 우리는 적응증을 방광암에 집중할 수 있습니다. 이 접근법은 암을 생명을 위협하는 질병에서 관리 가능한 만성 질환으로 전환하는 것을 목표로 합니다.",
    },
    "xtl.p1": { fr: "La voie Rac1 joue un rôle clé dans la croissance, la mobilité et la survie des cellules cancéreuses. En tant que petite GTPase de la famille Rho, Rac1 agit comme un interrupteur qui contrôle la façon dont les cellules cancéreuses se propagent et résistent au traitement. En raison de son impact sur la progression tumorale, Rac1 est étudiée comme une cible prometteuse pour de nouvelles thérapies anticancéreuses.", de: "Der Rac1-Signalweg spielt eine zentrale Rolle bei Wachstum, Beweglichkeit und Überleben von Krebszellen. Als kleine GTPase der Rho-Familie wirkt Rac1 wie ein Schalter, der steuert, wie sich Krebszellen ausbreiten und der Behandlung widerstehen. Aufgrund seines Einflusses auf das Tumorwachstum wird Rac1 als vielversprechendes Ziel für neue Krebstherapien untersucht.", ja: "Rac1 経路は、がん細胞の増殖、運動、生存において中心的な役割を果たします。Rho ファミリーの小型 GTPase である Rac1 はスイッチのように働き、がん細胞がどのように広がり治療に抵抗するかを制御します。腫瘍進行への影響から、Rac1 は新たながん治療の有望な標的として研究されています。",
      en: "The Rac1 pathway is a key player in cancer cell growth, movement, and survival. As a small GTPase in the Rho family, Rac1 acts like a switch, controlling how cancer cells spread and resist treatment. Due to its impact on tumor progression, Rac1 is being explored as a promising target for new cancer therapies.",
      zh: "Rac1 通路在癌细胞的生长、迁移和存活中起关键作用。作为 Rho 家族的一种小 GTP 酶，Rac1 如同一个开关，控制癌细胞的扩散和对治疗的抵抗。由于其对肿瘤进展的影响，Rac1 正被作为新型癌症疗法的一个有前景的靶点加以探索。",
      es: "La vía Rac1 es clave en el crecimiento, el movimiento y la supervivencia de las células cancerosas. Como pequeña GTPasa de la familia Rho, Rac1 actúa como un interruptor que controla cómo las células cancerosas se propagan y resisten al tratamiento. Por su impacto en la progresión tumoral, Rac1 se está estudiando como una diana prometedora para nuevas terapias oncológicas.",
      ko: "Rac1 경로는 암세포의 성장, 이동, 생존에 핵심적인 역할을 합니다. Rho 계열의 소형 GTPase인 Rac1은 스위치처럼 작용하여 암세포가 어떻게 퍼지고 치료에 저항하는지를 조절합니다. 종양 진행에 미치는 영향으로 인해 Rac1은 새로운 암 치료제의 유망한 표적으로 연구되고 있습니다.",
    },
    "xtl.p2": { fr: "Grâce au phénotypage et au criblage de médicaments pilotés par l'IA, nous avons identifié et breveté avec succès 30 médicaments à petites molécules distincts en vue d'une évaluation plus poussée sur diverses lignées de cellules cancéreuses. La série XTL-152 fait actuellement l'objet d'études pour son potentiel à traiter les tumeurs malignes au niveau du domaine de liaison au GTP. Plus précisément, le composé XTL-152 se concentre sur l'inhibition de la voie Rac1, offrant une approche thérapeutique prometteuse pour des cancers tels que le glioblastome et ouvrant la voie à des traitements anticancéreux innovants.", de: "Mithilfe KI-gestützter Phänotypisierung und Wirkstoff-Screening haben wir erfolgreich 30 verschiedene niedermolekulare Wirkstoffe identifiziert und patentiert, die an verschiedenen Krebszelllinien weiter untersucht werden. Die XTL-152-Serie wird derzeit auf ihr Potenzial zur Behandlung bösartiger Tumoren innerhalb der GTP-Bindungsdomäne untersucht. Insbesondere konzentriert sich die Verbindung XTL-152 auf die Hemmung des Rac1-Signalwegs und bietet einen vielversprechenden Behandlungsansatz für Krebsarten wie das Glioblastom, was den Weg für innovative Krebstherapien ebnet.", ja: "AI 主導の表現型解析と薬剤スクリーニングを活用し、私たちはさまざまながん細胞株に対するさらなる評価に向けて、30 種類の異なる低分子薬を特定・特許化することに成功しました。XTL-152 シリーズは現在、GTP 結合ドメイン内の悪性腫瘍を治療する可能性について研究されています。具体的には、XTL-152 化合物は Rac1 経路の阻害に重点を置き、膠芽腫などのがんに有望な治療アプローチを提供し、革新的ながん治療への道を開いています。",
      en: "Utilizing AI-driven phenotyping and drug screening, we have successfully identified and patented 30 distinct small-molecule drugs for further evaluation against various cancer cell lines. The XTL-152 series is currently being investigated for its potential to treat malignancies within the GTP binding domain. Specifically, the XTL-152 compound focuses on inhibiting the Rac1 pathway, providing a promising treatment approach for cancers such as glioblastoma, paving the way for innovative cancer treatments.",
      zh: "借助 AI 驱动的表型分析和药物筛选，我们已成功鉴定并申请专利 30 种不同的小分子药物，以便针对多种癌细胞系进行进一步评估。XTL-152 系列目前正在研究其治疗 GTP 结合域内恶性肿瘤的潜力。具体而言，XTL-152 化合物专注于抑制 Rac1 通路，为胶质母细胞瘤等癌症提供了有前景的治疗方法，为创新癌症疗法铺平道路。",
      es: "Mediante fenotipado y cribado de fármacos impulsados por IA, hemos identificado y patentado con éxito 30 fármacos de molécula pequeña distintos para su evaluación en diversas líneas celulares cancerosas. La serie XTL-152 se investiga actualmente por su potencial para tratar tumores malignos en el dominio de unión a GTP. En concreto, el compuesto XTL-152 se centra en inhibir la vía Rac1, ofreciendo un enfoque prometedor para cánceres como el glioblastoma y abriendo camino a tratamientos oncológicos innovadores.",
      ko: "AI 기반 표현형 분석과 약물 스크리닝을 활용하여, 우리는 다양한 암세포주에 대한 추가 평가를 위해 30종의 서로 다른 소분자 약물을 성공적으로 식별하고 특허를 취득했습니다. XTL-152 시리즈는 현재 GTP 결합 도메인 내 악성 종양 치료 가능성에 대해 연구되고 있습니다. 특히 XTL-152 화합물은 Rac1 경로 억제에 중점을 두어 교모세포종과 같은 암에 유망한 치료 접근법을 제공하며, 혁신적인 암 치료의 길을 열고 있습니다.",
    },
  };

  const CHARS = {
    en: "upperAndLowerCase",
    fr: "upperAndLowerCase",
    de: "upperAndLowerCase",
    ja: "アイウエオカキクケコサシスセソタチツテト研究開発治療患者細胞標的抑制内分泌腫瘍",
    es: "upperAndLowerCase",
    zh: "研发创新药物内分泌肿瘤治疗患者细胞靶向抑制通路激素临床",
    ko: "가나다라마바사아자차카타파하연구혁신치료환자세포표적억제",
  };
  const LABEL = { en: "EN", zh: "中", es: "ES", ko: "KO", fr: "FR", de: "DE", ja: "日" };
  const LANGTAG = { en: "en", zh: "zh-CN", es: "es", ko: "ko", fr: "fr", de: "de", ja: "ja" };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ready = false;

  function ensurePlugin() {
    if (ready) return ready;
    if (window.gsap && window.ScrambleTextPlugin) {
      gsap.registerPlugin(ScrambleTextPlugin);
      ready = true;
    }
    return ready;
  }

  function setLang(lang) {
    if (!I18N["nav.mission"][lang]) return;
    const canScramble = ensurePlugin() && !reduce;
    document.documentElement.lang = LANGTAG[lang];
    let i = 0;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const t = (I18N[el.dataset.i18n] || {})[lang];
      if (t == null) return;
      if (canScramble) {
        gsap.killTweensOf(el);
        gsap.to(el, {
          duration: 1.733,
          ease: "power2.inOut",
          delay: Math.min(i * 0.023, 0.5), // gentle top-to-bottom wave
          scrambleText: {
            text: t,
            chars: CHARS[lang] || "upperCase",
            speed: 0.5,
            revealDelay: 0.47, // scramble a while before decoding
            delimiter: "",
          },
        });
        i++;
      } else {
        el.textContent = t;
      }
    });
    document.querySelectorAll(".nav__lang-btn").forEach((b) => (b.textContent = LABEL[lang]));
    document.querySelectorAll(".nav__lang-menu [data-lang]").forEach((b) =>
      b.setAttribute("aria-current", b.dataset.lang === lang ? "true" : "false")
    );
    try { localStorage.setItem("lang", lang); } catch (e) {}
  }

  // Wire the toolbar language control (script runs after the DOM is parsed).
  const wrap = document.querySelector(".nav__lang");
  if (wrap) {
    const btn = wrap.querySelector(".nav__lang-btn");
    const menu = wrap.querySelector(".nav__lang-menu");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = wrap.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
    menu.querySelectorAll("[data-lang]").forEach((b) => {
      b.addEventListener("click", () => {
        setLang(b.dataset.lang);
        wrap.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) {
        wrap.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      }
    });
    let saved = "en";
    try { saved = localStorage.getItem("lang") || "en"; } catch (e) {}
    if (saved !== "en") setLang(saved);
    else document.querySelector('.nav__lang-menu [data-lang="en"]').setAttribute("aria-current", "true");
  }
})();
