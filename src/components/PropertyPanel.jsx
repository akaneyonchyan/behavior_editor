import React from 'react'
import { useBehaviorStore } from '../store/behaviorStore'
import { NODE_CONFIG, NODE_TYPES } from '../constants/behaviorTypes'
import './PropertyPanel.css'
import WeightFactors from './WeightFactors'
import TextChoice from './TextChoice'
import LibraryRules from './LibraryRules'
import { useContentLibrary } from '../store/contentLibrary'
import { EXPECTATIONS } from '../utils/weightFactors'
import LoopFields from './LoopEditor'
import BehaviorMetadata from './BehaviorMetadata'

export default function PropertyPanel() {
  const { selectedNode, updateNode, deleteNode } = useBehaviorStore()

  if (!selectedNode) {
    return <BehaviorMetadata />
  }

  const config = NODE_CONFIG[selectedNode.type]

  return (
    <div className="property-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-icon" style={{ background: config.color }}>
            {config.icon}
          </span>
          {config.label}节点
        </div>
        <button
          className="btn-delete"
          onClick={() => deleteNode(selectedNode.id)}
        >
          删除
        </button>
      </div>

      <div className="panel-content">
        {/* 通用字段 */}
        <div className="form-group">
          <label>节点名称</label>
          <input
            type="text"
            value={selectedNode.data.name || ''}
            onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })}
            placeholder={`${config.label}节点`}
          />
        </div>

        <div className="form-group">
          <label>节点说明</label>
          <textarea
            value={selectedNode.data.description || ''}
            onChange={(e) => updateNode(selectedNode.id, { description: e.target.value })}
            placeholder="可选的节点说明"
            rows={2}
          />
        </div>

        {/* 类型特定字段 */}
        {selectedNode.type === NODE_TYPES.MOVE && <MoveFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.JUDGE && <JudgeFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.RESULT && <ResultFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.LOOP && <LoopFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.END && <EndFields node={selectedNode} />}
      </div>
    </div>
  )
}

// 位移节点字段
function MoveFields({ node }) {
  const { updateNode } = useBehaviorStore()
  const objects=useContentLibrary(s=>s.library.objects)

  return (
    <>
      <div className="form-group">
        <label>目的地类型</label>
        <select
          value={node.data.destinationType || 'interactObject'}
          onChange={(e) => updateNode(node.id, { destinationType: e.target.value })}
        >
          <option value="interactObject">交互对象</option>
          <option value="coordinate">固定坐标</option>
        </select>
      </div>

      <div className="form-group">
        <label>交互对象类型</label>
        <TextChoice label="交互对象类型" options={objects.filter(o=>o.enabled).map(o=>o.name)} value={objects.find(o=>o.id===node.data.objectType)?.name||node.data.objectType||''} onChange={name=>updateNode(node.id,{objectType:objects.find(o=>o.name===name)?.id||name})} placeholder="从公共库选择对象类型"/>
      </div>
      <div className="form-group">
        <label>目的地</label>
        <input
          type="text"
          value={node.data.destination || ''}
          onChange={(e) => updateNode(node.id, { destination: e.target.value })}
          placeholder={node.data.destinationType === 'coordinate' ? 'x, y, z' : '对象名称'}
        />
      </div>
    </>
  )
}

