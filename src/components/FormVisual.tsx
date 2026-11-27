import React from 'react';
import type { VisualKey } from '../types/gym';

interface FormVisualProps {
  visualKey: VisualKey;
  label?: string;
}

interface VisualStepSpec {
  startCaption: string;
  endCaption: string;
  startSvg: React.ReactNode;
  endSvg: React.ReactNode;
}

const SLATE_PROP = '#283548';
const SLATE_PROP_LIGHT = '#3B4C63';
const LIMB_BACK = '#475569';
const LIMB_NEUTRAL = '#94A3B8';
const TORSO_NEUTRAL = '#CBD5E1';
const HEAD_STROKE = '#E2E8F0';
const HEAD_FILL = '#0A0F16';
const EMERALD = '#10B981';
const AMBER = '#F59E0B';

const Floor: React.FC<{ y?: number; x1?: number; x2?: number; y2?: number }> = ({
  y = 96,
  x1 = 14,
  x2 = 126,
  y2,
}) => (
  <line
    x1={x1}
    y1={y}
    x2={x2}
    y2={y2 ?? y}
    stroke={SLATE_PROP}
    strokeWidth="2.5"
    strokeLinecap="round"
  />
);

const Head: React.FC<{ x: number; y: number; r?: number }> = ({ x, y, r = 6.8 }) => (
  <circle cx={x} cy={y} r={r} fill={HEAD_FILL} stroke={HEAD_STROKE} strokeWidth="2.4" />
);

const Torso: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active?: boolean;
}> = ({ x1, y1, x2, y2, active }) => (
  <line
    x1={x1}
    y1={y1}
    x2={x2}
    y2={y2}
    stroke={active ? EMERALD : TORSO_NEUTRAL}
    strokeWidth="9.5"
    strokeLinecap="round"
  />
);

/** Sculpted front-view torso with broad shoulders and hip girdle so front-facing arms/legs connect naturally. */
const FrontTorso: React.FC<{
  cx?: number;
  topY?: number;
  botY?: number;
  active?: boolean;
}> = ({ cx = 70, topY = 38, botY = 66, active }) => {
  const col = active ? EMERALD : TORSO_NEUTRAL;
  return (
    <g>
      <line x1={cx} y1={botY} x2={cx} y2={topY} stroke={col} strokeWidth="9.5" strokeLinecap="round" />
      <line x1={cx - 8} y1={topY + 2} x2={cx + 8} y2={topY + 2} stroke={col} strokeWidth="6.5" strokeLinecap="round" />
      <line x1={cx - 5} y1={botY} x2={cx + 5} y2={botY} stroke={col} strokeWidth="6.5" strokeLinecap="round" />
    </g>
  );
};

const SpineCurve: React.FC<{ d: string; active?: boolean }> = ({ d, active }) => (
  <path
    d={d}
    stroke={active ? EMERALD : TORSO_NEUTRAL}
    strokeWidth="8.5"
    strokeLinecap="round"
    fill="none"
  />
);

const Limb: React.FC<{
  pts: [number, number, number, number, number, number];
  active?: boolean;
  back?: boolean;
  leg?: boolean;
}> = ({ pts: [x1, y1, x2, y2, x3, y3], active, back, leg }) => {
  const color = active ? EMERALD : back ? LIMB_BACK : LIMB_NEUTRAL;
  const w1 = leg ? 6.5 : 5.2;
  const w2 = leg ? 5.2 : 4.2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w1} strokeLinecap="round" />
      <line x1={x2} y1={y2} x2={x3} y2={y3} stroke={color} strokeWidth={w2} strokeLinecap="round" />
      <circle cx={x2} cy={y2} r={leg ? 2.4 : 2} fill={color} />
    </g>
  );
};

const FocusGlow: React.FC<{ x: number; y: number; r?: number }> = ({ x, y, r = 13 }) => (
  <circle cx={x} cy={y} r={r} fill={EMERALD} opacity="0.18" />
);

const Arrow: React.FC<{ d: string }> = ({ d }) => (
  <path
    d={d}
    stroke={AMBER}
    strokeWidth="2.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
);

const DumbbellProp: React.FC<{ x: number; y: number; vertical?: boolean }> = ({
  x,
  y,
  vertical,
}) =>
  vertical ? (
    <rect x={x - 3} y={y - 6} width="6" height="12" rx="2" fill={AMBER} />
  ) : (
    <rect x={x - 6} y={y - 3} width="12" height="6" rx="2" fill={AMBER} />
  );

