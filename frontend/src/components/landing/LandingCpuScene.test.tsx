import type { PropsWithChildren } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LandingCpuScene } from './LandingCpuScene'

vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: PropsWithChildren) => <div data-testid="three-canvas">{children}</div> }))
vi.mock('./LandingEnvironment3D', () => ({ LandingEnvironment3D: () => <div data-testid="processor-environment" /> }))

function renderScene(stage: number) {
  return render(<LandingCpuScene scrollProgress={{ current: stage / 5 }} stage={stage} />)
}

describe('three-dimensional cinematic landing scene', () => {
  it('mounts the lazy three-dimensional environment with an opening view and no subsystem label', () => {
    renderScene(0)
    expect(screen.getByTestId('three-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('processor-environment')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each([
    [1, /LINKED LIST \+ PROCESS TREE/],
    [2, /MAX HEAP \+ FIFO BUFFER/],
    [3, /PROCESSOR PACKAGE/],
    [4, /HASH INDEX \+ ALLOCATION BANKS/],
  ])('reveals the focused hardware callout for story stage %i', (stage, label) => {
    renderScene(stage)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
