export const HAENYEO_IMAGES = {
  seaHeritage: '/src/assets/images/jeju_haenyeo_sea_1795078595175.jpg',
  taewakGear: '/src/assets/images/haenyeo_taewak_gear_1795078597082.jpg',
  seafoodHarvest: '/src/assets/images/jeju_seafood_harvest_1795078603136.jpg',
  bulteokHarbor: '/src/assets/images/jeju_haenyeo_harbor_1795078595869.jpg',
} as const;

export interface HeritageFact {
  value: string;
  label: string;
  detail: string;
}

export const HERITAGE_FACTS: HeritageFact[] = [
  {
    value: '2016.11.30',
    label: '유네스코 인류무형문화유산',
    detail: '제주해녀문화 등재 완료',
  },
  {
    value: '10 ~ 20m',
    label: '무호흡 맨몸 잠수',
    detail: '산소통 없이 1~2분간 물질',
  },
  {
    value: '102개 어촌계',
    label: '제주 연안 해녀 공동체',
    detail: '현역 해녀 약 3,200여 명 활동',
  },
  {
    value: '7 ~ 8월',
    label: '자율 금어기 준수',
    detail: '소라·전복 번식기 바다 휴식',
  },
];

export interface HeritagePillar {
  index: string;
  title: string;
  subtitle: string;
  description: string;
}

export const HERITAGE_PILLARS: HeritagePillar[] = [
  {
    index: '01',
    title: '숨비소리 — 생명의 휘파람',
    subtitle: 'Sumbisori · 호흡의 기술',
    description:
      '깊은 바닷속에서 1~2분간 숨을 참고 해산물을 채취한 해녀가 수면 위로 떠올라 참았던 숨을 한꺼번에 내뿜을 때 나는 맑고 긴 휘파람 소리입니다. 이산화탄소를 빠르게 배출하고 다시 잠수할 산소를 채우는 지혜이자, 제주 바다의 살아 있는 소리입니다.',
  },
  {
    index: '02',
    title: '불턱과 상군·중군·하군',
    subtitle: 'Bulteok · 공동체와 배려의 위계',
    description:
      '바닷가 현무암 돌담으로 바람을 막고 장작불을 피워 언 몸을 녹이던 불턱은 해녀들의 쉼터이자 학교였습니다. 기량에 따라 상군·중군·하군으로 나뉘어 깊은 바다는 상군이 맡고, 얕은 바다는 초보와 고령 해녀에게 양보하며 공동체의 안전을 지킵니다.',
  },
  {
    index: '03',
    title: '물숨을 경계하는 지속 가능한 채취',
    subtitle: 'Mulsum · 바다 생태의 규율',
    description:
      '해녀들은 욕심을 내어 숨을 한 모금 더 참다가 마시게 되는 “물숨”을 가장 경계합니다. 정해진 채취 도구만 사용하고, 치어와 어린 소라(7cm 미만)는 다시 바다로 돌려보내며, 어촌계 스스로 금어기와 물질 시간을 엄격히 지켜 제주 바다를 회복시킵니다.',
  },
];

export type EquipmentCategory = 'all' | 'buoy' | 'suit' | 'tool';

export interface HaenyeoEquipment {
  id: string;
  accessionNo: string;
  name: string;
  jejuName: string;
  category: Exclude<EquipmentCategory, 'all'>;
  categoryLabel: string;
  material: string;
  role: string;
  description: string;
  featured?: boolean;
}

