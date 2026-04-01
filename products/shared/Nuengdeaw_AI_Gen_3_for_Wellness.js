'use strict';

// ── Static AT (default — ใช้เมื่อยังไม่มี Personal Baseline) ────────────────
// เมื่อผู้ใช้ calibrate แล้ว NuengdeawBaseline.getAdaptiveAT() จะคืน AT ที่
// ผสม Static × 0.4 + Personal × 0.6 แทน
const AT_STATIC = {
  HRV_LOW:10, HRV_STRESS:20, HRV_READY:50,
  RESP_APNEA:5, RESP_HIGH:30,
  HR_BRADY:45, HR_TACHY:120, HR_EXTREME:140,
  GSR_LOW:0.5, GSR_HIGH:15, GSR_EXTREME:20,
  N400_VETO:4.0, THETA_ALPHA_HIGH:2.5, SESSION_MAX:7200, CONFIDENCE_MIN:0.50,
};

// AT ที่ใช้จริงในทุกฟังก์ชัน (อาจถูก override โดย _resolveAT ต่อ call)
let AT = { ...AT_STATIC };

// _resolveAT: รับ adaptiveAT จาก assess() input แล้วตั้งค่า AT ชั่วคราว
// เรียกก่อนทุก assess() และ reset หลังคำนวณเสร็จ
const _resolveAT = (adaptiveAT) => {
  if (adaptiveAT && typeof adaptiveAT === 'object') {
    AT = { ...AT_STATIC, ...adaptiveAT };
  } else {
    AT = { ...AT_STATIC };
  }
};

