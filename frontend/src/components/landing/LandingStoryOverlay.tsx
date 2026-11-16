import { ArrowRight, Cpu } from 'lucide-react'
import { Link } from 'react-router-dom'

const stories = [
  {
    eyebrow: 'KERNELX COMPUTATIONAL ENGINE',
    title: <>Inside the<br /><em>machine.</em></>,
    body: 'Every process has a path. Every instruction has a destination.',
  },
  {
    eyebrow: '01 · PROCESS CREATION',
    title: <>A process<br /><em>takes shape.</em></>,
    body: 'A process control block enters the system. Its list links and parent relationships give it a place in the machine.',
  },
  {
    eyebrow: '02 · SCHEDULING',
    title: <>Order finds<br /><em>a route.</em></>,
    body: 'Priority and arrival information move through a max heap and FIFO queue as the scheduler chooses what runs next.',
  },
  {
    eyebrow: '03 · EXECUTION',
    title: <>The core<br /><em>comes alive.</em></>,
    body: 'A selected process reaches the processor. The execution core illuminates as instructions move through its computational layers.',
  },
  {
    eyebrow: '04 · MEMORY',
    title: <>Memory holds<br /><em>the work.</em></>,
    body: 'Memory blocks light as resources are allocated and released along the process path.',
  },
  {
    eyebrow: '05 · PROCESS COMPLETE',
    title: <>The work is done.<br /><em>Now see the whole machine.</em></>,
    body: 'Explore scheduling, memory management and the data structures behind an operating system.',
  },
]

export function LandingStoryOverlay({ stage }: { stage: number }) {
  const activeIndex = Math.min(stories.length - 1, Math.max(0, stage))

  return <div className="landing-story-overlay">
    {stories.map((story, index) => {
      const active = activeIndex === index
      const finale = index === stories.length - 1
      return <section
        key={story.eyebrow}
        className={`landing-story-copy${active ? ' is-active' : ''}${index === 0 ? ' is-opening-copy' : ''}${finale ? ' landing-finale-copy is-finale-copy' : ''}`}
        data-chapter={index}
        aria-hidden={!active}
        aria-live={active ? 'polite' : 'off'}
        aria-atomic="true"
        aria-labelledby={finale ? 'landing-finale-title' : undefined}
      >
        <div className="landing-kicker"><i /> {story.eyebrow}</div>
        <h1 id={finale ? 'landing-finale-title' : undefined}>{story.title}</h1>
        <p>{story.body}</p>
        {finale
          ? <Link to="/overview" className="landing-enter-button" tabIndex={active ? 0 : -1}><Cpu size={17} /> Enter KernelX <ArrowRight size={18} /></Link>
          : <span className="landing-story-index">{String(index + 1).padStart(2, '0')} <i /> 06</span>}
      </section>
    })}
  </div>
}
