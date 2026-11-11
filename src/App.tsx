import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Camera, Check, FileUp, Fingerprint, Link2, LockKeyhole, Menu, MessageSquare, MonitorUp, ShieldCheck, Video, X } from 'lucide-react'
import './App.css'

type ModalMode = 'create' | 'join' | null

function Mark({ small = false }: { small?: boolean }) {
  return <span className={small ? 'mark mark--small' : 'mark'} aria-hidden="true"><i /><i /></span>
}

function WaveVisual() {
  return (
    <div className="visual" aria-hidden="true">
      <div className="visual__grid" />
      <div className="visual__orbit visual__orbit--one" />
      <div className="visual__orbit visual__orbit--two" />
      <svg className="wave" viewBox="0 0 660 450" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="wave-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop stopColor="#f5c518" stopOpacity="0" />
            <stop offset=".36" stopColor="#f5c518" stopOpacity=".9" />
            <stop offset=".68" stopColor="#fff0a1" stopOpacity=".95" />
            <stop offset="1" stopColor="#f5c518" stopOpacity="0" />
          </linearGradient>
          <filter id="wave-glow"><feGaussianBlur stdDeviation="7" /></filter>
        </defs>
        <g transform="translate(0,3)">
          {Array.from({length: 34}, (_, i) => {
            const y = 128 + i * 5.8
            const amp = 41 + Math.sin(i / 6) * 23
            return <path key={i} d={"M -30 " + (y + 18) + " C 120 " + (y - 75 + amp) + ", 160 " + (y + 128 - amp) + ", 310 " + (y + 10) + " S 510 " + (y - 94 + amp) + ", 690 " + (y - 12)} fill="none" stroke="url(#wave-gradient)" strokeWidth={i % 6 === 0 ? 1.35 : .65} strokeOpacity={.18 + (i / 34) * .42} />
          })}
          <path d="M-20 255 C170 102 203 332 358 199 S550 177 679 125" fill="none" stroke="#f5c518" strokeWidth="7" strokeOpacity=".45" filter="url(#wave-glow)" />
          <path d="M-20 255 C170 102 203 332 358 199 S550 177 679 125" fill="none" stroke="#ffe375" strokeWidth="1.7" />
        </g>
        <g fill="#f5c518">
          <circle cx="120" cy="118" r="2" opacity=".8"/><circle cx="438" cy="105" r="2" opacity=".6"/><circle cx="565" cy="309" r="2" opacity=".7"/>
        </g>
      </svg>
      <div className="visual__center">
        <span className="visual__center-icon"><Video size={32} strokeWidth={1.65}/></span>
        <span>ONE LINK. ONE SPACE.</span>
      </div>
      <span className="visual__cross visual__cross--one">+</span>
      <span className="visual__cross visual__cross--two">+</span>
      <div className="visual__label">CONNECTION / REIMAGINED</div>
    </div>
  )
}

const features = [
  { number: '01', icon: Video, title: 'Video & audio', copy: 'A focused space for face-to-face conversations, with the controls right where you need them.' },
  { number: '02', icon: MessageSquare, title: 'Stay in the conversation', copy: 'Send messages, reactions, and stickers without leaving the call.' },
  { number: '03', icon: MonitorUp, title: 'Share your screen', copy: 'Show a project, review a design, or walk through an idea together.' },
  { number: '04', icon: FileUp, title: 'Share what matters', copy: 'Bring images and project files into the same temporary workspace.' },
]

