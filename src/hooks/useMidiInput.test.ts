import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type OrganSettings } from '../audio/organ'
import { useMidiInput } from './useMidiInput'

class FakeInput {
  onmidimessage: ((e: { data: Uint8Array }) => void) | null = null
  state: 'connected' | 'disconnected' = 'connected'
  readonly id: string
  readonly name: string
  constructor(id: string, name: string) {
    this.id = id
    this.name = name
  }
  send(...bytes: number[]) {
    this.onmidimessage?.({ data: new Uint8Array(bytes) })
  }
}

class FakeAccess {
  readonly inputs = new Map<string, FakeInput>()
  onstatechange: ((e: { port: FakeInput }) => void) | null = null
  plug(input: FakeInput) {
    this.inputs.set(input.id, input)
    this.onstatechange?.({ port: input })
  }
  unplug(input: FakeInput) {
    input.state = 'disconnected'
    this.inputs.delete(input.id)
    this.onstatechange?.({ port: input })
  }
}

function installAccess(access: FakeAccess | Error) {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    value: () => (access instanceof Error ? Promise.reject(access) : Promise.resolve(access)),
  })
}

function setup(access: FakeAccess | Error) {
  installAccess(access)
  const controller = {
    settings: DEFAULT_SETTINGS as OrganSettings,
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    allNotesOff: vi.fn(),
    updateSettings: vi.fn(),
  }
  const hook = renderHook(() => useMidiInput(controller))
  return { hook, controller }
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'requestMIDIAccess')
})

describe('useMidiInput', () => {
  it('reports unsupported when the browser has no Web MIDI', () => {
    const { result } = renderHook(() =>
      useMidiInput({ settings: DEFAULT_SETTINGS, noteOn: vi.fn(), noteOff: vi.fn(), allNotesOff: vi.fn(), updateSettings: vi.fn() }),
    )
    expect(result.current.status).toBe('unsupported')
  })

  it('stays idle until connect is called, then lists inputs and auto-selects a lone device', async () => {
    const access = new FakeAccess()
    const piano = new FakeInput('a', 'Piano')
    access.inputs.set(piano.id, piano)
    const { hook } = setup(access)
    expect(hook.result.current.status).toBe('idle')
    await act(() => hook.result.current.connect())
    expect(hook.result.current.status).toBe('ready')
    expect(hook.result.current.inputs).toEqual([{ id: 'a', name: 'Piano' }])
    expect(hook.result.current.selectedId).toBe('a')
  })

  it('reports denied when permission is refused', async () => {
    const { hook } = setup(new Error('denied'))
    await act(() => hook.result.current.connect())
    expect(hook.result.current.status).toBe('denied')
  })

  it('plays notes from the selected input only', async () => {
    const access = new FakeAccess()
    const a = new FakeInput('a', 'A')
    const b = new FakeInput('b', 'B')
    access.inputs.set(a.id, a)
    access.inputs.set(b.id, b)
    const { hook, controller } = setup(access)
    await act(() => hook.result.current.connect())
    expect(hook.result.current.selectedId).toBeNull()
    act(() => hook.result.current.select('b'))
    act(() => a.send(0x90, 60, 100))
    expect(controller.noteOn).not.toHaveBeenCalled()
    act(() => b.send(0x90, 60, 100))
    expect(controller.noteOn).toHaveBeenCalledWith(60)
    act(() => b.send(0x90, 60, 0))
    expect(controller.noteOff).toHaveBeenCalledWith(60)
  })

  it('maps control changes onto settings', async () => {
    const access = new FakeAccess()
    const a = new FakeInput('a', 'A')
    access.inputs.set(a.id, a)
    const { hook, controller } = setup(access)
    await act(() => hook.result.current.connect())
    act(() => a.send(0xb0, 11, 127))
    expect(controller.updateSettings).toHaveBeenCalledWith({ volume: 1 })
    act(() => a.send(0xb0, 14, 127))
    expect(controller.updateSettings).toHaveBeenCalledWith({ drawbars: [8, 8, 8, 0, 0, 0, 0, 0, 0] })
  })

  it('follows hot-plug: new devices appear, a lone new device is selected', async () => {
    const access = new FakeAccess()
    const { hook } = setup(access)
    await act(() => hook.result.current.connect())
    expect(hook.result.current.inputs).toEqual([])
    const a = new FakeInput('a', 'A')
    act(() => access.plug(a))
    expect(hook.result.current.inputs).toEqual([{ id: 'a', name: 'A' }])
    expect(hook.result.current.selectedId).toBe('a')
  })

  it('releases held notes and deselects when the selected device is unplugged', async () => {
    const access = new FakeAccess()
    const a = new FakeInput('a', 'A')
    access.inputs.set(a.id, a)
    const { hook, controller } = setup(access)
    await act(() => hook.result.current.connect())
    act(() => access.unplug(a))
    expect(hook.result.current.selectedId).toBeNull()
    expect(controller.allNotesOff).toHaveBeenCalled()
    act(() => a.send(0x90, 60, 100))
    expect(controller.noteOn).not.toHaveBeenCalled()
  })
})
