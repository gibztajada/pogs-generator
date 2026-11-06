'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import './unlock.css';

const LEN = 2;
const KEY_W = 120;
const TOP_TEXT = 'Enter the team passcode to reveal your key';
const KEY_TEXT = 'Use the key to unlock';
const KEY_PATH = 'M20.5 2a18.5 18.5 0 0 1 17.6 12.8H114l6 5.7-6 5.7h-6v8h-7v-8h-5v6h-7v-6H38.1A18.5 18.5 0 1 1 20.5 2zm0 11a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z';

type Phase = 'typing' | 'checking' | 'ready' | 'flying';
type Dialog = 'hidden' | 'show' | 'away';

const T = (x: number, y: number, r: number, s: number) => `translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`;
const shakeFrames = (d: number) => [0, -d, d, -d, d, 0].map((v) => ({ translate: `${v}px 0` }));
/** Centre of an element in stage coordinates (the stage covers the viewport). */
const centre = (el: Element) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

/** The passcode page: a magic key appears for the right code, and catching it unlocks the app. */
export function UnlockGate({ next, configured }: { next: string; configured: boolean }) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLButtonElement>(null);
  const lockRef = useRef<SVGSVGElement>(null);
  const lockWrapRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const topDialogRef = useRef<HTMLDivElement>(null);
  const timers = useRef(new Set<number>());
  const phaseRef = useRef<Phase>('typing');
  const motion = useRef({ reduce: false, hover: true });

  const [phase, setPhaseState] = useState<Phase>('typing');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [step, setStep] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [topDialog, setTopDialog] = useState<Dialog>('hidden');
  const [keyDialog, setKeyDialog] = useState<Dialog>('hidden');
  const [topTyped, setTopTyped] = useState('');
  const [keyTyped, setKeyTyped] = useState('');
  const [handIn, setHandIn] = useState(false);
  const [grab, setGrab] = useState(false);
  const [squeeze, setSqueeze] = useState(false);

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
  }, []);

  const typeOut = useCallback((text: string, set: (s: string) => void) => {
    let i = 0;
    const tick = () => { set(text.slice(0, i)); if (i++ < text.length) later(tick, i < 2 ? 250 : 34); };
    tick();
  }, [later]);

  const fx = useCallback((cls: string, x: number, y: number, vars: Record<string, string> = {}, delay = 0) => {
    const e = document.createElement('div');
    e.className = cls;
    e.style.left = `${x}px`;
    e.style.top = `${y}px`;
    e.style.animationDelay = `${delay}s`;
    for (const [k, v] of Object.entries(vars)) e.style.setProperty(k, v);
    stageRef.current?.appendChild(e);
    later(() => e.remove(), 1500);
    return e;
  }, [later]);

  useEffect(() => {
    const pending = timers.current;
    motion.current = {
      reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
      hover: matchMedia('(hover: hover) and (pointer: fine)').matches,
    };
    if (configured) later(() => { setTopDialog('show'); typeOut(TOP_TEXT, setTopTyped); }, 450);
    return () => pending.forEach(clearTimeout);
  }, [configured, later, typeOut]);

  // Focus moves to the key the moment it can be caught.
  useEffect(() => { if (revealed) keyRef.current?.focus({ preventScroll: true }); }, [revealed]);

  // Little ✦ twinkles around the floating key.
  useEffect(() => {
    if (phase !== 'ready' || !revealed || motion.current.reduce) return;
    const id = window.setInterval(() => {
      if (!keyRef.current) return;
      const [x, y] = centre(keyRef.current);
      fx('ug-twinkle', x - 70 + Math.random() * 140, y - 26 + Math.random() * 30).textContent = '✦';
    }, 450);
    return () => clearInterval(id);
  }, [phase, revealed, fx]);

  function shake() {
    cardRef.current?.animate(shakeFrames(8), { duration: 450 });
    topDialogRef.current?.animate(shakeFrames(6), { duration: 450 });
    lockRef.current?.animate([0, -12, 12, 0].map((r) => ({ rotate: `${r}deg` })), { duration: 450 });
  }

  function reveal() {
    setPhase('ready');
    inputRef.current?.blur();
    setTopDialog('away');
    const { reduce, hover } = motion.current;
    if (!reduce && keyRef.current) {
      // Sparks drift in from all around and gather where the key will form.
      const [x, y] = centre(keyRef.current);
      for (let i = 0; i < 22; i++) {
        const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 90;
        fx('ug-mote', x, y, { '--x': `${Math.cos(a) * r}px`, '--y': `${Math.sin(a) * r}px` }, Math.random() * 0.2);
      }
      later(() => fx('ug-ring small', x, y), 650);
    }
    later(() => {
      setRevealed(true);
      later(() => { setKeyDialog('show'); typeOut(KEY_TEXT, setKeyTyped); }, 300);
      if (!reduce && hover) later(() => setHandIn(true), 250);
    }, reduce ? 0 : 650);
  }

  async function submit(value: string) {
    if (phaseRef.current !== 'typing' || value.length < LEN) return;
    setPhase('checking');
    setMsg('');
    let status = 0;
    try {
      const res = await fetch('/api/unlock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passcode: value }) });
      status = res.status;
    } catch { /* network failure: reported below */ }
    if (status === 200) return reveal();
    setPhase('typing');
    if (status === 401) {
      setMsg('Incorrect passcode');
      shake();
      later(() => inputRef.current?.select(), 0);
    } else {
      setMsg(status === 503 ? 'Passcode not configured' : "Couldn't check the passcode. Try again.");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (phaseRef.current !== 'typing') return;
    if (code.length < LEN) setMsg(`Enter all ${LEN} digits`);
    else void submit(code);
  }

  function catchKey() {
    if (phaseRef.current !== 'ready') return;
    setPhase('flying');
    setHandIn(false);
    setKeyDialog('away');
    if (motion.current.reduce) {
      setStep(4);
      setUnlocked(true);
      later(() => router.replace(next), 1000);
    }
  }

  // The key flies to the lock, slides into the keyhole and turns; then the lock pops open.
  useEffect(() => {
    if (phase !== 'flying' || motion.current.reduce) return;
    const card = cardRef.current, key = keyRef.current, lock = lockRef.current;
    if (!card || !key || !lock) return;
    let alive = true;
    const f = card.getBoundingClientRect(), w = f.width, h = f.height;
    // Re-anchor on the key's tip so it can rotate and shrink into the keyhole.
    const tx = w / 2 + KEY_W / 2, ty = h;
    key.style.left = '0';
    key.style.top = '0';
    const l = lock.getBoundingClientRect(), k = l.width / 48, kx = l.left - f.left + 24 * k, ky = l.top - f.top + 37 * k;
    const opts = (duration: number, easing: string): KeyframeAnimationOptions => ({ duration, easing, fill: 'forwards' });
    key.animate([{ transform: T(tx, ty, 0, 1) }, { transform: T(w + 40, h * 0.5, -28, 1.08), offset: 0.45 }, { transform: T(kx - 30, ky, 0, 0.7) }], opts(800, 'cubic-bezier(.45,0,.25,1)'))
      .finished.then(() => key.animate([{ transform: T(kx - 30, ky, 0, 0.7) }, { transform: T(kx, ky, 0, 0.42) }], opts(320, 'cubic-bezier(.6,0,.4,1)')).finished)
      .then(() => {
        if (!alive) return;
        setStep(2);
        return key.animate([{ transform: T(kx, ky, 0, 0.42) }, { transform: T(kx, ky, 90, 0.42) }], opts(400, 'cubic-bezier(.5,0,.2,1.4)')).finished;
      })
      .then(() => {
        if (!alive || !lockWrapRef.current) return;
        setStep(3);
        const [x, y] = centre(lockWrapRef.current);
        fx('ug-ring', x, y);
        fx('ug-ring r2', x, y);
        for (let i = 0; i < 26; i++) {
          const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 130;
          fx('ug-spark', x, y, { '--x': `${Math.cos(a) * r}px`, '--y': `${Math.sin(a) * r}px` }, Math.random() * 0.12);
        }
        later(() => { setStep(4); setUnlocked(true); later(() => router.replace(next), 1700); }, 550);
      })
      .catch(() => { /* animation cancelled on unmount */ });
    return () => { alive = false; };
  }, [phase, fx, later, next, router]);

  function onMouseMove(e: MouseEvent) {
    if (!handIn || !handRef.current || !keyRef.current) return;
    let x = e.clientX, y = e.clientY;
    // The key's ring sits 40px left of its centre; near it, the hand snaps on and pinches.
    const [kx, ky] = centre(keyRef.current), bx = kx - 40;
    const near = Math.hypot(bx - x, ky - y) < 55;
    if (near) { x = bx + 6; y = ky - 14; }
    setGrab(near);
    handRef.current.style.transform = `translate(${x}px,${y}px)`;
  }

  function onMouseDown(e: MouseEvent) {
    if (phaseRef.current !== 'ready' || !(grab || keyRef.current?.contains(e.target as Node))) return;
    e.preventDefault();
    setSqueeze(true);
    later(() => { setSqueeze(false); catchKey(); }, 140);
  }

  const dialogClass = (side: 'up' | 'down', state: Dialog, done: boolean) =>
    `ug-dlg ${side}${state === 'hidden' ? '' : ' ' + state}${done ? ' typed' : ''}`;
  const cardClass = ['ug-card', revealed && 'ready', phase === 'flying' && 'flying', step >= 2 && 's2', step >= 3 && 's3', step >= 4 && 's4']
    .filter(Boolean).join(' ');

  return (
    <div ref={stageRef} className={`ug-stage${unlocked ? ' unlocked' : ''}${handIn ? ' handmode' : ''}`} onMouseMove={onMouseMove} onMouseDown={onMouseDown}>
      <div className="ug-aur" />
      <div className="ug-stars" />
      <div className="ug-done" aria-live="polite">
        {unlocked && <><b>ACCESS GRANTED</b><span>Opening POGS Generator…</span><div className="ug-bar"><i /></div></>}
      </div>
      <div className="ug-wrap">
        {configured && (
          <>
            <div ref={topDialogRef} className={dialogClass('up', topDialog, topTyped === TOP_TEXT)} role="status">
              <span className="ico" aria-hidden>🔒</span>
              {topDialog !== 'hidden' && <span className="ug-sr">{TOP_TEXT}</span>}
              <span aria-hidden data-text={topTyped} className="txt" />
              <i className="caret" aria-hidden />
            </div>
            <div className={dialogClass('down', keyDialog, keyTyped === KEY_TEXT)} role="status">
              <span className="ico" aria-hidden>🔑</span>
              {keyDialog !== 'hidden' && <span className="ug-sr">{KEY_TEXT}</span>}
              <span aria-hidden data-text={keyTyped} className="txt" />
              <i className="caret" aria-hidden />
            </div>
          </>
        )}
        <form ref={cardRef} className={cardClass} onSubmit={onSubmit}>
          <div ref={lockWrapRef} className="ug-lockwrap">
            <svg ref={lockRef} className="ug-lock" viewBox="0 0 48 56" width="52" height="61" aria-hidden>
              <defs><linearGradient id="ug-lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00d48a" /><stop offset="1" stopColor="#3a7bff" /></linearGradient></defs>
              <path className="shackle" d="M13 24V16a11 11 0 0 1 22 0v8" fill="none" stroke="url(#ug-lg)" strokeWidth="4.5" strokeLinecap="round" />
              <g className="body">
                <rect x="5" y="23" width="38" height="29" rx="7" fill="url(#ug-lg)" />
                <g className="keyhole"><circle cx="24" cy="35" r="4" fill="#070b18" /><rect x="22" y="36" width="4" height="8" rx="2" fill="#070b18" /></g>
              </g>
            </svg>
          </div>
          <h1>POGS Generator</h1>
          {configured ? (
            <>
              <input
                ref={inputRef} className="ug-input" type="password" inputMode="numeric" autoComplete="off" autoFocus
                aria-label="Passcode" placeholder={'•'.repeat(LEN)} value={code} readOnly={phase !== 'typing'}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, LEN);
                  setCode(v);
                  setMsg('');
                  if (v.length === LEN) void submit(v);
                }}
              />
              <div className="ug-msg" role="alert">{msg}</div>
              <button ref={keyRef} type="button" className={`ug-key${phase === 'flying' ? ' tipmode' : ''}`} aria-label="Unlock" tabIndex={revealed ? 0 : -1} onClick={catchKey}>
                <svg className="ug-kin" viewBox="0 0 120 41" aria-hidden>
                  <defs>
                    <linearGradient id="ug-kg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#00d48a" /><stop offset="1" stopColor="#3a7bff" /></linearGradient>
                    <clipPath id="ug-kc"><path d={KEY_PATH} clipRule="evenodd" /></clipPath>
                    <linearGradient id="ug-sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".75" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
                  </defs>
                  <path fill="url(#ug-kg)" fillRule="evenodd" d={KEY_PATH} />
                  <g clipPath="url(#ug-kc)"><rect className="ug-shine" x="0" y="0" width="40" height="41" fill="url(#ug-sh)" transform="skewX(-20)" /></g>
                  <text x="66" y="23.6" textAnchor="middle" fontSize="8.5" fontWeight="700" letterSpacing="1.6" fill="#06101f" fontFamily="system-ui,sans-serif">UNLOCK</text>
                </svg>
              </button>
            </>
          ) : (
            <div className="ug-msg" role="alert">Passcode not configured</div>
          )}
        </form>
      </div>
      <div ref={handRef} className={`ug-hand${handIn ? ' in' : ''}${grab ? ' grab' : ''}${squeeze ? ' squeeze' : ''}`} aria-hidden>
        <span className="open">🖐️</span><span className="pinch">🤏</span>
      </div>
    </div>
  );
}
