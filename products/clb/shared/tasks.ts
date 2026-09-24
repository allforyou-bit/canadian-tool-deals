// Practice task catalogue: 2 writing + 8 speaking task types modelled on the *formats* of
// Canadian general English tests (memo §1.1). All prompts below are written for this product —
// nothing is copied from any official test. Timings are this product's practice defaults, not a
// claim about any official test.

export type TaskKind = 'writing' | 'speaking'

export interface Bi {
  en: string
  ko: string
}

export interface TaskType {
  id: string
  kind: TaskKind
  title: Bi
  /** what the learner must do, in plain words */
  instructions: Bi
  /** writing: target word range; speaking: target seconds */
  target: { minWords?: number; maxWords?: number; prepSeconds?: number; speakSeconds?: number }
  /** practice timer default in seconds (writing) */
  timerSeconds?: number
  /** feedback criteria (descriptive, not an official rubric) */
  criteria: Bi[]
  prompts: Bi[]
}

const WRITING_CRITERIA: Bi[] = [
  { en: 'Content and task completion', ko: '내용과 과제 수행' },
  { en: 'Organisation and coherence', ko: '구성과 흐름' },
  { en: 'Vocabulary range and precision', ko: '어휘의 다양성과 정확성' },
  { en: 'Grammar and readability', ko: '문법과 가독성' },
]

const SPEAKING_CRITERIA: Bi[] = [
  { en: 'Content and task completion', ko: '내용과 과제 수행' },
  { en: 'Organisation and coherence', ko: '구성과 흐름' },
  { en: 'Vocabulary range and precision', ko: '어휘의 다양성과 정확성' },
  { en: 'Grammar (from the transcript)', ko: '문법(받아쓴 내용 기준)' },
]

