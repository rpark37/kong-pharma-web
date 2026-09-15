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
    "grp.endo": { fr: "Endocrinien", de: "Endokrin", ja: "内分泌", en: "Endocrine", zh: "内分泌", es: "Endocrino", ko: "내분비" },
    "grp.onco": { fr: "Oncologie", de: "Onkologie", ja: "腫瘍学", en: "Oncology", zh: "肿瘤学", es: "Oncología", ko: "종양학" },
    "grp.endo.desc": { fr: "Soutenir une population vieillissante — y compris par des thérapies de santé sexuelle pour les hommes et les femmes — en optimisant le système endocrinien.", de: "Unterstützung einer alternden Bevölkerung – einschließlich Therapien für die sexuelle Gesundheit von Männern und Frauen – durch Optimierung des endokrinen Systems.", ja: "内分泌系を最適化することで、男女の性の健康に関する治療を含め、高齢化する人々を支援します。",
      en: "Supporting an aging population — including sexual-health therapies for men and women — by optimizing the endocrine system.",
      zh: "通过优化内分泌系统，支持老龄化人群——包括为男性和女性提供性健康疗法。",
      es: "Apoyamos a una población que envejece —incluidas terapias de salud sexual para hombres y mujeres— optimizando el sistema endocrino.",
      ko: "내분비 시스템을 최적화하여 고령화 인구를 지원합니다 — 남성과 여성을 위한 성 건강 치료 포함.",
    },
    "grp.onco.desc": { fr: "Développer des thérapies qui inhibent l'absorption des nutriments par les cellules cancéreuses — efficaces, moins toxiques et accessibles dans le monde entier.", de: "Entwicklung von Therapien, die die Nährstoffaufnahme von Krebszellen unterdrücken – wirksam, weniger toxisch und weltweit zugänglich.", ja: "がん細胞の栄養取り込みを抑制する治療法を開発します。効果的で毒性が低く、世界中で利用可能です。",
      en: "Developing therapies that suppress cancer-cell nutrient uptake — effective, less toxic, and accessible worldwide.",
      zh: "研发抑制癌细胞营养摄取的疗法——高效、低毒，并可在全球普及。",
      es: "Desarrollamos terapias que inhiben la captación de nutrientes de las células cancerosas: eficaces, menos tóxicas y accesibles en todo el mundo.",
      ko: "암세포의 영양분 흡수를 억제하는 치료제를 개발합니다 — 효과적이고 독성이 낮으며 전 세계적으로 접근 가능합니다.",
    },
    "cr067.desc": { fr: "Traiter la dysfonction érectile par une approche combinée.", de: "Behandlung der erektilen Dysfunktion durch einen Kombinationsansatz.", ja: "併用アプローチによる ED の治療。",
      en: "Treating ED through a combination approach.",
      zh: "通过联合疗法治疗勃起功能障碍。",
      es: "Tratar la disfunción eréctil mediante un enfoque combinado.",
      ko: "복합 접근법으로 발기부전을 치료합니다.",
    },
    "estr.desc": { fr: "Alternative aux thérapies de substitution des œstrogènes.", de: "Alternative zu Östrogenersatztherapien.", ja: "エストロゲン補充療法に代わる選択肢。",
      en: "Alternative to estrogen replacement therapies.",
      zh: "雌激素替代疗法的替代方案。",
      es: "Alternativa a las terapias de reemplazo de estrógeno.",
      ko: "에스트로겐 대체 요법의 대안.",
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
    "estr.viz": { fr: "Le promédicament libère l'œstrogène progressivement et en toute sécurité.", de: "Der Prodrug-Käfig setzt Östrogen allmählich und sicher frei.", ja: "プロドラッグが緩やかに安全にエストロゲンを放出。",
      en: "Prodrug cage releases estrogen gradually and safely.",
      zh: "前药载体缓慢而安全地释放雌激素。",
      es: "El profármaco libera estrógeno de forma gradual y segura.",
      ko: "전구약물이 에스트로겐을 서서히 안전하게 방출합니다.",
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
    "estr.p1": { fr: "L'œstrogène est une hormone sexuelle féminine qui régule plusieurs systèmes de l'organisme. Il contribue à réguler les fonctions cardiaque, osseuse et cognitive. Son rôle principal est la régulation du système reproducteur chez la femme. La production d'œstrogène favorise le développement du tissu mammaire, régule le cycle menstruel et joue un rôle important dans la grossesse. Les principales sources d'œstrogène sont les ovaires et les glandes surrénales.", de: "Östrogen ist ein weibliches Sexualhormon, das mehrere Systeme des Körpers reguliert. Es hilft, die Herz-, Knochen- und kognitive Funktion zu regulieren. Seine Hauptaufgabe ist die Regulierung des Fortpflanzungssystems bei Frauen. Die Östrogenproduktion unterstützt die Entwicklung des Brustgewebes, reguliert den Menstruationszyklus und spielt eine wichtige Rolle in der Schwangerschaft. Die Hauptquellen von Östrogen sind die Eierstöcke und die Nebennieren.", ja: "エストロゲンは、体内の複数の系統を調節する女性ホルモンです。心臓、骨、認知機能の調節を助けます。その主な役割は女性の生殖器系の調節です。エストロゲンの分泌は乳房組織の発達や月経周期の調節を助け、妊娠において重要な役割を果たします。エストロゲンの主な供給源は卵巣と副腎です。",
      en: "Estrogen is a female sex hormone that regulates several systems in the body. It helps regulate heart, bone, and cognitive function. Its main purpose is the regulation of the reproductive system in women. Estrogen production aids in the development of breast tissue, the regulation of the menstrual cycle, and plays an important role in pregnancy. The main sources of estrogen are the ovaries and adrenal glands.",
      zh: "雌激素是一种女性性激素，调节体内多个系统。它有助于调节心脏、骨骼和认知功能。其主要作用是调节女性的生殖系统。雌激素的分泌有助于乳腺组织的发育、月经周期的调节，并在妊娠中发挥重要作用。雌激素的主要来源是卵巢和肾上腺。",
      es: "El estrógeno es una hormona sexual femenina que regula varios sistemas del cuerpo. Ayuda a regular la función cardíaca, ósea y cognitiva. Su principal función es la regulación del sistema reproductor en las mujeres. La producción de estrógeno favorece el desarrollo del tejido mamario, regula el ciclo menstrual y desempeña un papel importante en el embarazo. Sus principales fuentes son los ovarios y las glándulas suprarrenales.",
      ko: "에스트로겐은 신체의 여러 시스템을 조절하는 여성 성호르몬입니다. 심장, 뼈, 인지 기능 조절을 돕습니다. 주된 역할은 여성 생식계의 조절입니다. 에스트로겐 분비는 유방 조직 발달과 월경 주기 조절을 돕고 임신에서 중요한 역할을 합니다. 주요 공급원은 난소와 부신입니다.",
    },
    "estr.p2": { fr: "Chez les femmes, l'arrivée de la ménopause entraîne une baisse importante des œstrogènes, à l'origine de symptômes ménopausiques et de troubles sexuels. Les thérapies traditionnelles de substitution des œstrogènes suscitent des inquiétudes quant au risque de cancer du sein en raison de l'augmentation artificielle des taux d'œstrogènes dans l'organisme. Notre approche administre les œstrogènes d'une manière nouvelle et innovante, visant à minimiser ce risque de cancer du sein tout en améliorant la santé des femmes après la ménopause.", de: "Bei Frauen führt der Beginn der Wechseljahre zu einem deutlichen Rückgang des Östrogens, was Wechseljahresbeschwerden und sexuelle Funktionsstörungen zur Folge hat. Herkömmliche Östrogenersatztherapien geben aufgrund des künstlichen Anstiegs des Östrogenspiegels Anlass zur Sorge hinsichtlich des Brustkrebsrisikos. Unser Ansatz liefert Östrogen auf neue und innovative Weise, um dieses Risiko einer Brustkrebsentwicklung zu minimieren und zugleich die Gesundheit der Frau nach den Wechseljahren zu verbessern.", ja: "女性では、閉経の始まりによりエストロゲンが大幅に減少し、更年期症状や性機能障害を引き起こします。従来のエストロゲン補充療法は、体内のエストロゲン値を人工的に高めるため、乳がんリスクへの懸念があります。私たちのアプローチは、新しく革新的な方法でエストロゲンを供給し、この乳がん発症リスクを最小限に抑えつつ、閉経後の女性の健康を改善することを目指しています。",
      en: "For women, the onset of menopause brings a significant drop in estrogen, leading to menopausal symptoms and sexual dysfunction. Traditional estrogen replacement therapies raise concerns about breast cancer risk due to the artificial increase in estrogen levels in the body. Our approach provides estrogen in a new and innovative way, aimed at minimizing this risk of breast cancer development, while improving women's health post-menopause.",
      zh: "对女性而言，绝经的到来会导致雌激素显著下降，引发更年期症状和性功能障碍。传统的雌激素替代疗法因人为提高体内雌激素水平而引发对乳腺癌风险的担忧。我们的方案以全新且创新的方式提供雌激素，旨在最大限度降低乳腺癌发生风险，同时改善女性绝经后的健康。",
      es: "En las mujeres, la llegada de la menopausia provoca una caída significativa del estrógeno, lo que causa síntomas menopáusicos y disfunción sexual. Las terapias tradicionales de reemplazo de estrógeno generan preocupación por el riesgo de cáncer de mama debido al aumento artificial de los niveles de estrógeno. Nuestro enfoque administra estrógeno de una forma nueva e innovadora, con el objetivo de minimizar ese riesgo y mejorar la salud de la mujer tras la menopausia.",
      ko: "여성의 경우 폐경이 시작되면 에스트로겐이 크게 감소하여 폐경 증상과 성기능 장애가 나타납니다. 기존의 에스트로겐 대체 요법은 체내 에스트로겐 수치를 인위적으로 높여 유방암 위험에 대한 우려를 낳습니다. 우리의 접근법은 새롭고 혁신적인 방식으로 에스트로겐을 공급하여 유방암 발생 위험을 최소화하는 동시에 폐경 후 여성 건강을 개선하는 것을 목표로 합니다.",
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