export const EQUIPMENT_ITEMS: HaenyeoEquipment[] = [
  {
    id: 'taewak',
    accessionNo: 'JH-01',
    name: '태왁과 망사리',
    jejuName: '제주어 · 테왁 / 망시리',
    category: 'buoy',
    categoryLabel: '부력·채취 도구',
    material: '부표(전통 박 → 현대 스티로폼·방수천), 면·나일론 그물망',
    role: '수면 휴식 부력 지지 · 채취 해산물 보관',
    description:
      '바다 위에서 해녀가 가슴을 기대어 숨을 고르는 가장 중요한 부력구입니다. 아래에 매단 그물망인 망사리에 갓 채취한 소라, 전복, 성게를 담아 바닷물 속에서 신선하게 보관합니다. 주황색 천을 감싸 멀리서도 해녀의 위치를 안전하게 식별할 수 있습니다.',
    featured: true,
  },
  {
    id: 'mulangyeong',
    accessionNo: 'JH-02',
    name: '물안경 (눈)',
    jejuName: '제주어 · 족세눈 / 왕눈',
    category: 'suit',
    categoryLabel: '잠수 복장',
    material: '강화유리 렌즈, 천연고무 프레임, 면 끈',
    role: '수중 시야 확보 · 수압 압력 평형',
    description:
      '1900년대 초 도입되어 해녀의 작업 효율을 크게 높인 도구입니다. 한 알로 된 “왕눈”과 두 알로 된 “족세눈”이 있으며, 바다 밑 현무암 틈에 숨은 전복과 해삼을 또렷하게 살필 수 있게 해 줍니다.',
  },
  {
    id: 'gomuot',
    accessionNo: 'JH-03',
    name: '고무옷과 연철(납벨트)',
    jejuName: '제주어 · 고무옷 / 쇠덩어리',
    category: 'suit',
    categoryLabel: '잠수 복장',
    material: '네오프렌 잠수복, 주조 납 추(3~6kg)',
    role: '저체온증 예방 · 잠수 부력 조절',
    description:
      '과거 무명천으로 만든 “물소중이”에서 1970년대 이후 네오프렌 고무옷으로 바뀌며 겨울철 물질 시간이 늘어났습니다. 잠수복의 강한 부력을 상쇄해 수심 10m 이상까지 부드럽게 내려가기 위해 허리에 납벨트를 두릅니다.',
  },
  {
    id: 'bitchang',
    accessionNo: 'JH-04',
    name: '빗창',
    jejuName: '제주어 · 빗창',
    category: 'tool',
    categoryLabel: '부력·채취 도구',
    material: '단조 무쇠(길이 30~40cm), 손목 끈',
    role: '바위 틈 전복 채취 전용 지렛대',
    description:
      '끝이 납작하고 단단한 쇠막대로, 바위에 강하게 붙어 있는 전복의 껍데기 틈을 재빠르게 밀어 떼어내는 데 사용합니다. 물속에서 놓치지 않도록 손목에 노끈을 묶어 사용합니다.',
  },
  {
    id: 'homi',
    accessionNo: 'JH-05',
    name: '까꾸리와 호미',
    jejuName: '제주어 · 곶쟁이 / 호미',
    category: 'tool',
    categoryLabel: '부력·채취 도구',
    material: '단조 철제 갈고리·낫날, 나무 손잡이',
    role: '소라·문어 포획 · 미역·우뭇가사리 채취',
    description:
      '끝이 구부러진 갈고리 모양의 까꾸리는 바위굴 속 문어나 소라를 끌어낼 때 쓰이며, 작은 낫 형태의 호미는 봄철 미역·톳·우뭇가사리 등 해조류를 뿌리가 상하지 않게 베어낼 때 활용합니다.',
  },
];

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonHarvestRow {
  species: string;
  depth: string;
  rule: string;
  note: string;
}

export interface SeasonGuide {
  id: SeasonId;
  label: string;
  months: string;
  waterTemp: string;
  headline: string;
  summary: string;
  rows: SeasonHarvestRow[];
}