const PS_DB = {
  'FLOW':{ psCode:'PS.FLOW', label:'Flow', labelTH:'สภาวะสมาธิสูงสุด (Flow State)', emoji:'🎯', severity:'positive',
    description:'HR และ GSR อยู่ในเกณฑ์ปกติ HRV สูง บ่งชี้สมดุลระบบประสาทอัตโนมัติ (ANS Balance) ดี ผู้ใช้ตื่นตัวแต่ไม่มีสัญญาณความเครียดหรือพยาธิสภาพ',
    action:'ACT.MAINTAIN', actionDesc:'ติดตามสัญญาณชีพต่อเนื่อง ไม่ต้องแทรกแซง',
    physioExpect:{hrv:[28,80],hr:[54,80],gsr:[1.0,6.5],rr:[9,18]},
    suggestedActions:['ติดตามสัญญาณชีพ (Vital Signs Monitoring) ต่อเนื่อง','บันทึกค่าพื้นฐาน (Baseline) ของผู้ใช้รายนี้ไว้อ้างอิง','ไม่ต้องแทรกแซง — สัญญาณชีพอยู่ในเกณฑ์ปกติ'],
    references:[{author:'Csikszentmihalyi & Nakamura',year:2014,title:'The concept of flow',source:'Oxford Handbook of Human Motivation, 239–263'},{author:'Klimesch, W.',year:2018,title:'The frequency architecture of brain and brain body oscillations',source:'European Journal of Neuroscience, 48(7), 2431–2452'}]},

  'READY':{ psCode:'PS.ENCODING', label:'Alert / Ready', labelTH:'สภาวะตื่นตัวปกติ (Alert / Resting Ready)', emoji:'🧠', severity:'positive',
    description:'สัญญาณชีพทุกช่องทางอยู่ในเกณฑ์ปกติ HRV อยู่ในระดับดี ระบบประสาทซิมพาเทติก (Sympathetic) และพาราซิมพาเทติก (Parasympathetic) สมดุล ไม่พบความผิดปกติ',
    action:'ACT.ANCHOR', actionDesc:'บันทึกค่า Baseline — สภาวะพร้อมใช้อ้างอิง',
    physioExpect:{hrv:[36,78],hr:[50,76],gsr:[1.0,5.0],rr:[8,16]},
    suggestedActions:['บันทึกค่าพื้นฐาน (Baseline Recording) ของผู้ใช้','ติดตามสัญญาณชีพตามปกติ ไม่ต้องแทรกแซง','เปรียบเทียบค่านี้กับการวัดครั้งถัดไปเพื่อตรวจหาการเปลี่ยนแปลง'],
    references:[{author:'Dehaene, S.',year:2009,title:'Reading in the Brain',source:'Viking/Penguin'},{author:'Berntson et al.',year:1997,title:'Heart rate variability: Origins, methods, and interpretive caveats',source:'Psychophysiology, 34(6), 623–648'}]},

  'STRESS':{ psCode:'PS.OVERLOAD', label:'Acute Stress', labelTH:'ภาวะความเครียดเฉียบพลัน (Acute Stress Response)', emoji:'😰', severity:'warning',
    description:'HR และ GSR สูงขึ้น HRV ลดลง RR เพิ่มขึ้น บ่งชี้การกระตุ้นระบบประสาทซิมพาเทติกเกิน (Sympathetic Hyperactivation) ระบบประสาทอัตโนมัติไม่สมดุล',
    action:'ACT.SIMPLIFY + ACT.BREAK', actionDesc:'ลด stressor — หาก HRV < 10 ms ให้หยุดกิจกรรมทันที',
    physioExpect:{hrv:[10,30],hr:[85,132],gsr:[8.0,25],rr:[18,35]},
    suggestedActions:['ให้หยุดกิจกรรมและพักในท่าสบาย (Semi-Fowler หรือนั่ง)','ประเมิน HR, RR, และ SpO₂ ซ้ำภายใน 5 นาที','แนะนำการหายใจช้า (Controlled Breathing) อัตรา 6 ครั้ง/นาที','หาก HRV < 10 ms: หยุดกิจกรรมทันที ประเมินซ้ำทุก 1 นาที'],
    references:[{author:'Sweller, J.',year:1988,title:'Cognitive load during problem solving: Effects on learning',source:'Cognitive Science, 12(2), 257–285'},{author:'Shaffer & Ginsberg',year:2017,title:'An overview of heart rate variability metrics and norms',source:'Frontiers in Public Health, 5, 258'},{author:'Task Force ESC/NASPE',year:1996,title:'Heart Rate Variability: Standards of Measurement',source:'Circulation, 93(5), 1043–1065'}]},

  'CONFUSION':{ psCode:'PS.CONFUSION', label:'Confusion', labelTH:'ภาวะสับสน (Acute Confusion / Disorientation)', emoji:'😵', severity:'warning',
    description:'HR และ GSR สูงขึ้นปานกลาง HRV ลดลง EEG แสดง Theta สูงขึ้น บ่งชี้ภาวะสับสนและการตอบสนองต่อสิ่งเร้าผิดปกติ ต้องประเมิน Level of Consciousness',
    action:'ACT.CLARIFY', actionDesc:'ประเมิน GCS และ Orientation — ตรวจแยกสาเหตุ Metabolic',
    physioExpect:{hrv:[12,36],hr:[78,120],gsr:[6.0,18],rr:[16,30]},
    suggestedActions:['ประเมินระดับความรู้สึกตัว (Glasgow Coma Scale / GCS)','ตรวจ Orientation: บุคคล สถานที่ เวลา (Person, Place, Time)','ตรวจ SpO₂ และ Blood Glucose เพื่อแยกสาเหตุ Metabolic','หากสับสนรุนแรงหรือแย่ลง: ปรึกษาผู้เชี่ยวชาญทันที'],
    references:[{author:'Kutas & Federmeier',year:2011,title:'Thirty years and counting: Finding meaning in the N400 component',source:'Annual Review of Psychology, 62, 621–647'},{author:'Sweller, J.',year:1988,title:'Cognitive load during problem solving',source:'Cognitive Science, 12(2), 257–285'}]},

  'BOREDOM':{ psCode:'PS.BOREDOM', label:'Low Arousal', labelTH:'ภาวะความตื่นตัวต่ำ (Hypoarousal / Low Arousal)', emoji:'😴', severity:'mild',
    description:'HR และ HRV อยู่ในระดับต่ำของปกติ GSR ลดลง Parasympathetic dominant ความตื่นตัวต่ำ ต้องแยกจากภาวะง่วงซึม (Drowsiness) หรือผลข้างเคียงของยากดประสาท',
    action:'ACT.CHALLENGE', actionDesc:'ประเมิน Epworth Sleepiness Scale — แยกสาเหตุยา',
    physioExpect:{hrv:[22,52],hr:[56,78],gsr:[5.0,14],rr:[10,18]},
    suggestedActions:['ประเมินว่าเป็นความตื่นตัวต่ำตามธรรมชาติ หรือผลข้างเคียงของยา (Drug Effect)','ตรวจ Epworth Sleepiness Scale หากสงสัย Excessive Daytime Sleepiness','กระตุ้นให้เคลื่อนไหวร่างกาย หรือเปลี่ยนสภาพแวดล้อม'],
    references:[{author:'Csikszentmihalyi & Nakamura',year:2014,title:'The concept of flow',source:'Oxford Handbook of Human Motivation, 239–263'},{author:'Fairclough, S.H.',year:2009,title:'Fundamentals of physiological computing',source:'Interacting with Computers, 21(1–2), 133–145'}]},

  'EXCITEMENT':{ psCode:'PS.EXCITEMENT', label:'High Arousal', labelTH:'ภาวะความตื่นตัวสูง (High Arousal / Sympathetic Surge)', emoji:'⚡', severity:'neutral',
    description:'HR และ GSR สูงขึ้น HRV ลดลงเล็กน้อย บ่งชี้การกระตุ้น Sympathetic ชั่วคราว ยังไม่ถึงเกณฑ์พยาธิสภาพ ต้องติดตามต่อเนื่อง',
    action:'ACT.ENRICH', actionDesc:'ติดตาม HR และ GSR — ประเมินซ้ำใน 5 นาที',
    physioExpect:{hrv:[20,50],hr:[74,118],gsr:[7.0,20],rr:[14,28]},
    suggestedActions:['ติดตาม HR และ RR ต่อเนื่อง ประเมินซ้ำภายใน 5 นาที','หาก HR > 120 bpm นานกว่า 10 นาที: ประเมินหา Tachyarrhythmia','แยกสาเหตุ: ความตื่นเต้นปกติ vs. อาการผิดปกติ'],
    references:[{author:'Picard, R.W.',year:1997,title:'Affective Computing',source:'MIT Press'},{author:'Bradley & Lang',year:2000,title:'Measuring emotion: Behavior, feeling, and physiology',source:'Cognitive Neuroscience of Emotion, 25, 49–59'}]},

  'FATIGUE':{ psCode:'PS.DROWSY', label:'Drowsy / Fatigue', labelTH:'ภาวะอ่อนล้า / ง่วงซึม (Fatigue / Drowsiness)', emoji:'😪', severity:'warning',
    description:'EEG Theta เพิ่มสูงขึ้น HR และ HRV ลดลงเล็กน้อย GSR ต่ำ บ่งชี้ภาวะง่วงซึม (Drowsiness) หรืออ่อนล้าสะสม เสี่ยงต่อการเผลอหลับโดยไม่ตั้งใจ (Microsleep)',
    action:'ACT.BREAK', actionDesc:'ให้หยุดพักทันที — ห้ามขับยานพาหนะหรือควบคุมเครื่องจักร',
    physioExpect:{hrv:[16,46],hr:[58,86],gsr:[1.5,7.5],rr:[11,22]},
    suggestedActions:['ให้หยุดกิจกรรมที่ต้องการสมาธิทันที','ห้ามขับยานพาหนะหรือควบคุมเครื่องจักร (Contraindicated)','ประเมิน Epworth Sleepiness Scale และประวัติการนอนหลับ','หากเกิดซ้ำบ่อย: ปรึกษาผู้เชี่ยวชาญหากอาการไม่ดีขึ้น'],
    references:[{author:'Harrison & Horne',year:2000,title:'The impact of sleep deprivation on decision making',source:'Journal of Experimental Psychology: Applied, 6(3), 236–249'},{author:'Berntson et al.',year:1997,title:'Heart rate variability: Origins, methods, and interpretive caveats',source:'Psychophysiology, 34(6), 623–648'}]},

  'NEUTRAL':{ psCode:'PS.NEUTRAL', label:'Within Normal Limits', labelTH:'สัญญาณชีพปกติ (Within Normal Limits)', emoji:'😐', severity:'normal',
    description:'สัญญาณชีพทุกช่องทางอยู่ในเกณฑ์ปกติ ±10% จากค่าพื้นฐาน (Baseline) ไม่พบความผิดปกติ',
    action:'ACT.CONTINUE', actionDesc:'ติดตามสัญญาณชีพตามปกติ',
    physioExpect:{hrv:[22,58],hr:[57,92],gsr:[2.0,9.0],rr:[10,20]},
    suggestedActions:['ติดตามสัญญาณชีพ (Vital Signs) ตามรอบปกติ','บันทึกค่า — ไม่ต้องแทรกแซง'],
    references:[{author:'Fairclough, S.H.',year:2009,title:'Fundamentals of physiological computing',source:'Interacting with Computers, 21(1–2), 133–145'}]},

  'FRUSTRATION':{ psCode:'PS.FRUSTRATION', label:'Emotional Stress', labelTH:'ภาวะความเครียดทางอารมณ์ (Emotional Stress / Frustration)', emoji:'😤', severity:'warning',
    description:'HR และ GSR สูงขึ้นชัดเจน HRV ต่ำ EEG Beta เพิ่มขึ้น บ่งชี้การกระตุ้น Sympathetic จากความเครียดทางอารมณ์ ต้องประเมินและลดสิ่งกระตุ้น',
    action:'ACT.REFRAME', actionDesc:'ประเมิน HR และ GSR — ให้พักหากค่าไม่ลดลงใน 5 นาที',
    physioExpect:{hrv:[8,28],hr:[90,138],gsr:[10,28],rr:[18,36]},
    suggestedActions:['ให้หยุดกิจกรรมชั่วคราวและพักในท่าสบาย','ประเมิน HR ซ้ำภายใน 5 นาที','แนะนำ Slow Breathing หรือ Progressive Muscle Relaxation','หาก HR > 120 bpm หรือ GSR > 20 µS: ประเมิน Acute Stress Reaction'],
    references:[{author:'Bradley & Lang',year:2000,title:'Measuring emotion: Behavior, feeling, and physiology',source:'Cognitive Neuroscience of Emotion, 25, 49–59'},{author:'Thayer & Lane',year:2000,title:'A model of neurovisceral integration in emotion regulation',source:'Journal of Affective Disorders, 61(3), 201–216'}]},

  'ANXIETY':{ psCode:'PS.ANXIETY', label:'Acute Anxiety', labelTH:'ภาวะวิตกกังวลเฉียบพลัน (Acute Anxiety / Sympathetic Hyperactivation)', emoji:'😟', severity:'critical',
    description:'HR > 90 ครั้ง/นาที, GSR สูง, HRV < 24 ms, RR เพิ่มขึ้น, EEG Beta dominant บ่งชี้ Sympathetic Hyperactivation เข้าได้กับภาวะวิตกกังวลเฉียบพลัน',
    action:'ACT.GROUND', actionDesc:'ลด Arousal ก่อน — ประเมิน Panic Attack หาก HR > 130 bpm',
    physioExpect:{hrv:[7,24],hr:[92,140],gsr:[9.0,26],rr:[20,38]},
    suggestedActions:['ให้ผู้ใช้นั่งหรือนอนในท่าสบาย ลดสิ่งกระตุ้น (Stimulus Reduction)','แนะนำ Diaphragmatic Breathing: หายใจเข้า 4 วิ → กลั้น 2 วิ → หายใจออก 6 วิ','ประเมิน SpO₂, HR, RR ทุก 2 นาที','หาก HR > 130 bpm หรือมี Chest Pain/Dyspnea: ประเมิน Panic Attack / Acute Cardiac Event','หาก HRV < 10 ms ต่อเนื่อง > 5 นาที: ปรึกษาผู้เชี่ยวชาญทันที'],
    references:[{author:'Wilhelm et al.',year:2001,title:'Breathing and attention: Physiological links in everyday activities',source:'Psychophysiology, 38(5), 792–800'},{author:'Thayer & Lane',year:2000,title:'A model of neurovisceral integration in emotion regulation',source:'Journal of Affective Disorders, 61(3), 201–216'},{author:'Shaffer & Ginsberg',year:2017,title:'An overview of heart rate variability metrics and norms',source:'Frontiers in Public Health, 5, 258'}]},

  'CURIOSITY':{ psCode:'PS.CURIOSITY', label:'Positive High Arousal', labelTH:'ภาวะตื่นตัวสูงเชิงบวก (Positive High Arousal)', emoji:'🤔', severity:'positive',
    description:'HR เพิ่มเล็กน้อย GSR ปกติ EEG Theta และ Gamma สูงขึ้น บ่งชี้ Prefrontal Cortex active ความตื่นตัวเชิงบวก (Positive Arousal) ไม่มีสัญญาณพยาธิสภาพ',
    action:'ACT.EXPLORE', actionDesc:'ติดตามปกติ — สัญญาณชีพอยู่ในเกณฑ์ดี',
    physioExpect:{hrv:[28,64],hr:[64,96],gsr:[2.5,10],rr:[11,22]},
    suggestedActions:['ติดตามสัญญาณชีพตามปกติ — ไม่ต้องแทรกแซง','บันทึกค่าเพื่อเปรียบเทียบกับ Baseline'],
    references:[{author:'Picard, R.W.',year:1997,title:'Affective Computing',source:'MIT Press'},{author:'Klimesch, W.',year:2018,title:'The frequency architecture of brain and brain body oscillations',source:'European Journal of Neuroscience, 48(7), 2431–2452'}]},

  'DISGUST':{ psCode:'PS.DISGUST', label:'Negative Emotional Stress', labelTH:'ภาวะความเครียดทางอารมณ์เชิงลบ (Negative Emotional Stress)', emoji:'😒', severity:'mild',
    description:'HRV ต่ำ GSR สูงปานกลาง HR สูงกว่า Baseline บ่งชี้ Moderate Sympathetic Activation เกี่ยวข้องกับอารมณ์เชิงลบ ต้องประเมินสาเหตุและติดตาม',
    action:'ACT.REDIRECT', actionDesc:'ประเมินสาเหตุ — ติดตาม HR และ GSR ต่อ',
    physioExpect:{hrv:[10,32],hr:[72,112],gsr:[7.0,22],rr:[14,28]},
    suggestedActions:['ประเมินสาเหตุของความเครียดทางอารมณ์','ให้พักหากค่า HR หรือ GSR ยังสูงต่อเนื่อง','บันทึกและเปรียบเทียบกับ Baseline ของผู้ใช้'],
    references:[{author:'Bradley & Lang',year:2000,title:'Measuring emotion: Behavior, feeling, and physiology',source:'Cognitive Neuroscience of Emotion, 25, 49–59'},{author:'Mauss & Robinson',year:2009,title:'Measures of emotion: A review',source:'Cognition & Emotion, 23(2), 209–237'}]},

  'SURPRISE':{ psCode:'PS.SURPRISE', label:'Acute Orienting Response', labelTH:'การตอบสนองเฉียบพลันต่อสิ่งเร้า (Acute Orienting Response)', emoji:'😲', severity:'neutral',
    description:'HR และ GSR spike ชั่วคราว (Transient) EEG แสดง P300-like response บ่งชี้ Orienting Response ปกติ คาดว่าจะกลับสู่ปกติภายใน 1–2 นาที',
    action:'ACT.STABILIZE', actionDesc:'ติดตาม HR และ GSR — ประเมินซ้ำใน 2 นาที',
    physioExpect:{hrv:[14,44],hr:[78,130],gsr:[7.0,24],rr:[14,32]},
    suggestedActions:['ติดตาม HR และ GSR ประเมินซ้ำใน 2 นาที','หากสัญญาณยังไม่กลับสู่ปกติหลัง 5 นาที: ประเมินสาเหตุที่อาจเกิดขึ้น','บันทึกเวลาที่เกิดเหตุการณ์'],
    references:[{author:'Kutas & Federmeier',year:2011,title:'Thirty years and counting: Finding meaning in the N400 component',source:'Annual Review of Psychology, 62, 621–647'}]},

  'CALM':{ psCode:'PS.CALM', label:'Complete Rest', labelTH:'ภาวะพักสมบูรณ์ (Complete Rest / Parasympathetic Dominance)', emoji:'😌', severity:'positive',
    description:'HRV สูง HR ต่ำปกติ GSR ต่ำ EEG Alpha dominant บ่งชี้ Parasympathetic Dominance เต็มที่ สัญญาณชีพอยู่ในเกณฑ์ดีเยี่ยม',
    action:'ACT.SUSTAIN', actionDesc:'ไม่ต้องแทรกแซง — บันทึก Resting Baseline',
    physioExpect:{hrv:[40,90],hr:[46,70],gsr:[0.6,4.0],rr:[6,14]},
    suggestedActions:['ไม่ต้องแทรกแซง — สัญญาณชีพอยู่ในเกณฑ์ดีเยี่ยม','บันทึกค่า Resting Baseline ของผู้ใช้รายนี้','ติดตามสัญญาณชีพตามปกติ'],
    references:[{author:'Berntson et al.',year:1997,title:'Heart rate variability: Origins, methods, and interpretive caveats',source:'Psychophysiology, 34(6), 623–648'},{author:'Kreibig, S.D.',year:2010,title:'Autonomic nervous system activity in emotion',source:'Biological Psychology, 84(3), 394–421'}]},
};

