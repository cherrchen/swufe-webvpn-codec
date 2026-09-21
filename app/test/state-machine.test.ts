import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BridgeStateMachine } from '../src/main/state-machine'

test('legal transitions advance the bridge state', () => {
  const machine = new BridgeStateMachine()
  assert.equal(machine.state, 'idle')

  machine.transition('starting')
  machine.transition('running')
  machine.transition('stopping')
  machine.transition('idle')

  assert.equal(machine.state, 'idle')
})

test('illegal transitions throw and leave the state untouched', () => {
  const machine = new BridgeStateMachine()

  assert.throws(() => machine.transition('running'), /非法状态迁移：idle → running/)
  assert.equal(machine.state, 'idle')

  machine.transition('starting')
  assert.throws(() => machine.transition('idle'), /非法状态迁移：starting → idle/)
  assert.equal(machine.state, 'starting')
})

test('fail parks the machine in error until the next operation', () => {
  const machine = new BridgeStateMachine()
  machine.transition('starting')
  machine.fail('BRIDGE_CRASH', '桥接进程异常退出：请查看日志后重新开启桥接。')

  assert.equal(machine.state, 'error')
  assert.deepEqual(machine.error, {
    code: 'BRIDGE_CRASH',
    message: '桥接进程异常退出：请查看日志后重新开启桥接。',
  })

  // Staying in error is the point (the UI shows the reason until the user acts).
  assert.equal(machine.state, 'error')

  machine.reset()
  assert.equal(machine.state, 'idle')
  assert.equal(machine.error, undefined)
})

test('an error can escalate into a different error', () => {
  const machine = new BridgeStateMachine()
  machine.transition('starting')
  machine.fail('BRIDGE_CRASH', 'first')
  machine.fail('SESSION_EXPIRED', 'second')

  assert.deepEqual(machine.error, { code: 'SESSION_EXPIRED', message: 'second' })

  // error → running is illegal; error → idle → starting is the recovery path.
  assert.throws(() => machine.transition('running'), /非法状态迁移：error → running/)
  machine.reset()
  machine.transition('starting')
  assert.equal(machine.state, 'starting')
})