export const SEASON_GUIDES: SeasonGuide[] = [
  {
    id: 'spring',
    label: '봄',
    months: '3월 ~ 5월',
    waterTemp: '14 ~ 18°C',
    headline: '해조류가 풍성하게 자라는 생명력의 바다',
    summary:
      '겨우내 찬 바닷물에서 자란 자연산 미역과 톳, 우뭇가사리가 제철을 맞습니다. 5월 말까지 뿔소라 채취가 활발하며, 맑은 봄 바다에서는 연안 암초 지대 물질이 집중됩니다.',
    rows: [
      {
        species: '자연산 미역 · 톳',
        depth: '2 ~ 6m',
        rule: '포자 번식기 이후 밑동 보존 채취',
        note: '제주 전통 해녀 밥상의 핵심 식재료',
      },
      {
        species: '제주 뿔소라 (구쟁기)',
        depth: '4 ~ 12m',
        rule: '각경 7cm 이상만 채취 (6월 금어기 직전)',
        note: '봄철 살이 단단하고 단맛이 깊음',
      },
      {
        species: '우뭇가사리 (천초)',
        depth: '3 ~ 8m',
        rule: '어촌계 공동 작업일 지정',
        note: '제주 전통 여름 별미 우뭇가사리 냉국 원료',
      },
    ],
  },
  {
    id: 'summer',
    label: '여름',
    months: '6월 ~ 8월',
    waterTemp: '21 ~ 27°C',
    headline: '뿔소라 금어기를 지키고 보말·성게를 만나는 계절',
    summary:
      '제주 해녀들은 뿔소라의 산란기인 여름철(주로 6~8월, 지역별 조정)에 자율 금어기를 지켜 바다를 쉬게 합니다. 대신 여름 제철을 맞은 보라성게와 한치·문어 채취가 이루어집니다.',
    rows: [
      {
        species: '보라성게 (구살)',
        depth: '3 ~ 9m',
        rule: '어촌계 구역별 순환 채취',
        note: '제주 성게미역국과 성게국수의 진한 풍미',
      },
      {
        species: '돌문어',
        depth: '5 ~ 15m',
        rule: '체중 미달 어린 개체 방류',
        note: '까꾸리로 현무암 바위 틈에서 포획',
      },
      {
        species: '뿔소라 (금어기 보호)',
        depth: '전 수심',
        rule: '산란기 채취 전면 중단',
        note: '다음 해 풍어를 위한 해녀 공동체의 약속',
      },
    ],
  },
  {
    id: 'autumn',
    label: '가을',
    months: '9월 ~ 11월',
    waterTemp: '18 ~ 23°C',
    headline: '금어기가 풀리고 뿔소라와 전복이 돌아오는 풍요의 시기',
    summary:
      '여름 동안 충분히 휴식한 바다가 다시 열립니다. 10월부터 본격적인 뿔소라 물질이 재개되며, 시야가 가장 맑아지는 가을 제주 바다에서는 깊은 수심의 자연산 전복 채취가 이어집니다.',
    rows: [
      {
        species: '제주 뿔소라 (햇소라)',
        depth: '5 ~ 13m',
        rule: '각경 7cm 이상 · 일일 어획량 제한',
        note: '가을 해녀 축제와 해안 마을의 대표 수확물',
      },
      {
        species: '자연산 참전복',
        depth: '8 ~ 18m',
        rule: '껍데기 길이 7cm 미만 즉시 방류',
        note: '상군 해녀가 빗창으로 깊은 암반에서 채취',
      },
      {
        species: '홍해삼 (초겨울 진입)',
        depth: '7 ~ 15m',
        rule: '10월 말~11월 중순부터 개방',
        note: '수온이 내려갈수록 육질이 탱탱해짐',
      },
    ],
  },
  {
    id: 'winter',
    label: '겨울',
    months: '12월 ~ 2월',
    waterTemp: '12 ~ 15°C',
    headline: '찬 파도를 이겨내는 강인한 겨울 물질과 불턱의 온기',
    summary:
      '매서운 북서풍과 차가운 수온 속에서도 해녀들은 짧은 물때에 맞춰 홍해삼, 전복, 겨울 소라를 채취합니다. 물질을 마치고 나와 몸을 녹이던 따뜻한 불턱 문화가 가장 깊게 깃든 계절입니다.',
    rows: [
      {
        species: '제주 홍해삼',
        depth: '8 ~ 16m',
        rule: '수온 하강기 한정 채취',
        note: '겨울철 제주 연안의 귀한 보양 해산물',
      },
      {
        species: '겨울 전복 · 오분자기',
        depth: '6 ~ 18m',
        rule: '어린 개체 보호 · 어촌계 출항 기준 준수',
        note: '찬 바다에서 자라 씹는 맛과 향이 뛰어남',
      },
      {
        species: '감태 · 겡이(게)',
        depth: '1 ~ 5m',
        rule: '기상 특보 시 즉시 출어 중단',
        note: '해안가 조간대와 얕은 암초 지대 중심',
      },
    ],
  },
];

export interface VisitSpot {
  name: string;
  region: string;
  hours: string;
  summary: string;
}

export const VISIT_SPOTS: VisitSpot[] = [
  {
    name: '제주 해녀박물관',
    region: '제주시 구좌읍 해녀박물관길 26',
    hours: '09:00 ~ 18:00 · 매주 월요일 휴관',
    summary:
      '해녀의 생활사, 전통 불턱 재현, 물질 도구 원형, 1932년 제주해녀항일운동 기록을 한눈에 볼 수 있는 대표 전시관입니다.',
  },
  {
    name: '법환 좀녀마을 해녀 체험장',
    region: '서귀포시 막숙포로 62',
    hours: '10:00 ~ 16:00 · 사전 예약제 운영',
    summary:
      '현역 해녀와 함께 테왁을 짚고 얕은 제주 바다에 들어가 숨비소리와 물질 기초를 안전하게 배울 수 있는 체험 프로그램입니다.',
  },
  {
    name: '성산일출봉 해녀 물질 공연',
    region: '서귀포시 성산읍 일출로 284-12',
    hours: '매일 14:00 · 기상 악화 시 취소',
    summary:
      '성산일출봉 아래 우뭇개 해안에서 해녀 노래를 부르며 바다로 걸어 들어가 실제 물질을 선보이는 생생한 현장 공연입니다.',
  },
];
