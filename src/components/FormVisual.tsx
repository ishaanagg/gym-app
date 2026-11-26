import React from 'react';
import type { VisualKey } from '../types/gym';

interface FormVisualProps {
  visualKey: VisualKey;
  label?: string;
}

/**
 * Clean, text-free architectural posture silhouettes.
 * Slate dashed lines show the starting setup; emerald lines show the active end position;
 * warm amber vectors indicate the controlled force/alignment path.
 */
export const FormVisual: React.FC<FormVisualProps> = ({ visualKey, label }) => {
  const renderDiagram = () => {
    switch (visualKey) {
      case 'chest_press':
        return (
          <svg viewBox="0 0 220 112" width="210" height="106" fill="none" aria-label={label ?? 'Chest press posture'}>
            <path d="M56 98V68M44 98H106" stroke="#263244" strokeWidth="4" strokeLinecap="round" />
            <path d="M56 68V34" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
            <circle cx="69" cy="30" r="8.5" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M69 39L67 70L102 74L108 98" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M68 48L82 58L98 50" stroke="#64748B" strokeWidth="2.5" strokeDasharray="3 3" strokeLinecap="round" />
            <path d="M68 48H136" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />
            <circle cx="68" cy="48" r="3" fill="#10B981" />
            <path d="M148 48H180M173 41L181 48L173 55" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      case 'overhead_press':
        return (
          <svg viewBox="0 0 220 112" width="210" height="106" fill="none" aria-label={label ?? 'Overhead press posture'}>
            <line x1="64" y1="102" x2="156" y2="102" stroke="#263244" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="106" cy="38" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M106 46V78M106 78L94 102M106 78L118 102" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M106 52L88 56V40" stroke="#64748B" strokeWidth="2.5" strokeDasharray="3 3" strokeLinecap="round" />
            <path d="M106 52L118 36V14" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="111" y="9" width="14" height="5" rx="2.5" fill="#10B981" />
            <path d="M142 46V16M136 22L142 15L148 22" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      case 'lat_pulldown':
        return (
          <svg viewBox="0 0 220 112" width="210" height="106" fill="none" aria-label={label ?? 'Lat pulldown posture'}>
            <path d="M84 80H126M105 80V102" stroke="#263244" strokeWidth="4" strokeLinecap="round" />
            <circle cx="105" cy="44" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M105 52L103 80L123 84L125 102" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M103 56L90 20M103 56L118 20" stroke="#64748B" strokeWidth="2.5" strokeDasharray="3 3" strokeLinecap="round" />
            <path d="M78 18H130" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
            <path d="M103 56L84 48V36M103 56L124 48V36" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M76 36H132" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />
            <path d="M154 20V50M148 43L154 51L160 43" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      case 'seated_row':
        return (
          <svg viewBox="0 0 220 112" width="210" height="106" fill="none" aria-label={label ?? 'Row posture'}>
            <path d="M58 88H126" stroke="#263244" strokeWidth="4" strokeLinecap="round" />
            <circle cx="80" cy="38" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M80 46V80L132 82" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M80 54L142 56" stroke="#64748B" strokeWidth="2.5" strokeDasharray="3 3" strokeLinecap="round" />
            <path d="M80 54L62 64H88" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="88" cy="64" r="3" fill="#10B981" />
            <path d="M164 56H132M139 49L131 56L139 63" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      case 'arm_curl':
        return (
          <svg viewBox="0 0 220 112" width="210" height="106" fill="none" aria-label={label ?? 'Arm curl posture'}>
            <line x1="64" y1="102" x2="156" y2="102" stroke="#263244" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="102" cy="28" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M102 36V74M102 74L92 100M102 74L112 100" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Start forearm extended down */}
            <path d="M102 44L104 60L110 80" stroke="#64748B" strokeWidth="2.5" strokeDasharray="3 3" strokeLinecap="round" />
            {/* Pinned elbow + curled forearm */}
            <path d="M102 44L104 62L126 44" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="104" cy="62" r="3" fill="#10B981" />
            <path d="M138 74C146 62 146 48 136 38M134 45L135 37L143 39" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      case 'tricep_extension':
        return (
          <svg viewBox="0 0 220 112" width="210" height="106" fill="none" aria-label={label ?? 'Tricep extension posture'}>
            <line x1="64" y1="102" x2="156" y2="102" stroke="#263244" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="100" cy="28" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M98 36L96 74M96 74L86 100M96 74L108 100" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Bent forearm start */}
            <path d="M98 44L102 60L124 50" stroke="#64748B" strokeWidth="2.5" strokeDasharray="3 3" strokeLinecap="round" />
            {/* Extended forearm down */}
            <path d="M98 44L102 60L112 82" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="102" cy="60" r="3" fill="#10B981" />
            <path d="M140 46V78M134 71L140 79L146 71" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      case 'squat':
        return (
          <svg viewBox="0 0 220 112" width="210" height="106" fill="none" aria-label={label ?? 'Squat posture'}>
            <line x1="48" y1="100" x2="176" y2="100" stroke="#263244" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="80" cy="24" r="7" stroke="#64748B" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M80 31V64L74 98M80 64L86 98" stroke="#64748B" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" />
            <circle cx="126" cy="44" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M124 52L110 74L134 80L128 98" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M122 58L142 60" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
            <circle cx="110" cy="74" r="3" fill="#10B981" />
            <path d="M162 42V80M156 73L162 81L168 73" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      case 'hinge':
        return (
          <svg viewBox="0 0 220 112" width="210" height="106" fill="none" aria-label={label ?? 'Hip hinge posture'}>
            <line x1="48" y1="100" x2="176" y2="100" stroke="#263244" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="142" cy="42" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M134 47L94 62L100 82L98 98" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="94" cy="62" r="3.2" fill="#10B981" />
            <path d="M126 50L124 84" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
            <rect x="118" y="84" width="12" height="6" rx="2" fill="#10B981" />
            <path d="M82 62H54M61 55L53 62L61 69" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      case 'core_plank':
        return (
          <svg viewBox="0 0 220 112" width="210" height="106" fill="none" aria-label={label ?? 'Core plank stability'}>
            <line x1="36" y1="94" x2="184" y2="94" stroke="#263244" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="154" cy="54" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M58 80L144 60" stroke="#10B981" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M144 60V92M58 80L52 92" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M72 48L134 34" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
          </svg>
        );

      case 'core_rotation':
        return (
          <svg viewBox="0 0 220 112" width="210" height="106" fill="none" aria-label={label ?? 'Anti-rotation core press'}>
            <line x1="56" y1="100" x2="164" y2="100" stroke="#263244" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="110" cy="30" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M110 38V72M110 72L94 98M110 72L126 98" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="48" y1="54" x2="110" y2="54" stroke="#64748B" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M110 48L142 54L110 60" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="142" cy="54" r="3.5" fill="#10B981" />
            <path d="M142 36V72" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );

      case 'cardio_stride':
        return (
          <svg viewBox="0 0 220 112" width="210" height="106" fill="none" aria-label={label ?? 'Cardio stride'}>
            <line x1="42" y1="98" x2="178" y2="92" stroke="#263244" strokeWidth="3" strokeLinecap="round" />
            <circle cx="110" cy="28" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M110 36L106 66L86 95M106 66L128 93" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M108 44L126 54M108 44L90 56" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
            <path d="M144 44H174M167 37L175 44L167 51" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      case 'mobility_flow':
        return (
          <svg viewBox="0 0 220 112" width="210" height="106" fill="none" aria-label={label ?? 'Dynamic mobility flow'}>
            <line x1="38" y1="98" x2="182" y2="98" stroke="#263244" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="118" cy="40" r="8" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M114 48L108 74L140 76L142 96M108 74L72 94" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M114 52L128 18" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M104 28C112 18 126 16 136 22" stroke="#F59E0B" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" />
          </svg>
        );

      case 'stretch_reach':
      default:
        return (
          <svg viewBox="0 0 220 112" width="210" height="106" fill="none" aria-label={label ?? 'Flexibility stretch'}>
            <line x1="38" y1="94" x2="182" y2="94" stroke="#263244" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="122" cy="68" r="7.5" stroke="#E2E8F0" strokeWidth="2.5" />
            <path d="M68 88L98 68L116 74M68 88H98" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M116 74L158 88" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M132 56H164M157 49L165 56L157 63" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
    }
  };

  return <div className="visual-frame">{renderDiagram()}</div>;
};