function App() {
  const [modal, setModal] = useState<ModalMode>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [invite, setInvite] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [requireApproval, setRequireApproval] = useState(true)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    document.body.style.overflow = modal ? 'hidden' : ''
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null) }
    window.addEventListener('keydown', onEscape)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onEscape) }
  }, [modal])

  const showModal = (mode: Exclude<ModalMode, null>) => {
    setModal(mode)
    setNotice('')
    setNavOpen(false)
  }

  const submitPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('The interface is ready. Secure room creation and joining will be connected in the next development phase.')
  }

  return (
    <div className="site">
      <header className="header">
        <div className="shell header__inner">
          <a className="brand" href="#home" onClick={() => setNavOpen(false)} aria-label="NEXROOM home"><Mark /><span><b>NEX</b>ROOM<span className="brand__dot">.</span></span></a>
          <nav className={navOpen ? 'nav nav--open' : 'nav'} aria-label="Primary navigation">
            <a href="#features" onClick={() => setNavOpen(false)}>FEATURES</a>
            <a href="#how-it-works" onClick={() => setNavOpen(false)}>HOW IT WORKS</a>
            <a href="#privacy" onClick={() => setNavOpen(false)}>PRIVACY</a>
          </nav>
          <div className="header__actions">
            <button type="button" className="btn btn--small btn--outline header__start" onClick={() => showModal('create')}>GET STARTED <ArrowUpRight size={15}/></button>
            <button type="button" className="menu-toggle" onClick={() => setNavOpen(!navOpen)} aria-label={navOpen ? 'Close menu' : 'Open menu'} aria-expanded={navOpen}>{navOpen ? <X size={23}/> : <Menu size={23}/>}</button>
          </div>
        </div>
      </header>

      <main id="home">
        <section className="hero shell">
          <div className="hero__copy">
            <p className="eyebrow"><span className="eyebrow__slash">/</span> PRIVATE REAL-TIME COLLABORATION</p>
            <h1>YOUR SPACE.<br />YOUR PEOPLE.<br /><em>STAY CONNECTED.</em></h1>
            <p className="hero__description">A better space to talk, share, and build together. Video calls, chat, and collaboration — all in your browser.</p>
            <div className="hero__actions">
              <button type="button" className="btn btn--primary" onClick={() => showModal('create')}><Video size={18}/> CREATE A ROOM <ArrowUpRight size={17}/></button>
              <button type="button" className="btn btn--outline" onClick={() => showModal('join')}><Link2 size={18}/> JOIN A ROOM <ArrowRight size={17}/></button>
            </div>
            <p className="hero__foot"><span className="hero__status" /> NO DOWNLOADS. NO ACCOUNTS. JUST CONNECT.</p>
          </div>
          <WaveVisual />
          <div className="hero__bottom"><span>DESIGNED FOR CONVERSATION</span><span>SCROLL TO EXPLORE <ArrowDownRight size={14}/></span></div>
        </section>

        <section id="features" className="section shell">
          <div className="section__top"><p className="eyebrow"><span className="eyebrow__slash">/</span> THE EXPERIENCE</p><span className="section__index">01 / 03</span></div>
          <div className="section__heading"><h2>LESS FRICTION.<br /><em>MORE CONNECTION.</em></h2><p>Everything that matters in one clean interface, without the distractions.</p></div>
          <div className="features">
            {features.map(({number,icon: Icon,title,copy}) => <article className="feature" key={number}><div className="feature__top"><span className="feature__number">{number} /</span><Icon size={26} strokeWidth={1.5}/></div><h3>{title}</h3><p>{copy}</p><ArrowUpRight size={17} className="feature__arrow" aria-hidden="true"/></article>)}
          </div>
        </section>

        <section id="how-it-works" className="steps-section">
          <div className="shell">
            <div className="section__top"><p className="eyebrow"><span className="eyebrow__slash">/</span> KEEP IT SIMPLE</p><span className="section__index">02 / 03</span></div>
            <div className="section__heading"><h2>MEET IN <em>THREE STEPS.</em></h2><p>Invite the people you trust and get straight to what matters.</p></div>
            <div className="steps">
              <div className="step"><span>01</span><h3>Create your space</h3><p>Choose a room name and purpose.</p></div>
              <div className="step"><span>02</span><h3>Share a private link</h3><p>Invite friends and approve who comes in.</p></div>
              <div className="step"><span>03</span><h3>Start collaborating</h3><p>Talk, chat, and share in one place.</p></div>
            </div>
          </div>
        </section>

        <section id="privacy" className="privacy shell">
          <div className="privacy__icon"><Fingerprint size={58} strokeWidth={1}/></div>
          <div className="privacy__body"><p className="eyebrow"><span className="eyebrow__slash">/</span> PRIVACY BY DESIGN</p><h2>YOUR CONVERSATIONS.<br /><em>YOUR CONTROL.</em></h2><p>NEXROOM is being designed around private, encrypted communication and temporary sessions. No permanent chat archive or personal profile is planned.</p><span className="privacy__note"><ShieldCheck size={17}/> Encryption and room features are part of the upcoming application, not active in this homepage preview.</span></div>
        </section>

        <section className="bottom-cta shell">
          <div><p className="eyebrow"><span className="eyebrow__slash">/</span> MADE FOR THE MOMENTS THAT MATTER</p><h2>READY TO <em>CONNECT?</em></h2></div>
          <button type="button" className="btn btn--primary" onClick={() => showModal('create')}>CREATE YOUR ROOM <ArrowUpRight size={18}/></button>
        </section>
      </main>

      <footer className="footer"><div className="shell footer__inner"><a className="brand brand--footer" href="#home"><Mark small/><span><b>NEX</b>ROOM<span className="brand__dot">.</span></span></a><span>REAL PEOPLE. REAL CONVERSATIONS.</span><span>© {new Date().getFullYear()} NEXROOM</span></div></footer>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-heading">
          <div className="modal__header"><div className="modal__icon">{modal === 'create' ? <Camera size={22}/> : <Link2 size={22}/>}</div><button type="button" className="modal__close" onClick={() => setModal(null)} aria-label="Close dialog"><X size={21}/></button></div>
          <p className="eyebrow"><span className="eyebrow__slash">/</span> NEXROOM INTERFACE PREVIEW</p>
          <h2 id="modal-heading">{modal === 'create' ? 'Create a room' : 'Join a room'}</h2>
          <p className="modal__desc">{modal === 'create' ? 'Give your space a name and choose who can join.' : 'Enter an invite link and the name others will see.'}</p>
          <form onSubmit={submitPreview} className="modal__form">
            {modal === 'create' ? <>
              <label htmlFor="room-name">ROOM NAME</label>
              <input id="room-name" value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="e.g. Project Sync" required maxLength={80}/>
              <label htmlFor="room-purpose">PURPOSE <span>(OPTIONAL)</span></label>
              <textarea id="room-purpose" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="What will you discuss?" maxLength={200} rows={3}/>
              <label className="checkline"><span><LockKeyhole size={17}/> REQUIRE HOST APPROVAL</span><input type="checkbox" checked={requireApproval} onChange={e => setRequireApproval(e.target.checked)}/></label>
            </> : <>
              <label htmlFor="invite">ROOM LINK OR CODE</label>
              <input id="invite" value={invite} onChange={e => setInvite(e.target.value)} placeholder="Paste the private invite link" required/>
              <label htmlFor="display-name">YOUR DISPLAY NAME</label>
              <input id="display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Name for this session" required maxLength={60}/>
            </>}
            <button type="submit" className="btn btn--primary modal__submit">{modal === 'create' ? 'PREVIEW ROOM SETUP' : 'PREVIEW JOIN REQUEST'} <ArrowRight size={18}/></button>
          </form>
          {notice && <p role="status" className="modal__notice"><Check size={17}/>{notice}</p>}
          <p className="modal__disclaimer">UI preview only · The calling server will be implemented next.</p>
        </section>
      </div>}
    </div>
  )
}

export default App
