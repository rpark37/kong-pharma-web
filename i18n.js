/* Language switcher — reveals all text with GSAP ScrambleText on change.
   Brand names, product codes (CR-067…), and contact details stay as-is.
   Medical copy translations are machine-generated and should be reviewed. */
(function () {
  const I18N = {
    "skip": { en: "Skip to content", zh: "跳至正文", es: "Saltar al contenido", ko: "본문으로 건너뛰기" },
    "nav.mission": { en: "Mission", zh: "使命", es: "Misión", ko: "미션" },
    "nav.pipeline": { en: "Pipeline", zh: "产品管线", es: "Cartera", ko: "파이프라인" },
    "nav.contact": { en: "Contact", zh: "联系我们", es: "Contacto", ko: "문의" },
    "hero.headline": {
      en: "Endocrine & Oncology Drug Innovation",
      zh: "内分泌与肿瘤药物创新",
      es: "Innovación en fármacos endocrinos y oncológicos",
      ko: "내분비 및 종양학 신약 혁신",
    },
    "hero.mission": {
      en: "Developing cutting-edge small-molecule medicines to aid patient recovery.",
      zh: "研发前沿小分子药物，助力患者康复。",
      es: "Desarrollamos medicamentos de moléculas pequeñas de vanguardia para ayudar a la recuperación de los pacientes.",
      ko: "환자 회복을 돕는 최첨단 소분자 의약품을 개발합니다.",
    },
    "hero.cta": { en: "Get in touch", zh: "联系我们", es: "Contáctanos", ko: "문의하기" },
    "hero.scroll": { en: "Scroll", zh: "向下滚动", es: "Desplázate", ko: "스크롤" },
    "mission.eyebrow": { en: "Our Mission", zh: "我们的使命", es: "Nuestra misión", ko: "우리의 사명" },
    "mission.statement": {
      en: "We develop endocrine and oncology therapies from small-molecule compounds — working to transform cancer into a manageable, chronic condition through effective, less-toxic, and accessible treatments.",
      zh: "我们以小分子化合物研发内分泌与肿瘤疗法——致力于通过有效、低毒且可及的治疗，将癌症转变为可管理的慢性疾病。",
      es: "Desarrollamos terapias endocrinas y oncológicas a partir de compuestos de moléculas pequeñas, con el fin de convertir el cáncer en una enfermedad crónica manejable mediante tratamientos eficaces, menos tóxicos y accesibles.",
      ko: "우리는 소분자 화합물로 내분비 및 종양학 치료제를 개발하며, 효과적이고 독성이 낮으며 접근 가능한 치료를 통해 암을 관리 가능한 만성 질환으로 전환하고자 합니다.",
    },
    "pipeline.eyebrow": { en: "Pipeline", zh: "产品管线", es: "Cartera de productos", ko: "파이프라인" },
    "grp.endo": { en: "Endocrine", zh: "内分泌", es: "Endocrino", ko: "내분비" },
    "grp.onco": { en: "Oncology", zh: "肿瘤学", es: "Oncología", ko: "종양학" },
    "grp.endo.desc": {
      en: "Supporting an aging population — including sexual-health therapies for men and women — by optimizing the endocrine system.",
      zh: "通过优化内分泌系统，支持老龄化人群——包括为男性和女性提供性健康疗法。",
      es: "Apoyamos a una población que envejece —incluidas terapias de salud sexual para hombres y mujeres— optimizando el sistema endocrino.",
      ko: "내분비 시스템을 최적화하여 고령화 인구를 지원합니다 — 남성과 여성을 위한 성 건강 치료 포함.",
    },
    "grp.onco.desc": {
      en: "Developing therapies that suppress cancer-cell nutrient uptake — effective, less toxic, and accessible worldwide.",
      zh: "研发抑制癌细胞营养摄取的疗法——高效、低毒，并可在全球普及。",
      es: "Desarrollamos terapias que inhiben la captación de nutrientes de las células cancerosas: eficaces, menos tóxicas y accesibles en todo el mundo.",
      ko: "암세포의 영양분 흡수를 억제하는 치료제를 개발합니다 — 효과적이고 독성이 낮으며 전 세계적으로 접근 가능합니다.",
    },
    "cr067.desc": {
      en: "Treating ED through a combination approach.",
      zh: "通过联合疗法治疗勃起功能障碍。",
      es: "Tratar la disfunción eréctil mediante un enfoque combinado.",
      ko: "복합 접근법으로 발기부전을 치료합니다.",
    },
    "estr.desc": {
      en: "Alternative to estrogen replacement therapies.",
      zh: "雌激素替代疗法的替代方案。",
      es: "Alternativa a las terapias de reemplazo de estrógeno.",
      ko: "에스트로겐 대체 요법의 대안.",
    },
    "k119.desc": {
      en: "Small-molecule oral bladder-cancer therapy.",
      zh: "小分子口服膀胱癌疗法。",
      es: "Terapia oral de moléculas pequeñas para el cáncer de vejiga.",
      ko: "소분자 경구 방광암 치료제.",
    },
    "xtl.desc": {
      en: "AI-supported therapeutic agent targeting Rac1 pathways.",
      zh: "靶向 Rac1 通路的 AI 辅助治疗药物。",
      es: "Agente terapéutico asistido por IA dirigido a las vías Rac1.",
      ko: "Rac1 경로를 표적으로 하는 AI 지원 치료제.",
    },
    "tag.phase1": { en: "Phase 1 · 2025", zh: "一期 · 2025", es: "Fase 1 · 2025", ko: "1상 · 2025" },
    "tag.ind": { en: "IND · H2 2025", zh: "IND · 2025下半年", es: "IND · S2 2025", ko: "IND · 2025 하반기" },
    "tag.dev": { en: "In development", zh: "研发中", es: "En desarrollo", ko: "개발 중" },
    "prog.overview": { en: "Program overview", zh: "项目概览", es: "Resumen del programa", ko: "프로그램 개요" },
    "contact.eyebrow": { en: "Contact", zh: "联系我们", es: "Contacto", ko: "문의" },
    "contact.title": {
      en: "Advancing patient recovery, together.",
      zh: "携手推进患者康复。",
      es: "Impulsando juntos la recuperación de los pacientes.",
      ko: "함께 환자 회복을 앞당깁니다.",
    },
    "label.phone": { en: "Phone", zh: "电话", es: "Teléfono", ko: "전화" },
    "label.email": { en: "Email", zh: "邮箱", es: "Correo", ko: "이메일" },
    "label.address": { en: "Address", zh: "地址", es: "Dirección", ko: "주소" },
    "footer.copy": {
      en: "© 2026 Kong's Pharmaceutical Co. All rights reserved.",
      zh: "© 2026 Kong's Pharmaceutical Co. 版权所有。",
      es: "© 2026 Kong's Pharmaceutical Co. Todos los derechos reservados.",
      ko: "© 2026 Kong's Pharmaceutical Co. 모든 권리 보유.",
    },
    "cr067.p1": {
      en: "As the global population ages, the demand for endocrine support to improve quality of life, especially in sexual health, is growing. Erectile dysfunction (ED) is a common condition that affects a significant percentage of aging men, characterized by the inability to achieve or maintain an erection sufficient for satisfactory sexual performance. While occasional difficulty with erections is normal, persistent ED can indicate underlying health concerns that require medical attention.",
      zh: "随着全球人口老龄化，对内分泌支持以改善生活质量（尤其是性健康）的需求日益增长。勃起功能障碍（ED）是一种常见疾病，影响相当比例的老龄男性，表现为无法获得或维持足以完成满意性行为的勃起。偶尔出现勃起困难属于正常现象，但持续性 ED 可能提示需要就医的潜在健康问题。",
      es: "A medida que la población mundial envejece, crece la demanda de apoyo endocrino para mejorar la calidad de vida, especialmente en la salud sexual. La disfunción eréctil (DE) es una afección común que afecta a un porcentaje significativo de hombres mayores y se caracteriza por la incapacidad de lograr o mantener una erección suficiente para un desempeño sexual satisfactorio. Aunque la dificultad ocasional es normal, la DE persistente puede indicar problemas de salud subyacentes que requieren atención médica.",
      ko: "전 세계 인구가 고령화되면서 삶의 질, 특히 성 건강을 개선하기 위한 내분비 지원에 대한 수요가 증가하고 있습니다. 발기부전(ED)은 상당수의 고령 남성에게 영향을 미치는 흔한 질환으로, 만족스러운 성생활에 충분한 발기를 이루거나 유지하지 못하는 것이 특징입니다. 간헐적인 발기 어려움은 정상이지만, 지속적인 ED는 의학적 주의가 필요한 기저 건강 문제를 나타낼 수 있습니다.",
    },
    "cr067.p2": {
      en: "Popular treatments, like Viagra and Cialis, have proven to be effective in the treatment of erectile dysfunction patients. However, through prolonged dosing, patients reported both headaches and flushing of the skin. Additionally, higher dosing was required to achieve a substantial effect in performance through extended use of these drugs. We are developing a combination therapy that merges the benefits of Viagra with a sexual desire modulator to restore men's sexual function as they age.",
      zh: "Viagra 和 Cialis 等常见治疗药物已被证明对勃起功能障碍患者有效。然而，长期用药后，患者报告出现头痛和皮肤潮红。此外，长期使用这些药物需要更高剂量才能显著改善表现。我们正在研发一种联合疗法，将 Viagra 的益处与性欲调节剂相结合，以恢复男性随年龄增长而下降的性功能。",
      es: "Tratamientos populares como Viagra y Cialis han demostrado ser eficaces en pacientes con disfunción eréctil. Sin embargo, con dosis prolongadas, los pacientes reportaron dolores de cabeza y enrojecimiento de la piel. Además, se requerían dosis más altas para lograr un efecto sustancial con el uso prolongado. Estamos desarrollando una terapia combinada que une los beneficios de Viagra con un modulador del deseo sexual para restaurar la función sexual masculina con la edad.",
      ko: "Viagra와 Cialis 같은 대중적인 치료제는 발기부전 환자에게 효과적임이 입증되었습니다. 그러나 장기 복용 시 환자들은 두통과 피부 홍조를 보고했습니다. 또한 장기간 사용으로 뚜렷한 효과를 얻으려면 더 높은 용량이 필요했습니다. 우리는 Viagra의 이점과 성욕 조절제를 결합한 복합 요법을 개발하여 나이가 들면서 남성의 성기능을 회복시키고자 합니다.",
    },
    "cr067.p3": {
      en: "The use of CR-067 tablets aims to decrease the effective dosage for the treatment of erectile dysfunction while also minimizing the potential side effects caused by current drugs on the market that treat ED.",
      zh: "CR-067 片剂旨在降低治疗勃起功能障碍所需的有效剂量，同时最大限度地减少目前市场上治疗 ED 药物可能引起的副作用。",
      es: "El uso de las tabletas CR-067 busca reducir la dosis eficaz para el tratamiento de la disfunción eréctil, minimizando a la vez los posibles efectos secundarios de los fármacos actuales que tratan la DE.",
      ko: "CR-067 정제는 발기부전 치료에 필요한 유효 용량을 낮추는 동시에, 현재 시판 중인 ED 치료제가 유발하는 잠재적 부작용을 최소화하는 것을 목표로 합니다.",
    },
    "estr.p1": {
      en: "Estrogen is a female sex hormone that regulates several systems in the body. It helps regulate heart, bone, and cognitive function. Its main purpose is the regulation of the reproductive system in women. Estrogen production aids in the development of breast tissue, the regulation of the menstrual cycle, and plays an important role in pregnancy. The main sources of estrogen are the ovaries and adrenal glands.",
      zh: "雌激素是一种女性性激素，调节体内多个系统。它有助于调节心脏、骨骼和认知功能。其主要作用是调节女性的生殖系统。雌激素的分泌有助于乳腺组织的发育、月经周期的调节，并在妊娠中发挥重要作用。雌激素的主要来源是卵巢和肾上腺。",
      es: "El estrógeno es una hormona sexual femenina que regula varios sistemas del cuerpo. Ayuda a regular la función cardíaca, ósea y cognitiva. Su principal función es la regulación del sistema reproductor en las mujeres. La producción de estrógeno favorece el desarrollo del tejido mamario, regula el ciclo menstrual y desempeña un papel importante en el embarazo. Sus principales fuentes son los ovarios y las glándulas suprarrenales.",
      ko: "에스트로겐은 신체의 여러 시스템을 조절하는 여성 성호르몬입니다. 심장, 뼈, 인지 기능 조절을 돕습니다. 주된 역할은 여성 생식계의 조절입니다. 에스트로겐 분비는 유방 조직 발달과 월경 주기 조절을 돕고 임신에서 중요한 역할을 합니다. 주요 공급원은 난소와 부신입니다.",
    },
    "estr.p2": {
      en: "For women, the onset of menopause brings a significant drop in estrogen, leading to menopausal symptoms and sexual dysfunction. Traditional estrogen replacement therapies raise concerns about breast cancer risk due to the artificial increase in estrogen levels in the body. Our approach provides estrogen in a new and innovative way, aimed at minimizing this risk of breast cancer development, while improving women's health post-menopause.",
      zh: "对女性而言，绝经的到来会导致雌激素显著下降，引发更年期症状和性功能障碍。传统的雌激素替代疗法因人为提高体内雌激素水平而引发对乳腺癌风险的担忧。我们的方案以全新且创新的方式提供雌激素，旨在最大限度降低乳腺癌发生风险，同时改善女性绝经后的健康。",
      es: "En las mujeres, la llegada de la menopausia provoca una caída significativa del estrógeno, lo que causa síntomas menopáusicos y disfunción sexual. Las terapias tradicionales de reemplazo de estrógeno generan preocupación por el riesgo de cáncer de mama debido al aumento artificial de los niveles de estrógeno. Nuestro enfoque administra estrógeno de una forma nueva e innovadora, con el objetivo de minimizar ese riesgo y mejorar la salud de la mujer tras la menopausia.",
      ko: "여성의 경우 폐경이 시작되면 에스트로겐이 크게 감소하여 폐경 증상과 성기능 장애가 나타납니다. 기존의 에스트로겐 대체 요법은 체내 에스트로겐 수치를 인위적으로 높여 유방암 위험에 대한 우려를 낳습니다. 우리의 접근법은 새롭고 혁신적인 방식으로 에스트로겐을 공급하여 유방암 발생 위험을 최소화하는 동시에 폐경 후 여성 건강을 개선하는 것을 목표로 합니다.",
    },
    "k119.p1": {
      en: "Cancer treatments currently on the market are known for their high toxicity and side effects, including hair loss and fatigue. Through extensive research, we have developed a small-molecule compound with high bioavailability, allowing it to efficiently penetrate cells and target tumor cells. Screening across various cell lines has demonstrated a dose-dependent response, leading to increased cancer cell suppression through targeted suppression of the Rac1 pathway.",
      zh: "目前市场上的癌症治疗以高毒性和副作用（包括脱发和疲劳）而著称。通过大量研究，我们开发出一种具有高生物利用度的小分子化合物，使其能够高效穿透细胞并靶向肿瘤细胞。在多种细胞系中的筛选显示出剂量依赖性反应，通过靶向抑制 Rac1 通路，实现对癌细胞更强的抑制。",
      es: "Los tratamientos oncológicos actuales son conocidos por su alta toxicidad y efectos secundarios, como la caída del cabello y la fatiga. Mediante una investigación exhaustiva, hemos desarrollado un compuesto de molécula pequeña con alta biodisponibilidad, que le permite penetrar las células y dirigirse eficazmente a las células tumorales. El cribado en diversas líneas celulares ha mostrado una respuesta dependiente de la dosis, aumentando la supresión de las células cancerosas mediante la inhibición dirigida de la vía Rac1.",
      ko: "현재 시판 중인 암 치료제는 탈모와 피로를 포함한 높은 독성과 부작용으로 알려져 있습니다. 광범위한 연구를 통해 우리는 생체이용률이 높은 소분자 화합물을 개발하여 세포에 효율적으로 침투하고 종양 세포를 표적으로 삼을 수 있게 했습니다. 다양한 세포주에 대한 스크리닝에서 용량 의존적 반응이 나타났으며, Rac1 경로의 표적 억제를 통해 암세포 억제가 증가했습니다.",
    },
    "k119.p2": {
      en: "Our coated, extended-release formulation minimizes the drug's toxic effects while reinforcing our strategy to slow tumor progression. From extensive in vitro and in vivo studies, we are able to focus the indication on bladder cancer. This approach aims to transform cancer from a life-threatening disease into a manageable chronic condition.",
      zh: "我们的包衣缓释制剂在最大限度降低药物毒性作用的同时，强化了我们延缓肿瘤进展的策略。通过大量体外和体内研究，我们能够将适应症聚焦于膀胱癌。该方法旨在将癌症从危及生命的疾病转变为可管理的慢性疾病。",
      es: "Nuestra formulación recubierta de liberación prolongada minimiza los efectos tóxicos del fármaco a la vez que refuerza nuestra estrategia para frenar la progresión tumoral. A partir de amplios estudios in vitro e in vivo, podemos centrar la indicación en el cáncer de vejiga. Este enfoque busca convertir el cáncer de una enfermedad mortal en una afección crónica manejable.",
      ko: "코팅된 서방형 제제는 약물의 독성 효과를 최소화하는 동시에 종양 진행을 늦추는 전략을 강화합니다. 광범위한 시험관 내 및 생체 내 연구를 통해 우리는 적응증을 방광암에 집중할 수 있습니다. 이 접근법은 암을 생명을 위협하는 질병에서 관리 가능한 만성 질환으로 전환하는 것을 목표로 합니다.",
    },
    "xtl.p1": {
      en: "The Rac1 pathway is a key player in cancer cell growth, movement, and survival. As a small GTPase in the Rho family, Rac1 acts like a switch, controlling how cancer cells spread and resist treatment. Due to its impact on tumor progression, Rac1 is being explored as a promising target for new cancer therapies.",
      zh: "Rac1 通路在癌细胞的生长、迁移和存活中起关键作用。作为 Rho 家族的一种小 GTP 酶，Rac1 如同一个开关，控制癌细胞的扩散和对治疗的抵抗。由于其对肿瘤进展的影响，Rac1 正被作为新型癌症疗法的一个有前景的靶点加以探索。",
      es: "La vía Rac1 es clave en el crecimiento, el movimiento y la supervivencia de las células cancerosas. Como pequeña GTPasa de la familia Rho, Rac1 actúa como un interruptor que controla cómo las células cancerosas se propagan y resisten al tratamiento. Por su impacto en la progresión tumoral, Rac1 se está estudiando como una diana prometedora para nuevas terapias oncológicas.",
      ko: "Rac1 경로는 암세포의 성장, 이동, 생존에 핵심적인 역할을 합니다. Rho 계열의 소형 GTPase인 Rac1은 스위치처럼 작용하여 암세포가 어떻게 퍼지고 치료에 저항하는지를 조절합니다. 종양 진행에 미치는 영향으로 인해 Rac1은 새로운 암 치료제의 유망한 표적으로 연구되고 있습니다.",
    },
    "xtl.p2": {
      en: "Utilizing AI-driven phenotyping and drug screening, we have successfully identified and patented 30 distinct small-molecule drugs for further evaluation against various cancer cell lines. The XTL-152 series is currently being investigated for its potential to treat malignancies within the GTP binding domain. Specifically, the XTL-152 compound focuses on inhibiting the Rac1 pathway, providing a promising treatment approach for cancers such as glioblastoma, paving the way for innovative cancer treatments.",
      zh: "借助 AI 驱动的表型分析和药物筛选，我们已成功鉴定并申请专利 30 种不同的小分子药物，以便针对多种癌细胞系进行进一步评估。XTL-152 系列目前正在研究其治疗 GTP 结合域内恶性肿瘤的潜力。具体而言，XTL-152 化合物专注于抑制 Rac1 通路，为胶质母细胞瘤等癌症提供了有前景的治疗方法，为创新癌症疗法铺平道路。",
      es: "Mediante fenotipado y cribado de fármacos impulsados por IA, hemos identificado y patentado con éxito 30 fármacos de molécula pequeña distintos para su evaluación en diversas líneas celulares cancerosas. La serie XTL-152 se investiga actualmente por su potencial para tratar tumores malignos en el dominio de unión a GTP. En concreto, el compuesto XTL-152 se centra en inhibir la vía Rac1, ofreciendo un enfoque prometedor para cánceres como el glioblastoma y abriendo camino a tratamientos oncológicos innovadores.",
      ko: "AI 기반 표현형 분석과 약물 스크리닝을 활용하여, 우리는 다양한 암세포주에 대한 추가 평가를 위해 30종의 서로 다른 소분자 약물을 성공적으로 식별하고 특허를 취득했습니다. XTL-152 시리즈는 현재 GTP 결합 도메인 내 악성 종양 치료 가능성에 대해 연구되고 있습니다. 특히 XTL-152 화합물은 Rac1 경로 억제에 중점을 두어 교모세포종과 같은 암에 유망한 치료 접근법을 제공하며, 혁신적인 암 치료의 길을 열고 있습니다.",
    },
  };

  const CHARS = {
    en: "upperAndLowerCase",
    es: "upperAndLowerCase",
    zh: "研发创新药物内分泌肿瘤治疗患者细胞靶向抑制通路激素临床",
    ko: "가나다라마바사아자차카타파하연구혁신치료환자세포표적억제",
  };
  const LABEL = { en: "EN", zh: "中", es: "ES", ko: "KO" };
  const LANGTAG = { en: "en", zh: "zh-CN", es: "es", ko: "ko" };
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
          duration: 2.6,
          ease: "power2.inOut",
          delay: Math.min(i * 0.035, 0.8), // gentle top-to-bottom wave
          scrambleText: {
            text: t,
            chars: CHARS[lang] || "upperCase",
            speed: 0.35,
            revealDelay: 0.7, // scramble a while before decoding
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