const WELLNESS_DB = {
  'BRADYCARDIA':{ refCode:'R00.1', label:'รูปแบบ HR ต่ำ (Low HR Pattern)', severity:'critical',
    trigger:(bio)=>bio.hr<AT.HR_BRADY,
    description:'HR < 45 ครั้ง/นาที — ชีพจรช้ากว่าเกณฑ์ อาจเกิดจาก Conduction Abnormality หรือยาในกลุ่ม Beta-blocker/Digoxin/Amiodarone',
    symptoms:['HR < 45 ครั้ง/นาที','อาจมีอาการวิงเวียน (Dizziness)','อ่อนแรง (Weakness) หรือเป็นลม (Syncope)','ในนักกีฬาอาจเป็น Athletic Heart Syndrome'],
    suggestedActions:['⚠️ ประเมิน ความเสถียรของร่างกาย และระดับความรู้สึกตัว','วัด HR และ BP ซ้ำทุก 1 นาที บันทึกผล','ตรวจสอบประวัติยาที่ใช้ (Beta-blocker, Digoxin, Amiodarone)','ควรพบผู้เชี่ยวชาญเพื่อตรวจเพิ่มเติม','หาก HR < 40 bpm หรือมี ความไม่เสถียรของร่างกาย: ขอความช่วยเหลือจากผู้เชี่ยวชาญทันที'],
    references:[{author:'Malik et al.',year:2019,title:'Resting heart rate: A modifiable prognostic indicator of cardiovascular risk',source:'European Heart Journal, 40(38), 3109–3117'}]},

  'TACHYCARDIA':{ refCode:'R00.0', label:'รูปแบบ HR สูง (Elevated HR Pattern)', severity:'warning',
    trigger:(bio)=>bio.hr>AT.HR_TACHY,
    description:'HR > 120 ครั้ง/นาที — ชีพจรเร็วกว่าเกณฑ์ อาจเกิดจาก Fever, Dehydration, Anxiety, Anemia หรือ Cardiac Arrhythmia',
    symptoms:['HR > 120 ครั้ง/นาที','อาจมีใจสั่น (Palpitation)','เหนื่อยหอบ (Dyspnea)','มักพบ GSR สูงร่วมด้วย'],
    suggestedActions:['ให้ผู้ใช้นั่งพักในที่อากาศถ่ายเท ดื่มน้ำ','ประเมิน BP และ SpO₂','ลอง Vagal Maneuver (Valsalva Maneuver) หากสงสัย SVT','ควรพบผู้เชี่ยวชาญเพื่อตรวจเพิ่มเติม','หาก HR > 140 bpm หรือมี Chest Pain / Syncope: ขอความช่วยเหลือจากผู้เชี่ยวชาญทันที'],
    references:[{author:'Malik et al.',year:2019,title:'Resting heart rate: A modifiable prognostic indicator',source:'European Heart Journal, 40(38), 3109–3117'},{author:'Task Force ESC/NASPE',year:1996,title:'Heart Rate Variability: Standards of Measurement',source:'Circulation, 93(5), 1043–1065'}]},

  'AUTONOMIC_DYSFUNCTION':{ refCode:'G90.9', label:'ความไม่สมดุล ANS (ANS Imbalance Pattern)', severity:'warning',
    trigger:(bio)=>bio.hrv<AT.HRV_STRESS&&bio.hr>90,
    description:'HRV RMSSD < 20 ms ร่วมกับ HR > 90 ครั้ง/นาที บ่งชี้ ANS Imbalance — Sympathetic Dominance ต่อเนื่อง',
    symptoms:['HRV RMSSD < 20 ms','HR > 90 ครั้ง/นาที','Sympathetic Dominance','ANS Imbalance'],
    suggestedActions:['ประเมิน Orthostatic Vital Signs (นอน → นั่ง → ยืน)','ซักประวัติความเครียดสะสมและปัจจัยเสี่ยง','ตรวจ ECG และพิจารณา 24-hr Holter Monitoring หากพบซ้ำ','พิจารณาส่ง Cardiologist หาก HRV < 10 ms เกิดซ้ำหลายครั้ง'],
    references:[{author:'Thayer & Lane',year:2000,title:'A model of neurovisceral integration in emotion regulation',source:'Journal of Affective Disorders, 61(3), 201–216'},{author:'Shaffer & Ginsberg',year:2017,title:'An overview of heart rate variability metrics and norms',source:'Frontiers in Public Health, 5, 258'}]},

  'APNEA_RISK':{ refCode:'G47.3', label:'รูปแบบการหายใจช้ามาก (Very Low Breathing Pattern)', severity:'critical',
    trigger:(bio)=>bio.rr<AT.RESP_APNEA,
    description:'RR < 5 ครั้ง/นาที — อัตราการหายใจต่ำวิกฤติ (AT.RESP.APNEA 🔒) เสี่ยง Hypoxia อาจเกี่ยวข้องกับ Sleep Apnea, Opioid-Induced Respiratory Depression หรือ CNS Depression',
    symptoms:['RR < 5 ครั้ง/นาที','SpO₂ อาจลดลง (Oxygen Desaturation)','อาจมีระดับความรู้สึกตัวลดลง (Decreased LOC)'],
    suggestedActions:['🚨 Safety Lock ถูกเปิดใช้งาน — ดำเนินการทันที','ตรวจสอบว่าผู้ใช้หายใจและตอบสนองต่อการกระตุ้น','วัด SpO₂ และ EtCO₂ ถ้ามี','จัดท่า Airway Positioning และให้ Supplemental Oxygen','หากไม่ตอบสนอง: ขอความช่วยเหลือฉุกเฉินทันที','ส่งพบแพทย์เพื่อทำ Sleep Study (Polysomnography)'],
    references:[{author:'Berntson et al.',year:1994,title:'Autonomic space and psychophysiological response',source:'Psychophysiology, 31(1), 44–61'},{author:'American Academy of Sleep Medicine',year:2012,title:'International Classification of Sleep Disorders (3rd ed.)',source:'AASM'}]},

  'HYPERVENTILATION':{ refCode:'R06.4', label:'รูปแบบการหายใจเร็ว (Rapid Breathing Pattern)', severity:'warning',
    trigger:(bio)=>bio.rr>AT.RESP_HIGH,
    description:'RR > 30 ครั้ง/นาที — หายใจเร็วเกินเกณฑ์ ทำให้ CO₂ ในเลือดต่ำลง (Hypocapnia) เสี่ยง Respiratory Alkalosis มักพบร่วมกับภาวะความวิตกกังวลสูง',
    symptoms:['RR > 30 ครั้ง/นาที','อาจมีวิงเวียน (Dizziness)','มือเท้าชา (Paresthesia)','ใจสั่น (Palpitation)'],
    suggestedActions:['ให้ผู้ใช้นั่งพัก ลดสิ่งกระตุ้น','แนะนำ Pursed-Lip Breathing — เน้นหายใจออกยาวกว่าเข้า (I:E ratio = 1:2)','ห้ามใช้ Paper Bag Breathing — เสี่ยง Hypoxia','วัด SpO₂ และ EtCO₂ ถ้ามี','หาก RR > 35 ครั้ง/นาที หรือมี Tetany/Syncope: ปรึกษาผู้เชี่ยวชาญทันที'],
    references:[{author:'Wilhelm et al.',year:2001,title:'Breathing and attention',source:'Psychophysiology, 38(5), 792–800'}]},

  'ANXIETY_PATTERN':{ refCode:'F41.9', label:'รูปแบบความวิตกกังวลสะสม (Anxiety Pattern)', severity:'critical',
    trigger:(bio,bands,state,history)=>{const c=(history||[]).filter(h=>h==='ANXIETY').length;return state==='ANXIETY'&&bio.hrv<20&&c>=3;},
    description:'ANXIETY state ซ้ำ ≥ 3 ครั้ง ร่วมกับ HRV < 20 ms เรื้อรัง รูปแบบนี้บ่งชี้ความวิตกกังวลสะสม ควรปรึกษาผู้เชี่ยวชาญด้านสุขภาพ',
    symptoms:['HRV < 20 ms เรื้อรัง','ANXIETY state ซ้ำ ≥ 3 ครั้ง','HR และ RR สูงต่อเนื่อง'],
    suggestedActions:['ปรึกษาผู้เชี่ยวชาญด้านสุขภาพจิต','ประเมิน GAD-7 และ PHQ-9 เพื่อ Screening','พิจารณา Cognitive Behavioral Therapy (CBT) และ HRV Biofeedback'],
    references:[{author:'Thayer & Lane',year:2000,title:'A model of neurovisceral integration in emotion regulation',source:'Journal of Affective Disorders, 61(3), 201–216'},{author:'Kim et al.',year:2018,title:'Stress detection using wearable sensors and machine learning',source:'MDPI Sensors, 18(12), 4139'}]},

  'BURNOUT_RISK':{ refCode:'Z73.0', label:'ความเสี่ยงภาวะหมดไฟ (Burnout Risk)', severity:'warning',
    trigger:(bio,bands,state,history)=>{const n=(history||[]).filter(h=>['STRESS','FRUSTRATION','ANXIETY'].includes(h)).length;return bio.hrv<AT.HRV_STRESS&&n>=5;},
    description:'HRV ต่ำเรื้อรัง ร่วมกับสภาวะเชิงลบสะสม ≥ 5 ครั้ง บ่งชี้ Occupational Burnout ระยะเริ่มต้น (Z73.0) ต้องการ Preventive Intervention',
    symptoms:['HRV ต่ำเรื้อรัง','สลับระหว่าง Stress, Frustration, Fatigue','ไม่พบ Positive States'],
    suggestedActions:['ลดภาระงาน (Workload Reduction) ทันที','ประเมิน Maslach Burnout Inventory (MBI)','ให้ความสำคัญกับ Sleep Hygiene, Physical Activity, Social Support','ปรึกษา Occupational Health Physician'],
    references:[{author:'Harrison & Horne',year:2000,title:'The impact of sleep deprivation on decision making',source:'Journal of Experimental Psychology: Applied, 6(3), 236–249'},{author:'Shaffer & Ginsberg',year:2017,title:'An overview of heart rate variability metrics and norms',source:'Frontiers in Public Health, 5, 258'}]},

  'CHRONIC_STRESS':{ refCode:'F43.0', label:'รูปแบบความเครียดเรื้อรัง (Chronic Stress Pattern)', severity:'warning',
    trigger:(bio,bands,state,history)=>{const c=(history||[]).filter(h=>h==='STRESS').length;return bio.hrv<25&&c>=4;},
    description:'STRESS state ซ้ำ ≥ 4 ครั้ง ร่วมกับ HRV < 25 ms เรื้อรัง บ่งชี้ Chronic Stress (F43.0) อาจส่งผลต่อสุขภาวะในระยะยาว',
    symptoms:['HRV < 25 ms เรื้อรัง','STRESS state ซ้ำ ≥ 4 ครั้ง'],
    suggestedActions:['ประเมินปัจจัยความเครียดในชีวิตประจำวัน (Stressor Assessment)','ตรวจสุขภาพทั่วไป: BP, Lipid Profile, FBS','แนะนำ Stress Management และพิจารณา Psychotherapy (CBT)'],
    references:[{author:'Healey & Picard',year:2005,title:'Detecting stress during real-world driving tasks using physiological sensors',source:'IEEE Transactions on Intelligent Transportation Systems, 6(2), 156–166'},{author:'Kim et al.',year:2018,title:'Stress detection using wearable sensors and machine learning',source:'MDPI Sensors, 18(12), 4139'}]},

  'HIGH_COGNITIVE_LOAD':{ refCode:null, label:'ภาระการประมวลผลสมองสูง (High Cognitive Load)', severity:'warning',
    trigger:(bio,bands)=>bands&&bands.thetaAlphaRatio>AT.THETA_ALPHA_HIGH,
    description:'θ/α ratio > 2.5 — Theta dominant เหนือ Alpha บ่งชี้ Working Memory ใกล้เต็มขีดความสามารถ (Capacity Overload)',
    symptoms:['θ/α ratio > 2.5','Theta dominant','Alpha suppressed'],
    suggestedActions:['ลดปริมาณงานที่ต้องประมวลผลพร้อมกัน','ให้พักสมอง 5 นาทีก่อนดำเนินต่อ','ใช้ Task Chunking เพื่อลด Cognitive Load'],
    references:[{author:'Klimesch, W.',year:2018,title:'The frequency architecture of brain and brain body oscillations',source:'European Journal of Neuroscience, 48(7), 2431–2452'},{author:'Sweller, J.',year:1988,title:'Cognitive load during problem solving',source:'Cognitive Science, 12(2), 257–285'}]},

  'SEMANTIC_INCONGRUITY':{ refCode:null, label:'ความไม่สอดคล้องทางการรับรู้ (N400 — Cognitive Incongruity)', severity:'mild',
    trigger:(bio,bands)=>bands&&bands.p300&&bands.p300.amplitude>AT.N400_VETO,
    description:'N400 > 4 µV — EEG บ่งชี้ Semantic Mismatch response อาจเกี่ยวข้องกับ Cognitive Processing ผิดปกติ',
    symptoms:['N400 ERP > 4 µV','Semantic Mismatch response'],
    suggestedActions:['ประเมินการรับรู้และการประมวลผลข้อมูล','หากพบร่วมกับอาการสับสน: ประเมิน Cognitive Function (MMSE / MoCA)'],
    references:[{author:'Kutas & Federmeier',year:2011,title:'Thirty years and counting: Finding meaning in the N400 component',source:'Annual Review of Psychology, 62, 621–647'}]},
};

