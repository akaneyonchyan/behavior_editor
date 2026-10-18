// 节点类型定义
export const NODE_TYPES = {
  START: 'start',
  MOVE: 'move',
  WAIT: 'wait',
  JUDGE: 'judge',
  RESULT: 'result',
  LOOP: 'loop',
  END: 'end'
}

// 节点类型配置
export const NODE_CONFIG = {
  [NODE_TYPES.START]: {label:'开始',color:'#FB923C',icon:'▶',description:'行为元数据与唯一入口',defaultData:{}},
  [NODE_TYPES.MOVE]: {
    label: '位移',
    color: '#38BDF8',
    icon: '→',
    description: '移动到目标位置',
    defaultData: {
      destination: '',
      destinationType: 'interactObject' // 'interactObject' | 'coordinate'
    }
  },
  [NODE_TYPES.WAIT]: {
    label: '待机',
    color: '#A78BFA',
    icon: '⏸',
    description: '原地稍息表演',
    defaultData: {}
  },
  [NODE_TYPES.JUDGE]: {
    label: '判断',
    color: '#FCD34D',
    icon: '◇',
    description: '根据条件选择分支',
    defaultData: {
      branches: [
        {
          id: 'branch_1',
          name: '分支1',
          weightExpectation: '中',
          weightFactors: [],
          nextNode: ''
        },
        {
          id: 'default',
          name: '默认分支',
          weightExpectation: '中',
          weightFactors: [],
          nextNode: ''
        }
      ]
    }
  },
  [NODE_TYPES.RESULT]: {
    label: '结果',
    color: '#6EE7B7',
    icon: '✓',
    description: '播放表演并结算属性',
    defaultData: {
      animation: '',
      playMode: '单次',
      attributeChanges: [],
      outputs: [],
      nextNode: ''
    }
  },
  [NODE_TYPES.LOOP]: {
    label: '循环',
    color: '#F472B6',
    icon: '↻',
    description: '依次判定目标、资源与稍息',
    defaultData: {
      loopVersion: 2,
      completionCondition: '',
      completionRules: [],
      resourceCheck: '',
      resourceRules: [],
      failureReason: '',
      restEnabled: true,
      restExpectation: '待定',
      restCondition: '',
      restRules: []
    }
  },
  [NODE_TYPES.END]: {
    label: '结束',
    color: '#94A3B8',
    icon: '■',
    description: '行为结束',
    defaultData: {
      animation: '',
      playMode: '单次',
      playExpectation: '',
      releaseResources: []
    }
  }
}

// 目标类型
export const TARGET_TYPES = {
  ATTRIBUTE: 'attribute',
  OBJECT: 'object'
}

// 常见属性
export const ATTRIBUTES = [
  { value: 'satiety', label: '饱腹' },
  { value: 'energy', label: '精力' },
  { value: 'cleanliness', label: '清洁度' },
  { value: 'emotion', label: '情绪' },
  { value: 'durability', label: '耐久度' },
  { value: 'freshness', label: '新鲜度' }
]

// 交互对象类型
export const INTERACT_OBJECT_TYPES = [
  { value: 'partner', label: '伙伴' },
  { value: 'handheld', label: '手持物' },
  { value: 'interactPoint', label: '交互点' },
  { value: 'material', label: '原料' },
  { value: 'collectible', label: '收藏品' },
  { value: 'container', label: '收藏容器' },
  { value: 'buff', label: 'Buff' },
  { value: 'food', label: '食物' }
]

// 权重影响规则
export const WEIGHT_RULES = [
  { value: 'positive', label: '正相关' },
  { value: 'negative', label: '负相关' },
  { value: 'threshold', label: '阈值触发' }
]