// 判断节点字段
function JudgeFields({ node }) {
  const { updateNode } = useBehaviorStore()
  const branches = node.data.branches || []

  const addBranch = () => {
    const newBranch = {
      id: `branch_${Date.now()}`,
      name: `分支${branches.length}`,
      weightExpectation: '待定',
      weightFactors: [],
      nextNode: ''
    }
    updateNode(node.id, { branches: [...branches, newBranch] })
  }

  const updateBranch = (index, updates) => {
    const newBranches = [...branches]
    newBranches[index] = { ...newBranches[index], ...updates }
    updateNode(node.id, { branches: newBranches })
  }

  const removeBranch = (index) => {
    if (branches.length <= 2) {
      alert('至少保留两个分支')
      return
    }
    updateNode(node.id, { branches: branches.filter((_, i) => i !== index) })
  }

  return (
    <div className="judge-branches">
      <p className="form-hint">这里只表达发生倾向和属性影响，具体概率与数值留待数值设计。</p>
      <div className="section-header">
        <label>分支配置</label>
        <button className="btn-small" onClick={addBranch}>+ 添加分支</button>
      </div>

      {branches.map((branch, i) => (
        <div key={branch.id} className="branch-item">
          <div className="branch-header">
            <input
              type="text"
              value={branch.name}
              onChange={(e) => updateBranch(i, { name: e.target.value })}
              className="branch-name-input"
            />
            {branch.id !== 'default' && (
              <button
                className="btn-remove"
                onClick={() => removeBranch(i)}
              >
                ×
              </button>
            )}
          </div>

          <div className="form-group-inline">
            <label>发生倾向</label>
            <TextChoice
              label="发生倾向"
              options={EXPECTATIONS}
              value={branch.weightExpectation || ''}
              placeholder="待定，也可填写大致期望"
              onChange={(value) => updateBranch(i, { weightExpectation: value })}
            />
          </div>
          <WeightFactors branch={branch} onChange={weightFactors => updateBranch(i, { weightFactors })} />
        </div>
      ))}
    </div>
  )
}

// 结果节点字段
function ResultFields({ node }) {
  const { updateNode } = useBehaviorStore()
  const library=useContentLibrary(s=>s.library)
  const convertLegacy=()=>{
    const effects=(node.data.attributeChanges||[]).filter(Boolean).map(text=>{
      const attribute=[...library.attributes].sort((a,b)=>b.name.length-a.name.length).find(a=>text===a.name||text.startsWith(a.name+' '))
      return {id:crypto.randomUUID(),source:'',attribute:attribute?.id||'',influence:attribute?text.slice(attribute.name.length).trim():text,legacyText:text}
    })
    updateNode(node.id,{effectRules:[...(node.data.effectRules||[]),...effects],attributeChanges:[]})
  }

  return (
    <>
      <div className="form-group">
        <label>表演动画</label>
        <input
          type="text"
          value={node.data.animation || ''}
          onChange={(e) => updateNode(node.id, { animation: e.target.value })}
          placeholder="动画名称"
        />
      </div>

      <LibraryRules title="属性 / Buff 变更" mode="change" value={node.data.effectRules} onChange={effectRules=>updateNode(node.id,{effectRules})}/>
      {!!node.data.attributeChanges?.length&&<div className="form-group">
        <label>原有文字变更（保留）</label>
        <textarea
          value={node.data.attributeChanges?.join('\n') || ''}
          onChange={(e) => updateNode(node.id, { attributeChanges: e.target.value.split('\n') })}
          placeholder="饱腹 +10&#10;精力 -5"
          rows={3}
        />
        <div className="form-hint">旧文字规则继续保留，新规则请从上方公共库选择。</div>
        <button className="btn-small" onClick={convertLegacy}>将原有文字转为下拉规则</button>
        <div className="form-hint">保留原描述，转换后请选择来源对象；可用撤销恢复。</div>
      </div>}
    </>
  )
}

// 结束节点字段
function EndFields({ node }) {
  const { updateNode } = useBehaviorStore()

  return (
    <>
      <div className="form-group">
        <label>成功表演</label>
        <input
          type="text"
          value={node.data.successAnimation || ''}
          onChange={(e) => updateNode(node.id, { successAnimation: e.target.value })}
          placeholder="成功动画"
        />
      </div>

      <div className="form-group">
        <label>失败表演</label>
        <input
          type="text"
          value={node.data.failAnimation || ''}
          onChange={(e) => updateNode(node.id, { failAnimation: e.target.value })}
          placeholder="失败动画"
        />
      </div>
    </>
  )
}