const CRITICAL_ALERTS = [
  { id:'AT.HRV.LOW',    label:'🔒 HRV วิกฤติ — หยุดทันที',
    check:(bio)=>bio.hrv!==undefined&&bio.hrv<AT.HRV_LOW,
    message:`HRV RMSSD = {hrv} ms — ต่ำกว่าเกณฑ์วิกฤติ AT.HRV.LOW (${AT.HRV_LOW} ms) 🔒 Safety Lock`,
    action:'หยุดกิจกรรมทันที — ห้าม override', severity:'critical', ref:'Task Force ESC/NASPE (1996); Thayer & Lane (2000)' },
  { id:'AT.RESP.APNEA', label:'🔒 ภาวะหยุดหายใจ — ฉุกเฉิน (Respiratory Emergency)',
    check:(bio)=>bio.rr!==undefined&&bio.rr<AT.RESP_APNEA,
    message:`RR = {rr} ครั้ง/นาที — ต่ำกว่าเกณฑ์ AT.RESP.APNEA (${AT.RESP_APNEA} ครั้ง/นาที) 🔒 Safety Lock`,
    action:'หยุดระบบทันที แจ้งทีมฉุกเฉิน (Seek Emergency Help)', severity:'critical', ref:'AASM (2012); Berntson et al. (1994)' },
  { id:'AT.HR.EXTREME',  label:'⚠️ ภาวะหัวใจเต้นเร็วรุนแรง (Extreme Tachycardia)',
    check:(bio)=>bio.hr!==undefined&&bio.hr>AT.HR_EXTREME,
    message:`HR = {hr} ครั้ง/นาที — สูงกว่าเกณฑ์วิกฤติ ${AT.HR_EXTREME} ครั้ง/นาที`,
    action:'หยุดกิจกรรม ประเมิน ความเสถียรของร่างกาย ทำ 12-lead ECG', severity:'critical', ref:'Malik et al. (2019)' },
  { id:'AT.GSR.EXTREME', label:'⚠️ ภาวะความตื่นตัวสูงวิกฤติ (Extreme Sympathetic Arousal)',
    check:(bio)=>bio.gsr!==undefined&&bio.gsr>AT.GSR_EXTREME,
    message:`GSR = {gsr} µS — สูงกว่าเกณฑ์วิกฤติ ${AT.GSR_EXTREME} µS`,
    action:'ลดสิ่งกระตุ้น (Stimulus Reduction) ทันที ให้พักในที่เย็น', severity:'warning', ref:'Critchley (2002); Boucsein (2012)' },
];