export const TASKS: TaskType[] = [
  {
    id: 'email',
    kind: 'writing',
    title: { en: 'Writing an email', ko: '이메일 쓰기' },
    instructions: {
      en: 'Read the situation and write an email that covers every point. Choose a tone that fits the reader.',
      ko: '상황을 읽고 모든 요점을 다루는 이메일을 쓰세요. 받는 사람에게 맞는 어조를 고르세요.',
    },
    target: { minWords: 150, maxWords: 200 },
    timerSeconds: 27 * 60,
    criteria: WRITING_CRITERIA,
    prompts: [
      {
        en: 'Your neighbour has been parking in front of your driveway several times a week. Write an email to your neighbour. In your email: describe the problem, explain how it affects you, and suggest a solution.',
        ko: '이웃이 일주일에 여러 번 우리 집 진입로 앞에 주차합니다. 이웃에게 이메일을 쓰세요. 문제를 설명하고, 나에게 주는 영향을 설명하고, 해결책을 제안하세요.',
      },
      {
        en: 'You recently took an evening course at a community centre and it was cancelled halfway through. Write an email to the centre manager. In your email: explain what happened, say how you felt, and ask for a specific kind of compensation.',
        ko: '최근 커뮤니티 센터의 저녁 강좌를 듣다가 중간에 강좌가 취소되었습니다. 센터 관리자에게 이메일을 쓰세요. 무슨 일이 있었는지, 어떤 기분이었는지 설명하고, 구체적인 보상을 요청하세요.',
      },
      {
        en: 'A coworker helped you finish an important project while you were sick. Write an email to your coworker. In your email: thank them, describe how their help made a difference, and offer to do something for them.',
        ko: '아팠을 때 동료가 중요한 프로젝트를 끝내도록 도와주었습니다. 동료에게 이메일을 쓰세요. 감사를 전하고, 도움이 어떤 차이를 만들었는지 설명하고, 보답을 제안하세요.',
      },
    ],
  },
  {
    id: 'survey',
    kind: 'writing',
    title: { en: 'Responding to survey questions', ko: '설문에 답하기' },
    instructions: {
      en: 'Read the survey question, choose one option, and explain your choice with clear reasons and examples.',
      ko: '설문 질문을 읽고 한 가지를 선택한 뒤, 분명한 이유와 예시로 선택을 설명하세요.',
    },
    target: { minWords: 150, maxWords: 200 },
    timerSeconds: 26 * 60,
    criteria: WRITING_CRITERIA,
    prompts: [
      {
        en: 'Your city has money for one project next year. Which should it choose? Option A: more bike lanes downtown. Option B: longer opening hours at public libraries. Choose one and explain why.',
        ko: '시에서 내년에 한 가지 사업에만 예산을 쓸 수 있습니다. 어느 것을 골라야 할까요? A: 도심 자전거 도로 확대. B: 공공 도서관 운영 시간 연장. 하나를 골라 이유를 설명하세요.',
      },
      {
        en: 'Your workplace is considering a new schedule. Option A: four 10-hour days a week. Option B: five 8-hour days with flexible start times. Choose one and explain why.',
        ko: '직장에서 새 근무 일정을 검토하고 있습니다. A: 주 4일, 하루 10시간. B: 주 5일, 하루 8시간에 출근 시간 자율. 하나를 골라 이유를 설명하세요.',
      },
    ],
  },
  ...speaking('advice', { en: 'Giving advice', ko: '조언하기' }, 30, 90, {
    en: 'Give practical advice to the person in the situation. Offer at least two suggestions and explain them.',
    ko: '상황 속 사람에게 실용적인 조언을 하세요. 제안을 두 가지 이상 하고 설명하세요.',
  }, [
    { en: 'A friend is moving to Canada next month and is worried about finding a job. What advice would you give?', ko: '다음 달 캐나다로 오는 친구가 일자리 구하는 것을 걱정합니다. 어떤 조언을 하겠어요?' },
    { en: 'Your cousin wants to save money but spends too much on eating out. Advise your cousin.', ko: '사촌이 돈을 모으고 싶지만 외식비가 너무 많이 나옵니다. 조언해 주세요.' },
  ]),
  ...speaking('experience', { en: 'Talking about a personal experience', ko: '개인 경험 말하기' }, 30, 60, {
    en: 'Describe a past experience in detail: what happened, when, who was involved, and how you felt.',
    ko: '과거 경험을 자세히 설명하세요. 무슨 일이, 언제, 누구와 있었고, 어떤 기분이었는지 말하세요.',
  }, [
    { en: 'Talk about a time you had to learn something new very quickly.', ko: '새로운 것을 아주 빨리 배워야 했던 때를 이야기하세요.' },
    { en: 'Talk about a time a stranger helped you.', ko: '모르는 사람이 도와주었던 때를 이야기하세요.' },
  ]),
  ...speaking('scene', { en: 'Describing a scene', ko: '장면 묘사하기' }, 30, 60, {
    en: 'Describe the scene in the text as if the listener cannot see it: people, places, actions and details.',
    ko: '듣는 사람이 장면을 볼 수 없다고 생각하고 설명하세요. 사람, 장소, 행동, 세부 사항을 말하세요.',
  }, [
    { en: 'A busy farmers’ market on a sunny Saturday morning: vendors, shoppers, a musician, children and a dog.', ko: '맑은 토요일 아침의 붐비는 농산물 시장: 상인, 손님, 음악가, 아이들, 개.' },
    { en: 'A bus stop during a snowstorm: people waiting, a late bus, a person shovelling, cars moving slowly.', ko: '눈보라 속 버스 정류장: 기다리는 사람들, 늦은 버스, 눈 치우는 사람, 천천히 가는 차들.' },
  ]),
  ...speaking('predictions', { en: 'Making predictions', ko: '예측하기' }, 30, 60, {
    en: 'Say what you think will happen next in the situation and why.',
    ko: '상황에서 다음에 무슨 일이 일어날지, 왜 그렇게 생각하는지 말하세요.',
  }, [
    { en: 'The farmers’ market scene: a sudden rain cloud appears. What will probably happen in the next few minutes?', ko: '농산물 시장 장면에 갑자기 비구름이 나타났습니다. 몇 분 뒤에 무슨 일이 일어날까요?' },
    { en: 'The bus stop scene: the bus finally arrives but it is almost full. What will probably happen next?', ko: '버스 정류장 장면에서 버스가 드디어 왔지만 거의 꽉 찼습니다. 다음에 무슨 일이 일어날까요?' },
  ]),
  ...speaking('compare', { en: 'Comparing and persuading', ko: '비교하고 설득하기' }, 60, 60, {
    en: 'Choose one of two options and persuade the listener that it is the better choice, comparing both.',
    ko: '두 가지 중 하나를 골라, 둘을 비교하며 그것이 더 나은 선택이라고 설득하세요.',
  }, [
    { en: 'Your family must choose a car: a small used hybrid or a larger new SUV. Persuade your family.', ko: '가족이 차를 골라야 합니다. 작은 중고 하이브리드와 큰 새 SUV 중 하나를 골라 가족을 설득하세요.' },
    { en: 'Your team is choosing a place for a year-end party: a restaurant downtown or a potluck in the office. Persuade your manager.', ko: '팀 연말 모임 장소를 정합니다. 시내 식당과 사무실 포틀럭 중 하나를 골라 관리자를 설득하세요.' },
  ]),
  ...speaking('difficult', { en: 'Dealing with a difficult situation', ko: '곤란한 상황 대처하기' }, 60, 60, {
    en: 'Choose how to handle a difficult situation and explain your choice politely to the person involved.',
    ko: '곤란한 상황을 어떻게 처리할지 정하고, 관련된 사람에게 예의 있게 설명하세요.',
  }, [
    { en: 'You promised to help a friend move on Saturday, but your manager asks you to work that day. Talk to either your friend or your manager.', ko: '토요일에 친구 이사를 돕기로 했는데 관리자가 그날 근무를 부탁합니다. 친구나 관리자 중 한 명에게 말하세요.' },
    { en: 'Your roommate often has loud guests late at night before your early shifts. Talk to your roommate.', ko: '룸메이트가 이른 출근 전날 밤마다 시끄러운 손님을 부릅니다. 룸메이트에게 말하세요.' },
  ]),
  ...speaking('opinions', { en: 'Expressing opinions', ko: '의견 말하기' }, 30, 90, {
    en: 'Give your opinion on the question and support it with reasons and examples.',
    ko: '질문에 대한 의견을 말하고 이유와 예시로 뒷받침하세요.',
  }, [
    { en: 'Should high school students be required to do volunteer work? Give your opinion.', ko: '고등학생에게 봉사활동을 의무로 해야 할까요? 의견을 말하세요.' },
    { en: 'Is it better to live close to work in a small apartment or far from work in a bigger house?', ko: '직장 가까운 작은 아파트와 직장에서 먼 큰 집 중 어느 쪽이 나을까요?' },
  ]),
  ...speaking('unusual', { en: 'Describing an unusual situation', ko: '특이한 상황 설명하기' }, 30, 60, {
    en: 'Describe something unusual to someone who cannot see it, clearly enough that they could picture or find it.',
    ko: '볼 수 없는 사람에게 특이한 물건이나 상황을, 떠올리거나 찾을 수 있을 만큼 분명하게 설명하세요.',
  }, [
    { en: 'You found a strange tool in a new apartment. Describe it to the landlord on the phone.', ko: '새 아파트에서 이상한 도구를 발견했습니다. 전화로 집주인에게 설명하세요.' },
    { en: 'You saw an unusual sculpture in a park. Describe it to a friend who wants to find it.', ko: '공원에서 특이한 조각상을 봤습니다. 그것을 찾아가고 싶은 친구에게 설명하세요.' },
  ]),
]

function speaking(id: string, title: Bi, prepSeconds: number, speakSeconds: number, instructions: Bi, prompts: Bi[]): TaskType[] {
  return [{ id, kind: 'speaking', title, instructions, target: { prepSeconds, speakSeconds }, criteria: SPEAKING_CRITERIA, prompts }]
}

export const WRITING_TASKS = TASKS.filter((t) => t.kind === 'writing')
export const SPEAKING_TASKS = TASKS.filter((t) => t.kind === 'speaking')
export const taskById = (id: string) => TASKS.find((t) => t.id === id)