function getVisualSpec(rawKey: VisualKey): VisualStepSpec {
  const key: VisualKey =
    rawKey === 'mobility_flow'
      ? 'worlds_greatest'
      : rawKey === 'stretch_reach'
      ? 'childs_pose'
      : rawKey;

  switch (key) {
    // ── 1. CAT-COW (Quadruped hands & knees) ──────────────────────────
    case 'cat_cow':
      return {
        startCaption: 'Inhale · Cow Arch',
        endCaption: 'Exhale · Cat Round',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[44, 64, 44, 94, 24, 94]} leg />
            <Limb pts={[94, 62, 94, 78, 95, 94]} />
            <SpineCurve d="M 44 62 Q 69 75 94 60" />
            <Head x={107} y={50} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={69} y={48} r={16} />
            <Limb pts={[44, 66, 44, 94, 24, 94]} leg />
            <Limb pts={[94, 66, 94, 80, 95, 94]} />
            <SpineCurve d="M 44 66 Q 69 36 94 66" active />
            <Head x={105} y={73} />
            <Arrow d="M 69 62 V 42 M 64 47 L 69 41 L 74 47" />
          </>
        ),
      };

    // ── 2. WORLD'S GREATEST STRETCH (Runner's lunge + T-spine reach) ──
    case 'worlds_greatest':
      return {
        startCaption: 'Long Lunge & Plant',
        endCaption: 'Rotate & Reach High',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[64, 72, 42, 82, 20, 94]} leg back />
            <Limb pts={[64, 72, 96, 68, 98, 94]} leg />
            <Torso x1={64} y1={72} x2={92} y2={58} />
            <Limb pts={[90, 60, 92, 76, 92, 94]} />
            <Head x={104} y={52} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={90} y={52} r={15} />
            <Limb pts={[64, 72, 42, 82, 20, 94]} leg back />
            <Limb pts={[64, 72, 96, 68, 98, 94]} leg />
            <Limb pts={[88, 56, 90, 75, 91, 94]} back />
            <Torso x1={64} y1={72} x2={90} y2={54} active />
            <Limb pts={[90, 54, 92, 34, 94, 16]} active />
            <Head x={102} y={48} />
            <Arrow d="M 110 42 C 114 28 108 18 99 15 M 105 14 L 98 15 L 101 21" />
          </>
        ),
      };

    // ── 3. SQUAT TO STAND ─────────────────────────────────────────────
    case 'squat_to_stand':
      return {
        startCaption: 'Hinge to Toes',
        endCaption: 'Drop Hips & Chest Tall',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[58, 56, 62, 76, 64, 94]} leg />
            <Torso x1={58} y1={56} x2={88} y2={70} />
            <Limb pts={[86, 68, 78, 82, 70, 94]} />
            <Head x={98} y={76} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={62} y={76} />
            <Limb pts={[58, 76, 84, 72, 82, 94]} leg active />
            <Torso x1={58} y1={76} x2={72} y2={46} active />
            <Limb pts={[72, 50, 78, 68, 82, 88]} />
            <Head x={76} y={34} />
            <Arrow d="M 42 54 V 78 M 37 73 L 42 79 L 47 73" />
          </>
        ),
      };

    // ── 4. SCAPULAR WALL SLIDES ───────────────────────────────────────
    case 'wall_slides':
      return {
        startCaption: 'Back Flat · W Arms',
        endCaption: 'Slide Overhead',
        startSvg: (
          <>
            <Floor />
            <line x1="42" y1="14" x2="42" y2="96" stroke={SLATE_PROP_LIGHT} strokeWidth="3" />
            <Limb pts={[74, 66, 74, 80, 74, 94]} leg />
            <FrontTorso cx={74} topY={38} botY={66} />
            <Limb pts={[66, 40, 56, 52, 56, 36]} />
            <Limb pts={[82, 40, 92, 52, 92, 36]} />
            <Head x={74} y={26} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <line x1="42" y1="14" x2="42" y2="96" stroke={SLATE_PROP_LIGHT} strokeWidth="3" />
            <FocusGlow x={74} y={40} r={15} />
            <Limb pts={[74, 66, 74, 80, 74, 94]} leg />
            <FrontTorso cx={74} topY={38} botY={66} />
            <Limb pts={[66, 40, 58, 28, 56, 14]} active />
            <Limb pts={[82, 40, 90, 28, 92, 14]} active />
            <Head x={74} y={26} />
            <Arrow d="M 108 44 V 18 M 103 23 L 108 17 L 113 23" />
          </>
        ),
      };

    // ── 5. CHEST PRESS (Seated / Bench Horizontal Push) ───────────────
    case 'chest_press':
      return {
        startCaption: 'Shoulders Pinched Back',
        endCaption: 'Press Smoothly Out',
        startSvg: (
          <>
            <Floor />
            <path d="M 42 96 V 32 M 38 74 H 74" stroke={SLATE_PROP_LIGHT} strokeWidth="4" strokeLinecap="round" />
            <Limb pts={[54, 72, 82, 74, 86, 94]} leg />
            <Torso x1={54} y1={72} x2={52} y2={42} />
            <Limb pts={[52, 46, 38, 56, 62, 50]} />
            <Head x={54} y={29} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <path d="M 42 96 V 32 M 38 74 H 74" stroke={SLATE_PROP_LIGHT} strokeWidth="4" strokeLinecap="round" />
            <FocusGlow x={60} y={48} />
            <Limb pts={[54, 72, 82, 74, 86, 94]} leg />
            <Torso x1={54} y1={72} x2={52} y2={42} />
            <Limb pts={[52, 46, 76, 48, 100, 48]} active />
            <Head x={54} y={29} />
            <Arrow d="M 80 34 H 112 M 106 29 L 113 34 L 106 39" />
          </>
        ),
      };

    // ── 6. PUSH-UP ────────────────────────────────────────────────────
    case 'pushup':
      return {
        startCaption: 'Lower With Elbows ~45°',
        endCaption: 'Press Plank Tall',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[32, 92, 54, 86, 66, 84]} leg />
            <Torso x1={66} y1={84} x2={100} y2={78} />
            <Limb pts={[98, 78, 86, 68, 96, 94]} />
            <Head x={112} y={75} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={96} y={66} />
            <Limb pts={[30, 92, 52, 80, 66, 72]} leg />
            <Torso x1={66} y1={72} x2={98} y2={58} active />
            <Limb pts={[96, 60, 96, 76, 96, 94]} active />
            <Head x={110} y={53} />
            <Arrow d="M 84 46 V 26 M 79 31 L 84 25 L 89 31" />
          </>
        ),
      };

    // ── 7. PIKE PUSH-UP ───────────────────────────────────────────────
    case 'pike_pushup':
      return {
        startCaption: 'Inverted-V Hips High',
        endCaption: 'Lower & Press Away',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[64, 44, 48, 70, 34, 94]} leg />
            <Torso x1={64} y1={44} x2={88} y2={68} />
            <Limb pts={[88, 68, 96, 80, 102, 94]} />
            <Head x={94} y={76} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={88} y={66} />
            <Limb pts={[64, 46, 48, 70, 34, 94]} leg />
            <Torso x1={64} y1={46} x2={90} y2={74} active />
            <Limb pts={[90, 74, 86, 82, 102, 94]} active />
            <Head x={100} y={84} />
            <Arrow d="M 112 78 L 102 58 M 99 64 L 102 57 L 108 61" />
          </>
        ),
      };

    // ── 8. OVERHEAD PRESS ─────────────────────────────────────────────
    case 'overhead_press':
      return {
        startCaption: 'Brace Core · Shoulder Rack',
        endCaption: 'Press Overhead',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[70, 66, 64, 80, 62, 94]} leg back />
            <Limb pts={[70, 66, 76, 80, 78, 94]} leg />
            <Torso x1={70} y1={66} x2={70} y2={38} />
            <Limb pts={[70, 42, 56, 52, 58, 36]} />
            <DumbbellProp x={58} y={34} />
            <Head x={70} y={26} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={72} y={38} />
            <Limb pts={[70, 66, 64, 80, 62, 94]} leg back />
            <Limb pts={[70, 66, 76, 80, 78, 94]} leg />
            <Torso x1={70} y1={66} x2={70} y2={38} />
            <Limb pts={[70, 42, 74, 28, 74, 14]} active />
            <DumbbellProp x={74} y={11} />
            <Head x={70} y={27} />
            <Arrow d="M 96 44 V 16 M 91 21 L 96 15 L 101 21" />
          </>
        ),
      };

    // ── 9. LATERAL RAISE (Front view) ─────────────────────────────────
    case 'lateral_raise':
      return {
        startCaption: 'Dumbbells at Sides',
        endCaption: 'Sweep to Shoulder Level',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[66, 66, 64, 80, 62, 94]} leg />
            <Limb pts={[74, 66, 76, 80, 78, 94]} leg />
            <FrontTorso cx={70} topY={38} botY={66} />
            <Limb pts={[62, 40, 58, 54, 56, 68]} />
            <Limb pts={[78, 40, 84, 54, 86, 68]} />
            <Head x={70} y={25} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={70} y={40} r={16} />
            <Limb pts={[66, 66, 64, 80, 62, 94]} leg />
            <Limb pts={[74, 66, 76, 80, 78, 94]} leg />
            <FrontTorso cx={70} topY={38} botY={66} />
            <Limb pts={[62, 40, 48, 42, 30, 40]} active />
            <Limb pts={[78, 40, 94, 42, 110, 40]} active />
            <DumbbellProp x={28} y={40} vertical />
            <DumbbellProp x={112} y={40} vertical />
            <Head x={70} y={25} />
            <Arrow d="M 102 64 C 110 56 112 48 110 44" />
          </>
        ),
      };

    // ── 10. LAT PULLDOWN / ASSISTED PULL-UP ───────────────────────────
    case 'lat_pulldown':
      return {
        startCaption: 'Tall Overhead Stretch',
        endCaption: 'Drive Elbows to Pockets',
        startSvg: (
          <>
            <Floor />
            <line x1="70" y1="6" x2="70" y2="18" stroke={SLATE_PROP_LIGHT} strokeWidth="2" />
            <line x1="44" y1="18" x2="96" y2="18" stroke={LIMB_NEUTRAL} strokeWidth="3.5" strokeLinecap="round" />
            <Limb pts={[70, 74, 88, 76, 90, 94]} leg />
            <Torso x1={70} y1={74} x2={70} y2={46} />
            <Limb pts={[68, 48, 56, 34, 50, 18]} />
            <Limb pts={[72, 48, 84, 34, 90, 18]} />
            <Head x={70} y={35} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={70} y={54} r={15} />
            <line x1="70" y1="6" x2="70" y2="43" stroke={SLATE_PROP_LIGHT} strokeWidth="2" />
            <Limb pts={[70, 74, 88, 76, 90, 94]} leg />
            <FrontTorso cx={70} topY={46} botY={74} active />
            <Limb pts={[62, 48, 50, 58, 46, 43]} active />
            <Limb pts={[78, 48, 90, 58, 94, 43]} active />
            <line x1="42" y1="43" x2="98" y2="43" stroke={EMERALD} strokeWidth="3.5" strokeLinecap="round" />
            <Head x={70} y={31} />
            <Arrow d="M 110 20 V 48 M 105 43 L 110 49 L 115 43" />
          </>
        ),
      };

    // ── 11. SEATED ROW ────────────────────────────────────────────────
    case 'seated_row':
      return {
        startCaption: 'Sit Tall · Arms Extended',
        endCaption: 'Row & Squeeze Blades',
        startSvg: (
          <>
            <Floor />
            <line x1="38" y1="84" x2="106" y2="84" stroke={SLATE_PROP_LIGHT} strokeWidth="3.5" />
            <Limb pts={[56, 80, 82, 78, 108, 82]} leg />
            <Torso x1={56} y1={80} x2={58} y2={46} />
            <Limb pts={[58, 52, 82, 54, 106, 54]} />
            <line x1="106" y1="54" x2="128" y2="54" stroke={SLATE_PROP_LIGHT} strokeWidth="2" />
            <Head x={58} y={34} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <line x1="38" y1="84" x2="106" y2="84" stroke={SLATE_PROP_LIGHT} strokeWidth="3.5" />
            <FocusGlow x={54} y={56} />
            <Limb pts={[56, 80, 82, 78, 108, 82]} leg />
            <Torso x1={56} y1={80} x2={56} y2={46} active />
            <Limb pts={[56, 52, 40, 62, 64, 60]} active />
            <line x1="64" y1="60" x2="128" y2="60" stroke={SLATE_PROP_LIGHT} strokeWidth="2" />
            <Head x={56} y={34} />
            <Arrow d="M 106 42 H 76 M 82 37 L 75 42 L 82 47" />
          </>
        ),
      };

    // ── 12. BENT-OVER / SINGLE-ARM ROW ────────────────────────────────
    case 'bent_row':
      return {
        startCaption: 'Flat-Back Hip Hinge',
        endCaption: 'Row Elbow Past Ribs',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[50, 62, 58, 78, 56, 94]} leg />
            <Torso x1={50} y1={62} x2={88} y2={48} />
            <Limb pts={[84, 50, 84, 68, 84, 82]} />
            <DumbbellProp x={84} y={84} />
            <Head x={100} y={43} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={70} y={52} />
            <Limb pts={[50, 62, 58, 78, 56, 94]} leg />
            <Torso x1={50} y1={62} x2={88} y2={48} />
            <Limb pts={[84, 50, 64, 42, 68, 60]} active />
            <DumbbellProp x={68} y={62} />
            <Head x={100} y={43} />
            <Arrow d="M 88 82 L 76 62 M 74 68 L 76 61 L 83 64" />
          </>
        ),
      };

    // ── 13. FACE PULL / REAR DELT ─────────────────────────────────────
    case 'face_pull':
      return {
        startCaption: 'Cable at Upper Chest',
        endCaption: 'Pull High · Thumbs Back',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[58, 66, 54, 80, 52, 94]} leg />
            <Torso x1={58} y1={66} x2={58} y2={38} />
            <Limb pts={[58, 42, 80, 42, 100, 42]} />
            <line x1="100" y1="42" x2="128" y2="38" stroke={SLATE_PROP_LIGHT} strokeWidth="2" />
            <Head x={58} y={26} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={54} y={40} />
            <Limb pts={[58, 66, 54, 80, 52, 94]} leg />
            <Torso x1={58} y1={66} x2={56} y2={38} />
            <Limb pts={[56, 42, 42, 34, 62, 28]} active />
            <line x1="62" y1="28" x2="128" y2="38" stroke={SLATE_PROP_LIGHT} strokeWidth="2" />
            <Head x={56} y={26} />
            <Arrow d="M 104 24 H 74 M 80 19 L 73 24 L 80 29" />
          </>
        ),
      };

    // ── 14. PRONE Y-T-W RAISES ────────────────────────────────────────
    case 'prone_ytw':
      return {
        startCaption: 'Face Down · Neck Neutral',
        endCaption: 'Lift Arms & Squeeze Back',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[26, 92, 46, 90, 62, 90]} leg />
            <Torso x1={62} y1={90} x2={98} y2={88} />
            <Limb pts={[94, 88, 108, 92, 122, 92]} />
            <Head x={110} y={84} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={88} y={80} />
            <Limb pts={[26, 92, 46, 90, 62, 90]} leg />
            <Torso x1={62} y1={90} x2={98} y2={82} active />
            <Limb pts={[94, 82, 110, 70, 126, 62]} active />
            <Head x={108} y={76} />
            <Arrow d="M 118 86 V 66 M 113 71 L 118 65 L 123 71" />
          </>
        ),
      };

    // ── 15. BICEP / HAMMER CURL ───────────────────────────────────────
    case 'arm_curl':
      return {
        startCaption: 'Elbows Pinned at Sides',
        endCaption: 'Curl Without Swinging',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[66, 66, 66, 80, 66, 94]} leg />
            <Torso x1={66} y1={66} x2={66} y2={36} />
            <Limb pts={[66, 40, 68, 56, 72, 74]} />
            <DumbbellProp x={72} y={76} />
            <Head x={66} y={24} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={74} y={50} />
            <Limb pts={[66, 66, 66, 80, 66, 94]} leg />
            <Torso x1={66} y1={66} x2={66} y2={36} />
            <Limb pts={[66, 40, 68, 58, 86, 40]} active />
            <DumbbellProp x={88} y={38} />
            <Head x={66} y={24} />
            <Arrow d="M 96 68 C 104 58 104 46 96 38 M 95 45 L 95 37 L 103 40" />
          </>
        ),
      };

    // ── 16. TRICEP EXTENSION / PUSHDOWN ───────────────────────────────
    case 'tricep_extension':
      return {
        startCaption: 'Tuck Elbows at Ribs',
        endCaption: 'Extend Forearms Down',
        startSvg: (
          <>
            <Floor />
            <line x1="94" y1="10" x2="86" y2="46" stroke={SLATE_PROP_LIGHT} strokeWidth="2" />
            <Limb pts={[62, 66, 62, 80, 62, 94]} leg />
            <Torso x1={62} y1={66} x2={64} y2={36} />
            <Limb pts={[64, 40, 66, 58, 86, 46]} />
            <Head x={66} y={24} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <line x1="94" y1="10" x2="74" y2="74" stroke={SLATE_PROP_LIGHT} strokeWidth="2" />
            <FocusGlow x={66} y={54} />
            <Limb pts={[62, 66, 62, 80, 62, 94]} leg />
            <Torso x1={62} y1={66} x2={64} y2={36} />
            <Limb pts={[64, 40, 66, 58, 74, 74]} active />
            <Head x={66} y={24} />
            <Arrow d="M 98 46 V 74 M 93 69 L 98 75 L 103 69" />
          </>
        ),
      };

    // ── 17. SQUAT (Goblet / Back Squat) ───────────────────────────────
    case 'squat':
      return {
        startCaption: 'Brace Tall · Feet Planted',
        endCaption: 'Sit Between Heels',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[70, 62, 72, 78, 70, 94]} leg />
            <Torso x1={70} y1={62} x2={72} y2={34} />
            <Limb pts={[72, 38, 84, 50, 84, 38]} />
            <DumbbellProp x={86} y={38} vertical />
            <Head x={74} y={22} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={62} y={74} r={15} />
            <Limb pts={[52, 76, 80, 74, 76, 94]} leg active />
            <Torso x1={52} y1={76} x2={68} y2={46} active />
            <Limb pts={[68, 50, 82, 60, 84, 48]} />
            <DumbbellProp x={86} y={48} vertical />
            <Head x={72} y={34} />
            <Arrow d="M 34 46 V 76 M 29 71 L 34 77 L 39 71" />
          </>
        ),
      };

    // ── 18. LEG PRESS ─────────────────────────────────────────────────
    case 'leg_press':
      return {
        startCaption: 'Back Flat · Knees Bent',
        endCaption: 'Drive Sled · Soft Lockout',
        startSvg: (
          <>
            <Floor />
            <path d="M 34 90 L 54 62 M 54 88 H 76" stroke={SLATE_PROP_LIGHT} strokeWidth="4" strokeLinecap="round" />
            <line x1="88" y1="38" x2="104" y2="72" stroke={SLATE_PROP_LIGHT} strokeWidth="5" strokeLinecap="round" />
            <Torso x1={58} y1={82} x2={44} y2={58} />
            <Limb pts={[58, 82, 68, 56, 94, 56]} leg />
            <Head x={38} y={47} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <path d="M 34 90 L 54 62 M 54 88 H 76" stroke={SLATE_PROP_LIGHT} strokeWidth="4" strokeLinecap="round" />
            <line x1="106" y1="30" x2="122" y2="64" stroke={SLATE_PROP_LIGHT} strokeWidth="5" strokeLinecap="round" />
            <FocusGlow x={78} y={68} />
            <Torso x1={58} y1={82} x2={44} y2={58} />
            <Limb pts={[58, 82, 84, 66, 112, 50]} leg active />
            <Head x={38} y={47} />
            <Arrow d="M 80 38 L 104 26 M 97 24 L 105 26 L 101 33" />
          </>
        ),
      };

    // ── 19. LEG EXTENSION ─────────────────────────────────────────────
    case 'leg_extension':
      return {
        startCaption: 'Knees Aligned at 90°',
        endCaption: 'Extend & Squeeze Quads',
        startSvg: (
          <>
            <Floor />
            <path d="M 48 94 V 40 M 44 74 H 78" stroke={SLATE_PROP_LIGHT} strokeWidth="4" strokeLinecap="round" />
            <Torso x1={56} y1={72} x2={54} y2={42} />
            <Limb pts={[56, 72, 82, 72, 82, 94]} leg />
            <Head x={56} y={30} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <path d="M 48 94 V 40 M 44 74 H 78" stroke={SLATE_PROP_LIGHT} strokeWidth="4" strokeLinecap="round" />
            <FocusGlow x={76} y={70} />
            <Torso x1={56} y1={72} x2={54} y2={42} />
            <Limb pts={[56, 72, 84, 72, 114, 70]} leg active />
            <Head x={56} y={30} />
            <Arrow d="M 96 90 C 108 86 114 78 114 74" />
          </>
        ),
      };

    // ── 20. LEG CURL ──────────────────────────────────────────────────
    case 'leg_curl':
      return {
        startCaption: 'Hips Back · Legs Straight',
        endCaption: 'Curl Heels Under Seat',
        startSvg: (
          <>
            <Floor />
            <path d="M 48 94 V 40 M 44 74 H 78" stroke={SLATE_PROP_LIGHT} strokeWidth="4" strokeLinecap="round" />
            <Torso x1={56} y1={72} x2={54} y2={42} />
            <Limb pts={[56, 72, 84, 72, 114, 72]} leg />
            <Head x={56} y={30} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <path d="M 48 94 V 40 M 44 74 H 78" stroke={SLATE_PROP_LIGHT} strokeWidth="4" strokeLinecap="round" />
            <FocusGlow x={72} y={76} />
            <Torso x1={56} y1={72} x2={54} y2={42} />
            <Limb pts={[56, 72, 84, 72, 74, 94]} leg active />
            <Head x={56} y={30} />
            <Arrow d="M 110 76 C 104 88 92 94 80 94 M 85 89 L 79 94 L 85 98" />
          </>
        ),
      };

    // ── 21. SPLIT SQUAT / REVERSE LUNGE ───────────────────────────────
    case 'lunge_split':
      return {
        startCaption: 'Hip-Width Split Stance',
        endCaption: 'Drop Back Knee Straight',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[70, 62, 52, 78, 38, 94]} leg back />
            <Limb pts={[70, 62, 86, 76, 92, 94]} leg />
            <Torso x1={70} y1={62} x2={70} y2={34} />
            <Limb pts={[70, 38, 70, 54, 70, 68]} />
            <Head x={70} y={22} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={78} y={74} r={15} />
            <Limb pts={[68, 74, 62, 92, 38, 94]} leg back />
            <Limb pts={[68, 74, 94, 74, 94, 94]} leg active />
            <Torso x1={68} y1={74} x2={68} y2={46} active />
            <Limb pts={[68, 50, 68, 66, 68, 80]} />
            <Head x={68} y={34} />
            <Arrow d="M 112 48 V 78 M 107 73 L 112 79 L 117 73" />
          </>
        ),
      };

    // ── 22. LATERAL LUNGE (Front view) ────────────────────────────────
    case 'lateral_lunge':
      return {
        startCaption: 'Step Wide · Toes Forward',
        endCaption: 'Sit Into Stepping Hip',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[64, 62, 50, 78, 36, 94]} leg />
            <Limb pts={[72, 62, 86, 78, 100, 94]} leg />
            <Torso x1={68} y1={62} x2={68} y2={34} />
            <Head x={68} y={22} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={92} y={74} />
            <Limb pts={[78, 72, 56, 84, 34, 94]} leg />
            <Limb pts={[84, 72, 104, 74, 102, 94]} leg active />
            <Torso x1={82} y1={72} x2={84} y2={44} active />
            <Limb pts={[84, 48, 84, 60, 84, 52]} />
            <DumbbellProp x={84} y={52} vertical />
            <Head x={84} y={32} />
            <Arrow d="M 60 44 H 98 M 92 39 L 99 44 L 92 49" />
          </>
        ),
      };

    // ── 23. HIP HINGE (RDL / Pull-Through / KB Swing) ─────────────────
    case 'hinge':
      return {
        startCaption: 'Stand Tall · Soft Knees',
        endCaption: 'Push Hips Straight Back',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[70, 62, 72, 78, 70, 94]} leg />
            <Torso x1={70} y1={62} x2={70} y2={34} />
            <Limb pts={[70, 38, 72, 54, 74, 68]} />
            <DumbbellProp x={74} y={70} />
            <Head x={70} y={22} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={50} y={66} r={15} />
            <Limb pts={[48, 60, 56, 78, 56, 94]} leg active />
            <Torso x1={48} y1={60} x2={88} y2={48} active />
            <Limb pts={[84, 50, 82, 68, 80, 82]} />
            <DumbbellProp x={80} y={84} />
            <Head x={100} y={44} />
            <Arrow d="M 40 60 H 18 M 24 55 L 17 60 L 24 65" />
          </>
        ),
      };

    // ── 24. GLUTE BRIDGE (Supine on mat) ──────────────────────────────
    case 'glute_bridge':
      return {
        startCaption: 'Back Flat · Heels Planted',
        endCaption: 'Bridge Hips to Straight Line',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[68, 90, 48, 62, 34, 94]} leg />
            <Torso x1={68} y1={90} x2={104} y2={90} />
            <Head x={116} y={87} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={72} y={72} r={15} />
            <Limb pts={[72, 70, 48, 58, 34, 94]} leg active />
            <Torso x1={72} y1={70} x2={104} y2={88} active />
            <Head x={116} y={86} />
            <Arrow d="M 72 90 V 74 M 67 79 L 72 73 L 77 79" />
          </>
        ),
      };

    // ── 25. DEAD BUG (Supine anti-extension core) ─────────────────────
    case 'dead_bug':
      return {
        startCaption: 'Low Back Flat · 90° Knees',
        endCaption: 'Extend Opposite Arm & Leg',
        startSvg: (
          <>
            <Floor />
            <Torso x1={60} y1={89} x2={98} y2={89} />
            <Limb pts={[60, 89, 60, 62, 36, 62]} leg />
            <Limb pts={[96, 89, 96, 68, 96, 48]} />
            <Head x={110} y={86} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={78} y={86} r={14} />
            <Limb pts={[60, 89, 60, 64, 38, 64]} leg back />
            <Limb pts={[96, 89, 96, 70, 96, 52]} back />
            <Torso x1={60} y1={89} x2={98} y2={89} active />
            <Limb pts={[60, 89, 38, 84, 16, 80]} leg active />
            <Limb pts={[96, 89, 112, 82, 128, 76]} active />
            <Head x={108} y={86} />
            <Arrow d="M 40 72 H 16 M 22 67 L 15 72 L 22 77" />
          </>
        ),
      };

    // ── 26. PLANK SHOULDER TAP / FALLOUT ──────────────────────────────
    case 'core_plank':
      return {
        startCaption: 'Wide-Stance Straight Plank',
        endCaption: 'Control Hips · Zero Sway',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[28, 92, 50, 80, 66, 72]} leg />
            <Torso x1={66} y1={72} x2={100} y2={58} />
            <Limb pts={[98, 60, 98, 76, 98, 94]} />
            <Head x={112} y={54} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={82} y={65} r={15} />
            <Limb pts={[28, 92, 50, 80, 66, 72]} leg />
            <Torso x1={66} y1={72} x2={100} y2={58} active />
            <Limb pts={[98, 60, 98, 76, 98, 94]} back />
            <Limb pts={[98, 60, 86, 66, 96, 56]} active />
            <Head x={112} y={54} />
            <line x1="56" y1="48" x2="104" y2="38" stroke={AMBER} strokeWidth="2" strokeDasharray="3 3" />
          </>
        ),
      };

    // ── 27. CORE ROTATION / PALLOF PRESS ──────────────────────────────
    case 'core_rotation':
      return {
        startCaption: 'Brace Ribs · Hands at Chest',
        endCaption: 'Press & Resist Twist',
        startSvg: (
          <>
            <Floor />
            <line x1="18" y1="54" x2="70" y2="54" stroke={SLATE_PROP_LIGHT} strokeWidth="2" strokeDasharray="3 3" />
            <Limb pts={[64, 66, 60, 80, 56, 94]} leg />
            <Limb pts={[76, 66, 80, 80, 84, 94]} leg />
            <FrontTorso cx={70} topY={36} botY={66} />
            <Limb pts={[62, 40, 58, 52, 70, 54]} />
            <Head x={70} y={24} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={70} y={54} r={15} />
            <line x1="18" y1="54" x2="96" y2="54" stroke={SLATE_PROP_LIGHT} strokeWidth="2" />
            <Limb pts={[64, 66, 60, 80, 56, 94]} leg />
            <Limb pts={[76, 66, 80, 80, 84, 94]} leg />
            <FrontTorso cx={70} topY={36} botY={66} active />
            <Limb pts={[70, 40, 84, 48, 96, 54]} active />
            <Head x={70} y={24} />
            <Arrow d="M 96 36 V 72" />
          </>
        ),
      };

    // ── 28. SUITCASE CARRY (Front view) ───────────────────────────────
    case 'suitcase_carry':
      return {
        startCaption: 'Heavy Bell in One Hand',
        endCaption: 'Walk With Level Shoulders',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[64, 66, 64, 80, 64, 94]} leg />
            <Limb pts={[76, 66, 76, 80, 76, 94]} leg />
            <FrontTorso cx={70} topY={36} botY={66} />
            <Limb pts={[62, 38, 56, 52, 56, 68]} />
            <Limb pts={[78, 38, 86, 52, 86, 68]} />
            <DumbbellProp x={86} y={72} vertical />
            <Head x={70} y={24} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={66} y={52} r={15} />
            <Limb pts={[64, 66, 62, 78, 62, 94]} leg />
            <Limb pts={[76, 66, 78, 76, 78, 88]} leg active />
            <FrontTorso cx={70} topY={36} botY={66} active />
            <Limb pts={[62, 38, 54, 52, 54, 66]} />
            <Limb pts={[78, 38, 86, 52, 86, 68]} active />
            <DumbbellProp x={86} y={72} vertical />
            <Head x={70} y={24} />
            <line x1="44" y1="36" x2="96" y2="36" stroke={AMBER} strokeWidth="2" strokeDasharray="3 3" />
          </>
        ),
      };

    // ── 29. CARDIO STRIDE / INCLINE WALK ──────────────────────────────
    case 'cardio_stride':
      return {
        startCaption: 'Tall Chest · Slight Incline',
        endCaption: 'Smooth Steady Stride',
        startSvg: (
          <>
            <Floor y={96} y2={88} />
            <Limb pts={[68, 62, 58, 78, 50, 93]} leg back />
            <Limb pts={[68, 62, 78, 76, 86, 90]} leg />
            <Torso x1={68} y1={62} x2={70} y2={34} />
            <Limb pts={[70, 40, 62, 50, 74, 54]} />
            <Head x={72} y={22} />
          </>
        ),
        endSvg: (
          <>
            <Floor y={96} y2={88} />
            <FocusGlow x={74} y={64} />
            <Limb pts={[70, 60, 56, 76, 44, 93]} leg back />
            <Limb pts={[70, 60, 88, 68, 94, 89]} leg active />
            <Torso x1={70} y1={60} x2={74} y2={32} active />
            <Limb pts={[74, 38, 86, 48, 94, 42]} active />
            <Head x={76} y={20} />
            <Arrow d="M 96 28 H 122 M 116 23 L 123 28 L 116 33" />
          </>
        ),
      };

    // ── 30. STATIONARY BIKE SPIN ──────────────────────────────────────
    case 'bike_spin':
      return {
        startCaption: 'Seat Hip-High · Soft Knee',
        endCaption: 'Smooth 75+ RPM Spin',
        startSvg: (
          <>
            <Floor />
            <circle cx="88" cy="80" r="13" stroke={SLATE_PROP_LIGHT} strokeWidth="3" />
            <line x1="52" y1="94" x2="58" y2="62" stroke={SLATE_PROP_LIGHT} strokeWidth="3.5" />
            <Limb pts={[58, 62, 78, 64, 88, 80]} leg />
            <Torso x1={58} y1={62} x2={74} y2={38} />
            <Limb pts={[74, 42, 86, 48, 96, 46]} />
            <Head x={80} y={26} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <circle cx="88" cy="80" r="13" stroke={SLATE_PROP_LIGHT} strokeWidth="3" />
            <line x1="52" y1="94" x2="58" y2="62" stroke={SLATE_PROP_LIGHT} strokeWidth="3.5" />
            <FocusGlow x={76} y={72} />
            <Limb pts={[58, 62, 74, 76, 84, 90]} leg active />
            <Torso x1={58} y1={62} x2={74} y2={38} />
            <Limb pts={[74, 42, 86, 48, 96, 46]} />
            <Head x={80} y={26} />
            <Arrow d="M 104 72 C 108 82 102 92 92 94 M 97 89 L 91 94 L 97 98" />
          </>
        ),
      };

    // ── 31. HALF-KNEELING HIP FLEXOR STRETCH ──────────────────────────
    case 'hip_flexor_stretch':
      return {
        startCaption: 'Half-Kneel · Tuck Pelvis',
        endCaption: 'Shift Forward & Reach',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[64, 66, 62, 94, 38, 94]} leg back />
            <Limb pts={[64, 66, 90, 68, 90, 94]} leg />
            <Torso x1={64} y1={66} x2={64} y2={36} />
            <Head x={64} y={24} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={68} y={72} r={15} />
            <Limb pts={[74, 68, 60, 94, 36, 94]} leg active />
            <Limb pts={[74, 68, 100, 68, 98, 94]} leg />
            <Torso x1={74} y1={68} x2={72} y2={38} active />
            <Limb pts={[72, 42, 70, 26, 66, 12]} active />
            <Head x={74} y={26} />
            <Arrow d="M 44 54 H 62 M 57 49 L 63 54 L 57 59" />
          </>
        ),
      };

    // ── 32. CHILD'S POSE & LAT STRETCH ────────────────────────────────
    case 'childs_pose':
      return {
        startCaption: 'Kneel & Sit Hips to Heels',
        endCaption: 'Walk Hands Long & Exhale',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[48, 76, 68, 94, 36, 94]} leg />
            <Torso x1={48} y1={76} x2={62} y2={46} />
            <Limb pts={[62, 50, 74, 66, 82, 82]} />
            <Head x={68} y={35} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={74} y={76} r={16} />
            <Limb pts={[40, 84, 66, 94, 32, 94]} leg />
            <SpineCurve d="M 40 84 Q 64 68 88 78" active />
            <Limb pts={[88, 78, 106, 88, 124, 92]} active />
            <Head x={94} y={84} />
            <Arrow d="M 96 64 H 124 M 118 59 L 125 64 L 118 69" />
          </>
        ),
      };

    // ── 33. CHEST & PEC OPENER ────────────────────────────────────────
    case 'chest_opener':
      return {
        startCaption: 'Clasp Hands Behind Back',
        endCaption: 'Draw Blades Down & Open',
        startSvg: (
          <>
            <Floor />
            <Limb pts={[68, 72, 68, 94, 44, 94]} leg />
            <Torso x1={68} y1={72} x2={68} y2={42} />
            <Limb pts={[68, 46, 58, 60, 56, 74]} />
            <Head x={68} y={29} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={74} y={48} r={15} />
            <Limb pts={[68, 72, 68, 94, 44, 94]} leg />
            <SpineCurve d="M 68 72 Q 74 56 68 40" active />
            <Limb pts={[68, 46, 52, 58, 38, 68]} active />
            <Head x={72} y={28} />
            <Arrow d="M 54 74 L 36 82 M 43 84 L 35 82 L 39 75" />
          </>
        ),
      };

    // ── 34. SUPINE FIGURE-4 GLUTE STRETCH ─────────────────────────────
    case 'figure_four':
    default:
      return {
        startCaption: 'Lie Back · Cross Ankle',
        endCaption: 'Draw Support Thigh In',
        startSvg: (
          <>
            <Floor />
            <Torso x1={64} y1={90} x2={102} y2={90} />
            <Limb pts={[64, 90, 44, 62, 30, 94]} leg back />
            <Limb pts={[64, 90, 56, 68, 46, 64]} leg />
            <Head x={114} y={87} />
          </>
        ),
        endSvg: (
          <>
            <Floor />
            <FocusGlow x={62} y={84} r={15} />
            <Torso x1={64} y1={90} x2={102} y2={90} />
            <Limb pts={[64, 90, 76, 58, 50, 58]} leg back />
            <Limb pts={[64, 90, 56, 72, 74, 60]} leg active />
            <Limb pts={[98, 88, 86, 74, 76, 62]} />
            <Head x={114} y={87} />
            <Arrow d="M 56 42 H 82 M 76 37 L 83 42 L 76 47" />
          </>
        ),
      };
  }
}

export const FormVisual: React.FC<FormVisualProps> = ({ visualKey, label }) => {
  const spec = getVisualSpec(visualKey);

  return (
    <div className="guide-visual" role="img" aria-label={label ?? `${spec.startCaption} to ${spec.endCaption}`}>
      <div className="guide-panel">
        <svg viewBox="0 0 140 104" className="guide-svg" fill="none" aria-hidden="true">
          {spec.startSvg}
        </svg>
        <div className="guide-caption">
          <span className="guide-step-num">1</span>
          {spec.startCaption}
        </div>
      </div>

      <div className="guide-arrow" aria-hidden="true">
        →
      </div>

      <div className="guide-panel">
        <svg viewBox="0 0 140 104" className="guide-svg" fill="none" aria-hidden="true">
          {spec.endSvg}
        </svg>
        <div className="guide-caption active">
          <span className="guide-step-num">2</span>
          {spec.endCaption}
        </div>
      </div>
    </div>
  );
};