const _checkSignalAnomalies=(bio,bands)=>{
  const a=[];
  if(bio.hrv!==undefined){
    if(bio.hrv<AT.HRV_LOW)        a.push({signal:'HRV',value:bio.hrv,unit:'ms',status:'critical',note:`วิกฤติ < ${AT.HRV_LOW} ms 🔒`});
    else if(bio.hrv<AT.HRV_STRESS)a.push({signal:'HRV',value:bio.hrv,unit:'ms',status:'warning', note:`ต่ำ < ${AT.HRV_STRESS} ms — Stress Zone`});
    else if(bio.hrv>AT.HRV_READY) a.push({signal:'HRV',value:bio.hrv,unit:'ms',status:'good',    note:`ดี > ${AT.HRV_READY} ms — Optimal/Calm`});
  }
  if(bio.hr!==undefined){
    if(bio.hr>AT.HR_EXTREME)      a.push({signal:'HR',value:bio.hr,unit:'ครั้ง/นาที',status:'critical',note:`วิกฤติ > ${AT.HR_EXTREME} — Extreme Tachycardia`});
    else if(bio.hr>AT.HR_TACHY)   a.push({signal:'HR',value:bio.hr,unit:'ครั้ง/นาที',status:'warning', note:`สูง > ${AT.HR_TACHY} — Tachycardia`});
    else if(bio.hr<AT.HR_BRADY)   a.push({signal:'HR',value:bio.hr,unit:'ครั้ง/นาที',status:'warning', note:`ต่ำ < ${AT.HR_BRADY} — Bradycardia`});
  }
  if(bio.gsr!==undefined){
    if(bio.gsr>AT.GSR_EXTREME)    a.push({signal:'GSR/EDA',value:bio.gsr,unit:'µS',status:'critical',note:`วิกฤติ > ${AT.GSR_EXTREME} µS — Extreme Arousal`});
    else if(bio.gsr>AT.GSR_HIGH)  a.push({signal:'GSR/EDA',value:bio.gsr,unit:'µS',status:'warning', note:`สูง > ${AT.GSR_HIGH} µS — High Sympathetic Arousal`});
    else if(bio.gsr<AT.GSR_LOW)   a.push({signal:'GSR/EDA',value:bio.gsr,unit:'µS',status:'warning', note:`ต่ำมาก < ${AT.GSR_LOW} µS — ตรวจสอบ Sensor / Anhidrosis`});
  }
  if(bio.rr!==undefined){
    if(bio.rr<AT.RESP_APNEA)      a.push({signal:'RR',value:bio.rr,unit:'ครั้ง/นาที',status:'critical',note:`วิกฤติ < ${AT.RESP_APNEA} 🔒 Apnea Risk`});
    else if(bio.rr>AT.RESP_HIGH)  a.push({signal:'RR',value:bio.rr,unit:'ครั้ง/นาที',status:'warning', note:`สูง > ${AT.RESP_HIGH} — Hyperventilation`});
  }
  if(bands&&bands.thetaAlphaRatio>AT.THETA_ALPHA_HIGH)
    a.push({signal:'θ/α ratio (EEG)',value:+bands.thetaAlphaRatio.toFixed(2),unit:'',status:'warning',note:`สูง > ${AT.THETA_ALPHA_HIGH} — High Cognitive Load`});
  return a;
};

