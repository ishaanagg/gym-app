import React from 'react';
import type { VisualKey } from '../types/gym';

interface FormVisualProps {
  visualKey: VisualKey;
  label?: string;
}

export const FormVisual: React.FC<FormVisualProps> = ({ visualKey, label }) => {
  const renderDiagram = () => {
    switch (visualKey) {
      case 'chest_press':
        return (
          <svg viewBox="0 0 240 120" width="220" height="110" fill="none" aria-label={label ?? 'Chest press posture'}>
            {/* Bench / Seat */}
            <path d="M52 96V64M40 96H104" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
            <path d="M52 64L52 38" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
            {/* Torso & Head */}
            <circle cx="64" cy="34" r="9" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M64 43L62 72L96 76L102 96" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Start Arm (bent) */}
            <path d="M64 50L78 58L94 52" stroke="#64748B" strokeWidth="2.5" strokeDasharray="3 3" strokeLinecap="round" />
            {/* End Arm (pressed) */}
            <path d="M64 50L128 50" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" />
            {/* Alignment / Force Arrow */}
            <path d="M138 50H168M161 43L169 50L161 57" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <text x="140" y="34" fill="#94A3B8" fontSize="9" fontFamily="Plus Jakarta Sans">Shoulders packed</text>
          </svg>
        );

      case 'overhead_press':
        return (
          <svg viewBox="0 0 240 120" width="220" height="110" fill="none" aria-label={label ?? 'Overhead press posture'}>
            {/* Standing legs & torso */}
            <circle cx="100" cy="40" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M100 48V82M100 82L90 108M100 82L110 108" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Start arms */}
            <path d="M100 54L82 58L82 42" stroke="#64748B" strokeWidth="2.5" strokeDasharray="3 3" strokeLinecap="round" />
            {/* End arms overhead */}
            <path d="M100 54L114 38L114 16" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="108" y="10" width="12" height="5" rx="2" fill="#10B981" />
            {/* Arrow */}
            <path d="M132 46V18M126 24L132 17L138 24" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <text x="142" y="36" fill="#94A3B8" fontSize="9" fontFamily="Plus Jakarta Sans">Ribs down, core braced</text>
          </svg>
        );

      case 'lat_pulldown':
        return (
          <svg viewBox="0 0 240 120" width="220" height="110" fill="none" aria-label={label ?? 'Lat pulldown posture'}>
            {/* Seat */}
            <path d="M84 82H124M104 82V106" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
            {/* Person */}
            <circle cx="104" cy="44" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M104 52L102 82L122 86L124 106" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Extended arms (top) */}
            <path d="M102 58L90 22M102 58L116 22" stroke="#64748B" strokeWidth="2.5" strokeDasharray="3 3" strokeLinecap="round" />
            <path d="M78 20H128" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
            {/* Pulled down */}
            <path d="M102 58L84 48L84 38M102 58L122 48L122 38" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
            <path d="M76 38H130" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" />
            {/* Arrow */}
            <path d="M148 22V50M142 43L148 51L154 43" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <text x="158" y="40" fill="#94A3B8" fontSize="9" fontFamily="Plus Jakarta Sans">Elbows to pockets</text>
          </svg>
        );

      case 'seated_row':
        return (
          <svg viewBox="0 0 240 120" width="220" height="110" fill="none" aria-label={label ?? 'Row posture'}>
            <path d="M50 88H106" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
            <circle cx="72" cy="42" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M72 50L72 82L122 84" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Extended reach */}
            <path d="M72 56L134 58" stroke="#64748B" strokeWidth="2.5" strokeDasharray="3 3" strokeLinecap="round" />
            {/* Pulled row */}
            <path d="M72 56L54 66L80 66" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Pull arrow */}
            <path d="M142 46H112M119 40L111 46L119 52" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <text x="116" y="34" fill="#94A3B8" fontSize="9" fontFamily="Plus Jakarta Sans">Squeeze shoulder blades</text>
          </svg>
        );

      case 'squat':
        return (
          <svg viewBox="0 0 240 120" width="220" height="110" fill="none" aria-label={label ?? 'Squat posture'}>
            <line x1="40" y1="106" x2="180" y2="106" stroke="#334155" strokeWidth="2" />
            {/* Standing ghost */}
            <circle cx="80" cy="24" r="7" stroke="#64748B" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M80 31V66L74 104M80 66L86 104" stroke="#64748B" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" />
            {/* Squat bottom */}
            <circle cx="128" cy="48" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M126 56L114 78L136 86L130 104" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M124 62L144 64" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
            {/* Vertical hip path */}
            <path d="M158 46V84M152 77L158 85L164 77" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <text x="166" y="64" fill="#94A3B8" fontSize="9" fontFamily="Plus Jakarta Sans">Chest tall, heels flat</text>
          </svg>
        );

      case 'hinge':
        return (
          <svg viewBox="0 0 240 120" width="220" height="110" fill="none" aria-label={label ?? 'Hip hinge posture'}>
            <line x1="40" y1="106" x2="180" y2="106" stroke="#334155" strokeWidth="2" />
            {/* Hinged spine */}
            <circle cx="136" cy="46" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M129 51L92 66L98 86L96 104" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Arms holding weight */}
            <path d="M122 54L120 88" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
            <rect x="114" y="88" width="12" height="6" rx="2" fill="#10B981" />
            {/* Hip-back arrow */}
            <path d="M84 66H58M65 60L57 66L65 72" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <text x="44" y="48" fill="#94A3B8" fontSize="9" fontFamily="Plus Jakarta Sans">Hips back, flat spine</text>
          </svg>
        );

      case 'core_plank':
      case 'core_rotation':
        return (
          <svg viewBox="0 0 240 120" width="220" height="110" fill="none" aria-label={label ?? 'Core stability posture'}>
            <line x1="36" y1="98" x2="204" y2="98" stroke="#334155" strokeWidth="2" />
            {/* Plank body */}
            <circle cx="158" cy="58" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M62 84L148 64" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />
            <path d="M148 64L148 96" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M62 84L54 96" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" />
            {/* Alignment line */}
            <path d="M84 56H126" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 3" />
            <text x="72" y="44" fill="#94A3B8" fontSize="9" fontFamily="Plus Jakarta Sans">Neutral spine, hips level</text>
          </svg>
        );

      case 'cardio_stride':
        return (
          <svg viewBox="0 0 240 120" width="220" height="110" fill="none" aria-label={label ?? 'Cardio cooldown'}>
            <line x1="36" y1="104" x2="204" y2="104" stroke="#334155" strokeWidth="2" />
            <circle cx="114" cy="30" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M114 38L110 70L92 102M110 70L132 100" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M112 46L130 56M112 46L96 58" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
            <path d="M148 44H178M171 38L179 44L171 50" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <text x="142" y="30" fill="#94A3B8" fontSize="9" fontFamily="Plus Jakarta Sans">Steady conversational pace</text>
          </svg>
        );

      case 'mobility_flow':
      case 'stretch_reach':
      default:
        return (
          <svg viewBox="0 0 240 120" width="220" height="110" fill="none" aria-label={label ?? 'Mobility and stretch posture'}>
            <line x1="36" y1="102" x2="204" y2="102" stroke="#334155" strokeWidth="2" />
            <circle cx="114" cy="40" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            {/* Lunge / reach */}
            <path d="M114 48L110 78L142 82L144 100M110 78L80 98" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M112 52L126 22" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
            <text x="138" y="34" fill="#94A3B8" fontSize="9" fontFamily="Plus Jakarta Sans">Breathe &amp; lengthen</text>
          </svg>
        );
    }
  };

  return <div className="visual-frame">{renderDiagram()}</div>;
};