const _calcConfidence=(bio,state)=>{
  const ref=PS_DB[state];if(!ref||!bio)return 0.5;
  const pe=ref.physioExpect;let score=0,checks=0;
  const inRange=(val,lo,hi)=>val>=lo&&val<=hi?1:Math.max(0,1-Math.abs(val<lo?lo-val:val-hi)/(hi-lo));
  if(bio.hrv!==undefined&&pe.hrv){score+=inRange(bio.hrv,pe.hrv[0],pe.hrv[1]);checks++;}
  if(bio.hr !==undefined&&pe.hr) {score+=inRange(bio.hr, pe.hr[0], pe.hr[1]); checks++;}
  if(bio.gsr!==undefined&&pe.gsr){score+=inRange(bio.gsr,pe.gsr[0],pe.gsr[1]);checks++;}
  if(bio.rr !==undefined&&pe.rr) {score+=inRange(bio.rr, pe.rr[0], pe.rr[1]); checks++;}
  return checks>0?Math.round((score/checks)*100)/100:0.5;
};
const _arr = (v) => Array.isArray(v) ? v : [];
const _obj = (v) => (v && typeof v === 'object') ? v : null;

const assess=(input={})=>{
  // รับ adaptiveAT จาก NuengdeawBaseline.getAdaptiveAT() (optional)
  // ถ้าไม่ส่งมา หรือยังไม่ calibrate → ใช้ AT_STATIC เดิม
  const {
    bio: rawBio = {},
    bands: rawBands = null,
    state = 'NEUTRAL',
    history: rawHistory = [],
    sessionSec = 0,
    adaptiveAT = null,
  } = (input && typeof input === 'object') ? input : {};
  const bio = (rawBio && typeof rawBio === 'object') ? rawBio : {};
  const bands = (rawBands && typeof rawBands === 'object') ? rawBands : null;
  const history = Array.isArray(rawHistory) ? rawHistory : [];
  _resolveAT(adaptiveAT);
  const ts=Date.now();

  const criticalAlerts=[];
  for(const alert of CRITICAL_ALERTS){
    if(alert.check(bio)){
      const msg=alert.message.replace('{hrv}',bio.hrv).replace('{hr}',bio.hr).replace('{rr}',bio.rr).replace('{gsr}',bio.gsr);
      criticalAlerts.push({id:alert.id,label:alert.label,message:msg,action:alert.action,severity:alert.severity,ref:alert.ref});
    }
  }
  if(sessionSec>AT.SESSION_MAX){
    criticalAlerts.push({id:'AT.SESSION.MAX',label:'⏱️ เกินขีดจำกัด Session (Session Limit Exceeded)',message:`Session = ${Math.round(sessionSec/60)} นาที — เกิน ${AT.SESSION_MAX/60} ชั่วโมง 🔒`,action:'หยุดพักทันที — ความล้าสะสมสูง (Cumulative Fatigue)',severity:'warning',ref:'Harrison & Horne (2000)'});
  }

  const normalizedState=state?.toUpperCase()||'NEUTRAL';
  const psInfo=PS_DB[normalizedState]||PS_DB['NEUTRAL'];
  const confidence=_calcConfidence(bio,normalizedState);
  const anomalies=_checkSignalAnomalies(bio,bands);

  const wellnessObservations=[];
  for(const[key,cond]of Object.entries(WELLNESS_DB)){
    try{if(cond.trigger(bio,bands,normalizedState,history))wellnessObservations.push({id:key,refCode:cond.refCode,label:cond.label,severity:cond.severity,description:cond.description,symptoms:cond.symptoms,suggestedActions:cond.suggestedActions,references:cond.references});}
    catch(_){}
  }
  const safeObs = _arr(wellnessObservations).map(o => ({
    ...o,
    suggestedActions: _arr(o?.suggestedActions).filter(Boolean),
    references: _arr(o?.references).filter(r => _obj(r) && r.title),
  }));
  const safePsActions = _arr(psInfo?.suggestedActions).filter(Boolean);
  const safePsRefs = _arr(psInfo?.references).filter(r => _obj(r) && r.title);

  const allSev=[...criticalAlerts.map(a=>a.severity),psInfo.severity,...safeObs.map(m=>m.severity)];
  const rank={critical:4,warning:3,mild:2,neutral:1,normal:1,positive:0};
  const topSeverity=allSev.reduce((best,s)=>(rank[s]||0)>(rank[best]||0)?s:best,'normal');

  return{
    version:'1.0.0', engine:'NuengdeawWellnessCore', timestamp:ts, sessionSec,
    state:{code:psInfo.psCode,name:normalizedState,label:psInfo.label,labelTH:psInfo.labelTH,emoji:psInfo.emoji,severity:psInfo.severity,description:psInfo.description,action:psInfo.action,actionDesc:psInfo.actionDesc,confidence,isAmbiguous:confidence<AT.CONFIDENCE_MIN},
    signals:{hrv:bio.hrv,hr:bio.hr,gsr:bio.gsr,rr:bio.rr,eeg:bio.eeg,bands:bands?{theta:bands.theta,alpha:bands.alpha,beta:bands.beta,gamma:bands.gamma,thetaAlphaRatio:bands.thetaAlphaRatio,iaf:bands.iaf,microstate:bands.microstate}:null},
    anomalies, criticalAlerts, hasCritical:criticalAlerts.length>0, wellnessObservations:safeObs, hasObservations:safeObs.length>0,
    suggestedActions:[...safePsActions,...safeObs.flatMap(m=>m.suggestedActions)],
    references:Object.values([...safePsRefs,...safeObs.flatMap(m=>m.references)].reduce((acc,r)=>{acc[r.title]=r;return acc;},{})),
    overallSeverity:topSeverity,
    summary:criticalAlerts.length>0?`⚠️ พบ ${criticalAlerts.length} Critical Alert — แนะนำขอความช่วยเหลือทันที`:`${psInfo.emoji} ${psInfo.labelTH} — Confidence ${Math.round(confidence*100)}%`,
  };
};

const _clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const _toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const _riskFromSeverity = (severity, hasCritical, obsCount = 0) => {
  const m = { critical:0.9, warning:0.7, mild:0.55, neutral:0.45, normal:0.35, positive:0.2 };
  let risk = m[severity] ?? 0.45;
  if (hasCritical) risk = Math.max(risk, 0.95);
  risk += Math.min(0.2, Math.max(0, obsCount) * 0.03);
  return _clamp01(risk);
};

const toUnifiedPacket = (payload = {}) => {
  const result = payload.result || {};
  const bio = payload.bio || {};
  const bands = payload.bands || {};
  const mode = payload.sourceMode || 'sim';
  const ts = result.timestamp || Date.now();
  const tick = Number.isFinite(payload.tick) ? payload.tick : Date.now();
  const risk = _riskFromSeverity(result.overallSeverity, !!result.hasCritical, (result.wellnessObservations || []).length);
  const wellbeing = _clamp01(1 - risk);
  const stateName = String(result.state?.name || payload.state || 'NEUTRAL').toUpperCase();
  const confidence = _clamp01(result.state?.confidence ?? payload.confidence ?? 0.5);
  const action = String(result.state?.action || 'ACT.MAINTAIN');

  return {
    schema_version: '1.0.0',
    packet_type: 'unified_state_packet',
    ts_iso: new Date(ts).toISOString(),
    gen: 3,
    tick,
    state: stateName,
    confidence,
    risk,
    wellbeing,
    signals: {
      hrv: _toNum(bio.hrv, _toNum(result.signals?.hrv, 0)),
      hr: _toNum(bio.hr, _toNum(result.signals?.hr, 0)),
      gsr: _toNum(bio.gsr, _toNum(result.signals?.gsr, 0)),
      rr: _toNum(bio.rr, _toNum(result.signals?.rr, 0)),
      eeg: _toNum(bio.eeg, _toNum(result.signals?.eeg, 0)),
      bands: {
        theta: _toNum(bands.theta, _toNum(result.signals?.bands?.theta, 0)),
        alpha: _toNum(bands.alpha, _toNum(result.signals?.bands?.alpha, 0)),
        beta: _toNum(bands.beta, _toNum(result.signals?.bands?.beta, 0)),
        gamma: _toNum(bands.gamma, _toNum(result.signals?.bands?.gamma, 0)),
        thetaAlphaRatio: _toNum(
          bands.thetaAlphaRatio,
          _toNum(result.signals?.bands?.thetaAlphaRatio, 0)
        ),
      },
    },
    behavior: {
      dwellScore: _toNum(payload.behavior?.dwellScore, 0),
      scrollScore: _toNum(payload.behavior?.scrollScore, 0),
      backScore: _toNum(payload.behavior?.backScore, 0),
    },
    actions: {
      recommended_action: action,
      adaptation: {
        pacing: risk >= 0.7 ? 'slow' : risk <= 0.35 ? 'fast' : 'normal',
        hint_level: risk >= 0.7 ? 'high' : risk <= 0.35 ? 'low' : 'medium',
        summarize: risk >= 0.6,
        break_prompt: risk >= 0.75 || !!result.hasCritical,
      },
    },
    core_meta: {
      source_mode: mode === 'wearable' ? 'wearable' : 'simulator',
      severity: String(result.overallSeverity || 'normal'),
      critical_count: Array.isArray(result.criticalAlerts) ? result.criticalAlerts.length : 0,
      engine: 'NuengdeawWellnessCore',
    },
  };
};

const persistUnifiedPacket = async (packet, context = {}) => {
  if (!packet || typeof packet !== 'object') return { ok:false, error:'invalid_packet' };
  const db = (typeof window !== 'undefined' && window.NuengdeawDB) ? window.NuengdeawDB : null;
  if (!db) return { ok:false, error:'NuengdeawDB_not_loaded' };

  try {
    const ts = Date.parse(packet.ts_iso) || Date.now();
    const ratio = _toNum(packet.signals?.bands?.thetaAlphaRatio, 0);
    const sourceMode = packet.core_meta?.source_mode || context.sourceMode || 'simulator';
    let writeSessionResult = null;

    const core = (typeof window !== 'undefined' && window.NuengdeawCore) ? window.NuengdeawCore : null;
    if (core && typeof core.ingestExternalSession === 'function') {
      const coreRes = core.ingestExternalSession({
        ts,
        state: packet.state,
        cogLoad: _clamp01(ratio / 3),
        hr: _toNum(packet.signals?.hr, 0),
        hrv: _toNum(packet.signals?.hrv, 0),
        gsr: _toNum(packet.signals?.gsr, 0),
        wellbeing: _toNum(packet.wellbeing, 0),
        risk: _toNum(packet.risk, 0),
        sourceMode,
      });
      writeSessionResult = coreRes;
      if (!coreRes?.success) {
        return { ok:false, error: coreRes?.error || 'core_ingest_failed', writeSessionResult: coreRes };
      }
    } else {
      writeSessionResult = db.writeSession({
        ts,
        state: packet.state,
        cogLoad: _clamp01(ratio / 3),
        hr: _toNum(packet.signals?.hr, 0),
        hrv: _toNum(packet.signals?.hrv, 0),
        gsr: _toNum(packet.signals?.gsr, 0),
        wellbeing: _toNum(packet.wellbeing, 0),
        risk: _toNum(packet.risk, 0),
        sourceMode,
      });
      db.writeEvent({
        ts,
        type: 'gen3_unified_packet',
        state: packet.state,
        risk: packet.risk,
        details: {
          recommendedAction: packet.actions?.recommended_action || null,
        },
      });
    }
    if (typeof db.writeSemanticSnapshot === 'function') {
      await db.writeSemanticSnapshot({
        latestPacket: packet,
        latestWellnessSummary: context.result?.summary || null,
      });
    }
    return { ok:true, writeSessionResult };
  } catch (err) {
    return { ok:false, error: err.message || String(err) };
  }
};

// AT_STATIC: ค่า threshold คงที่ดั้งเดิม (เผยแพร่เพื่อให้ NuengdeawBaseline อ้างอิง)
// AT: ค่าปัจจุบัน (dynamic — ถูก override ใน assess() ต่อ call)
const NuengdeawWellnessCore={
  assess,
  toUnifiedPacket,
  persistUnifiedPacket,
  PS_DB,
  WELLNESS_DB,
  CRITICAL_ALERTS,
  AT:AT_STATIC,
  version:'1.1.0',
};

if(typeof module!=='undefined'&&module.exports)module.exports=NuengdeawWellnessCore;
else if(typeof window!=='undefined')window.NuengdeawWellnessCore=NuengdeawWellnessCore;
